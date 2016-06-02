
// libraries
import async from 'async';
import classer from 'classer';
import spaz from 'spaz';

// local classes
import evaluator from './evaluator';


// open abstract connection to SPARQL endpoint
let $$ = spaz({
	engine: {
		endpoint: 'http://localhost:3060/dbpedia',
		http_methods: 'post',
	},
	prefixes: {
		graph: 'graph://',
		volt: 'http://volt-name.space/ontology/',
		input: 'http://volt-name.space/vocab/input#',
		output: 'http://volt-name.space/vocab/output#',
		stko: 'http://stko.geog.ucsb.edu/vocab/',
	},
});


//
const A_JSON_DATATYPES = ['boolean', 'number', 'string'];

//
const F_ROUTE_IS = (route, k) => route(k.$is());
const F_ROUTE_TYPE = (route, k) => route(k.$type());
const F_ROUTE_VALUE = (route, k) => route(k());


//
const build_literal = (k_literal, h_context) => {

	// literal refers to a volt variable
	if('Variable' === k_literal.$datatype()) {
		// fetch compiled id of variable by name
		return h_context.user_variable_id(k_literal());
	}
	// literal has parseable datatype
	else if(k_literal.$datatype.parseable()) {
		let w_value = k_literal();

		// javascript datatype of literal value
		let s_js_datatype = typeof w_value;

		// literal can be safely converted to code via json
		if(-1 !== A_JSON_DATATYPES.indexOf(s_js_datatype)) {
			// stringify literal value
			return JSON.stringify(w_value);
		}
		// literal needs more strict reconstruction
		else {
			// date-time
			if(w_value instanceof Date) {
				return `Date.parse(${JSON.stringify(w_value)})`;
			}
			// no idea
			else {
				local.fail(`no way to reconstruct ${s_js_datatype} literal in javascript: ${JSON.stringify(w_value)}`);
			}
		}
	}
	// literal is something else..?
	else {
		local.fail(`cannot reconstruct literal from datatype "${k_literal.$datatype()}"`);
	}
};


//
const router = (s_name, f_router, h_locals) => {
	return classer.operator((...a_args) => {

		// prep route name
		let s_route;

		// prep route callback; set route value
		let f_set_route = (_s_route) => s_route = _s_route;

		// find which route to use
		let w_return = f_router.apply(h_locals, [f_set_route, ...a_args]);

		// route was set
		if(s_route) {
			// ref handler
			let k_route_handler = h_locals[s_route];

			// route does not exist
			if(!k_route_handler) {
				local.fail(`${s_name} cannot route "${s_route}"`);
			}

			// forward call to route handler
			return k_route_handler(...a_args);
		}
		// route not set; explicit return value
		else {
			return w_return;
		}
	});
};


// define how to route from an input to the local handlers
const router_group = (s_group_name, f_router, h_handlers) => {
	let h_output = {};

	// each handler
	for(let s_handler_name in h_handlers) {
		let h_handler = h_handlers[s_handler_name];

		// create handler interface
		h_output[s_handler_name] = router(`${s_group_name}.${s_handler_name}`, f_router, h_handler);
	}

	// render callee as output
	return h_output;
};


//
const sparql = {

	query: router('sparql.query', F_ROUTE_TYPE, {

		SelectQuery(k_query, h_context, add) {
			//
			let a_mapped_variables = [];

			// prep sparql query chain
			add.body('sparql', 1);

			// map each select target in query to compiled parameter
			let a_selects = k_query.select((k_select) => {

				// by selecting deserialized target
				let z_select = sparql.select(k_select, h_context);

				// select created variable
				if(z_select.map) {
					// add to variable mapping
					a_mapped_variables.push(z_select.map);
				}

				// return selection as code
				return z_select.code;
			});

			// add selections to query
			add.body(`.select([${a_selects.join(',')}])`);

			// map each where target in query to compiled parameter
			let a_wheres = k_query.where((k_where) => {

				// by adding deserialized target
				return sparql.where(k_where, h_context, add);
			});

			// add query supplement
			a_wheres.push(`this.query_supplement || ''`);

			// add where parts to query
			add.body('.where(...[', 1);

			a_wheres.forEach((s_where) => {
				add.body(`${s_where},`);
			});

			add.body('])', -1);

			// claim a variable from context
			let s_vi_rows = h_context.next_script_variable('a_rows');
			let s_vi_row = h_context.next_script_variable('h_row');

			// open asynchronous callback
			add.async(`.dump().rows((${s_vi_rows}) => {`);
			add.body(`if(!${s_vi_rows}.length) return yield_(false);`);
			add.async(`each(${s_vi_rows}, (${s_vi_row}) => {`);

			// now that the query string has been made, destruct new select variables from results
			let s_destruct_body = a_mapped_variables.map((h_variable_map) => {
				return `'${h_variable_map.name}':${h_variable_map.get_id()}`;
			}).join(', ');

			// destruct callback arg
			add.body(`let {${s_destruct_body}} = ${s_vi_row};`);

			// create `self` script variable
			add.body(`// locally-scoped script variable to house the triple resolved by the preceeding query`);
			add.body(`let self = {subject: __subject || this.subject, predicate: this.predicate, object: __object || this.object};`);
		},
	}),

	select: router('sparql.select', F_ROUTE_IS, {

		// variable
		literal(k_literal, h_context) {
			// select target literals can only be variable names
			if('Variable' !== k_literal.$datatype()) {
				local.fail(`select target literal does not have volt:Variable datatype: ${k_literal.$n3()}`);
			}

			// ref variable name
			let s_variable_name = k_literal();

			// variable does not yet exist
			if(!h_context.user_variable_exists(s_variable_name)) {
				// create name extract
				let h_variable_map = h_context.sparql_user_variable(s_variable_name);

				// select sparql variable
				return {
					map: h_variable_map,
					code: `'${s_variable_name}'`,
				};
			}
			// variable already declared prior to query
			else {
				// use existing variable
				return {
					code: sparql.expression(k_literal, h_context),
				};
			}
		},

		// reserved word
		iri(k_iri, h_context) {

			// construct map/code via other routers
			return {
				map: sparql.reserved(k_iri, h_context),
				code: sparql.expression(k_iri, h_context),
			};
		},
	}),

	reserved: router('sparql.reserved', F_ROUTE_VALUE, {

		ThisSubject(k_iri, h_context) {
			return h_context.sparql_user_variable('?_subject');
		},

		ThisPredicate(k_iri, h_context) {
			return h_context.sparql_user_variable('?_predicate');
		},

		ThisObject(k_iri, h_context) {
			return h_context.sparql_user_variable('?_object');
		},
	}),

	expression: router('sparql.expression', F_ROUTE_IS, {

		iri(k_iri, h_context) {
			return sparql.iri(k_iri, h_context);
		},

		literal(k_literal, h_context) {

			// variable
			if('Variable' === k_literal.$datatype()) {
				// ref variable name
				let s_variable_name = k_literal();

				// variable exists in current context
				if(h_context.user_variable_exists(s_variable_name)) {
					// lookup its corresponding variable id
					let s_variable_id = h_context.user_variable_id(s_variable_name);

					// flatten corresponding variable into n3 string
					return `sparql.turtle(${s_variable_id})`;
				}
				// variable does not yet exist
				else {
					return `'${s_variable_name}'`;
				}
			}
			// object intended to be simple literal
			else if('Literal' === k_literal.$datatype()) {
				return k_literal['@value'];
			}
			// typed literal
			else {
				return k_literal['@full'];
			}
		},

		node() {
			debugger;
		},
	}),

	where: router('sparql.where', F_ROUTE_TYPE, {

		BasicGraphPattern(k_block, h_context) {

			let a_triples = k_block.triples((k_triple) => {
				return sparql.triple(k_triple, h_context);
			});

			return `{type:'bgp', triples:[${a_triples.join(',')}]}`;
		},

		Filter(k_block, h_context) {
			return `{type:'filter', expression:${sparql.filter(k_block.expression, h_context)}}`;
		},
	}),

	triple: router('sparql.triple', F_ROUTE_TYPE, {
		Triple(k_triple, h_context) {
			// construct triple as n3 array
			let a_triple = [
				sparql.expression(k_triple.subject, h_context),
				sparql.expression(k_triple.predicate, h_context),
				sparql.expression(k_triple.object, h_context),
			];

			// return as serialized js array
			return `[${a_triple.join(',')}]`;
		},
	}),

	filter: router('sparql.filter', (route, k_expression, h_context) => {

		// expression is literal or iri
		if(k_expression.$is.literal ||k_expression.$is.iri) {
			// solver as entity
			return sparql.expression(k_expression, h_context);
		}

		// otherwise, route type
		route(k_expression.$type());
	}, {

		Operation(k_expression, h_context) {
			let a_join = [
				k_expression.lhs? sparql.expression(k_expression.lhs, h_context): '',
				`'${k_expression.operator()}'`,
				k_expression.rhs? sparql.expression(k_expression.rhs, h_context): '',
			];

			return `[${a_join.join(',')}].join(' ')`;
		},
	}),


	iri: router('sparql.iri', function(route, k_iri) {

		// ref volt:-namespaced symbol
		let s_symbol = k_iri();

		// not a volt-namespaced reserved irir
		if(!s_symbol) {
			return `'<${k_iri['@id']}>'`;
		}

		// special reserved symbol
		route(s_symbol);
	}, {

		ThisSubject(k_iri, h_context) {
			return h_context.this_subject;
		},

		ThisPredicate(k_iri, h_context) {
			return h_context.this_predicate;
		},

		ThisObject(k_iri, h_context) {
			return h_context.this_object;
		},
	}),
};


//
const duties = router_group('duties', F_ROUTE_TYPE, {

	//
	instruction: {

		Assignment(k_assignment, h_context, add) {

			// each assign
			k_assignment('assign', (k_assign) => {

				// form expression
				let h_expression = serialize.expression(k_assign.expression, h_context);

				// expression compiled asynchronous code
				if(h_expression.async.length) {
					h_expression.async.forEach((f_async) => {
						f_async(add);
					});
				}

				// ref compiled code from expression
				let s_code = h_expression.code;

				// ref variable name
				let s_variable_name = k_assign.variable();

				// operator is not direct assignment
				if(2 === k_assign.operator().length) {
					let s_operator = k_assign.operator()[0];
					s_code = `x(${h_context.user_variable_id(s_variable_name)}, '${s_operator}', ${s_code})`;
				}

				// assign value to variable
				h_context.set_user_variable(s_variable_name, s_code, add);
			});
		},

		SelectQuery(k_query, h_context, add) {

			// forward to query builder
			sparql.query(k_query, h_context, add);
		},

		IfThenElse(k_if_then_else, h_context, add) {

			//
			let h_expression = serialize.expression(k_if_then_else.if, h_context);

			// synchronous
			if(!h_expression.async.length) {

				// open if block
				add.body(`if(as.boolean(${h_expression.code})) {`, 1);

				// add if body
				k_if_then_else.then((k_then_instruction) => {
					duties.instruction(k_then_instruction, h_context, add);
				});

				// close if block
				add.body('}', -1);

				// there is an else
				if(k_if_then_else.else) {

					// open else block
					add.body(`else {`, 1);

					// add else body
					k_if_then_else.else((k_else_instruction) => {
						duties.instruction(k_else_instruction, h_context, add);
					});

					// close else block
					add.body(`}`, -1);
				}
			}
			else {
				debugger;
			}
		},

		Yield(k_yield, h_context, add) {

			let h_expression = serialize.expression(k_yield.expression, h_context);

			if(h_expression.async.length) {
				debugger;
			}

			let s_yield_result = h_context.next_script_variable('b_yield');

			add.body(`let ${s_yield_result} = as.boolean(${h_expression.code});`);
			add.body(`if(${s_yield_result}) {`, 1);
			add.body(`return yield_(${s_yield_result}, self);`);
			add.body('}', -1);
		},

		Debugger(k_debugger, h_context, add) {
			add.body('debugger;');
		},
	},
});


//
const serialize = router_group('serialize', (route, k_entity, ...a_rest) => {

	// entity type
	let s_entity_type = k_entity.$is();

	// literal; serialize to javascript
	if('literal' === s_entity_type) {
		return {
			async: [],
			code: build_literal(k_entity, ...a_rest),
		};
	}
	// node
	else if('node' === s_entity_type) {
		route(k_entity.$type());
	}
	// other
	else {
		local.fail(`cannot handle ${s_entity_type} types of entities`);
	}
}, {

	//
	expression: {

		Operation(k_operation, h_context) {

			// ref operator symbol
			let s_operator = k_operation.operator();

			// build lhs and rhs indepedently
			let z_lhs = k_operation.lhs? serialize.expression(k_operation.lhs, h_context): 'null';
			let z_rhs = k_operation.rhs? serialize.expression(k_operation.rhs, h_context): 'null';

			//
			return {
				async: [...z_lhs.async, ...z_rhs.async],
				code: `x(${z_lhs.code}, '${s_operator}', ${z_rhs.code})`,
			};
		},

		FunctionCall(k_function_call, h_context) {
			// prep list of asyncs
			let a_asyncs = [];

			// compile argument expressions
			let a_args = k_function_call.arguments((k_argument) => {
				// ref expression
				let h_expression = serialize.expression(k_argument, h_context);

				// expression has asynchronicity; push to asyncs list
				if(h_expression.async.length) a_asyncs.push(...h_expression.async);

				// extract code from serializer
				return h_expression.code;
			});

			// claim intermediate result variable
			let s_intermediate = h_context.next_script_variable('w_i');

			// return package
			return {
				async: [
					...a_asyncs,
					(add) => {
						add.async(`call('${k_function_call.function['@id']}', [${a_args.join(',')}], (${s_intermediate}) => {`);
					},
				],
				code: s_intermediate,
			};
		},
	},
});


//
const context = () => {
	//
	let h_user_variables = {};
	let h_script_variables = {};

	//
	const mk_user_variable = (s_variable_name) => {

		// ref variable's id
		let s_variable_id = h_user_variables[s_variable_name];

		// variable not declared
		if(!s_variable_id) {

			// create mapping from variable name to compiled alias
			s_variable_id = h_user_variables[s_variable_name] = `_${s_variable_name.replace(/^[^\w\d]+/, '').replace(/[^\w\d]+/g, '_')}`;

			// new variable was created
			return [s_variable_id, true];
		}

		// new variable was not created
		return [s_variable_id, false];
	};


	//
	return {

		//
		this_subject: `'?_subject'`,
		this_predicate: `'?_predicate'`,
		this_object: `'?_object'`,

		//
		next_script_variable(s_variable_name) {

			// no collisions
			if(!h_script_variables.hasOwnProperty(s_variable_name)) {
				// prevent future collisions
				h_script_variables[s_variable_name] = 0;

				// return unclaimed variable name
				return s_variable_name;
			}
			// would-be collisions
			else {
				// create collision-free variable name & advance auto-increment id
				return `${s_variable_name}_${h_script_variables[s_variable_name]++}`;
			}
		},

		//
		user_variable_exists: (s_variable_name) => {
			return h_user_variables.hasOwnProperty(s_variable_name);
		},

		//
		user_variable_id: (s_variable_name) => {

			// variable map has variable
			if(h_user_variables.hasOwnProperty(s_variable_name)) {
				// 
				return h_user_variables[s_variable_name];
			}
			// variable name not found in this map
			else {
				local.fail(`user variable "${s_variable_name}" does not exist in context`);
			}
		},

		// sets a value to a variable
		set_user_variable(s_variable_name, s_value, add) {

			// fetch variable's id
			let [s_variable_id, b_created] = mk_user_variable(s_variable_name);

			// // variable is new
			// if(b_created) {
			// 	// add declaration to head
			// 	add.head(`let ${s_variable_id};`);
			// }

			// add assignment to sync body
			add.body(`${b_created? 'let ': ''}${s_variable_id} = ${s_value};`);
		},

		//
		sparql_user_variable(s_variable_name) {
			// prep variable id
			let s_variable_id;

			//
			return {
				name: s_variable_name.substr(1),
				get_id() {
					if(!s_variable_id) {
						// fetch variable's id
						let [_s_variable_id, b_created] = mk_user_variable(s_variable_name);

						// variable should be new, but it's not
						if(!b_created) {
							local.fail(`asked to create mapping for new user variable '${s_variable_name}' but variable already exists in current context`);
						}

						// set variable id now
						s_variable_id = _s_variable_id;
					}

					// return if
					return s_variable_id;
				},
				toString() {
					return s_variable_name.substr(1);
				},
			};
		},
	};
};


//
const local = classer('builder', function(h_input) {

	let {
		node: k_node,
	} = h_input;

	// destruct nodes under target namespaces
	let {
		volt: k_node_volt,
	} = k_node.$;

	// create new state for this property
	let h_context = context();

	// pretty print: indentation
	let s_indent_chr = '\t';
	let s_indent = s_indent_chr.repeat(1);

	//
	let s_head = '';
	let s_body = '';
	let s_tail = '';

	// each instruction is evaluated in series
	k_node_volt.instructions((k_instruction) => {

		// forward instruction to instruction builder
		duties.instruction(k_instruction, h_context, {
			head(s_add) {
				s_head += s_indent_chr+s_add+'\n';
			},
			body(s_add, n_indent_add=0) {
				// decrease indent before committing this string
				if(n_indent_add < 0) s_indent = s_indent.slice(0, s_indent_chr.length*n_indent_add);

				// commit string
				s_body += s_indent+s_add+'\n';

				// increase indent after adding this string
				if(n_indent_add > 0) s_indent += s_indent_chr.repeat(n_indent_add);

			},
			async(s_open, s_close='});') {
				s_body += s_indent+s_open+'\n';
				s_tail = `${s_indent}${s_close}\n${s_tail}`;
				s_indent += s_indent_chr;
			},
		});
	});

	// final async failure
	s_body += `${s_indent}return yield_(false, self);\n`;

	//
	let s_contents = s_head+s_body+s_tail;

	//
	let h_args = {
		util: evaluator({
			$$: {
				// proxy spaz select call by choosing graphs too
				select(...a_args) {
					return $$.select(...a_args).from(['graph:source', 'graph:reference', 'graph:output']);
				},
			},
		}),
	};

	//
	let a_arg_names = Object.keys(h_args);
	let a_arg_destructs = a_arg_names.map((s_arg_name) => {
		// ref arg struct
		let h_arg_struct = h_args[s_arg_name];

		// build destruct assignment code
		return `let {${
			Object.keys(h_arg_struct).join(', ')
		}} = ${s_arg_name};`;
	});

	let s_whole = `(function(${a_arg_names.join(',')}) {\n`
		+`${a_arg_destructs.map(s => s_indent_chr+s).join('\n')}\n${s_contents}\n})`;

	local.info(s_whole);

	({
		code: s_whole
	} = require('babel-core').transform(s_whole, {
		presets: ['es2015'],
	}));

	let f_property = eval(s_whole);

	//
	return f_property;
});

//
export default local;
