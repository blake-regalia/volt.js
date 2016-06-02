
// libraries
import classer from 'classer';
import clone from 'clone';
// import rapunzel from 'rapunzel';

// local classes
import parser from './parser';
import router from './router';
import optimizer from './optimizer';
import serializer from './serializer';
import rapunzel from './rapunzel';

//
const _private = Symbol();

/**
* defaults:
**/

const H_DEFAULT_MAKE_PROCEDURE_CONTEXT = {
	needs_resolve: {},
};


// convert a label to camel case
const camel_case = (s_label) => {

	// split label into words
	let a_words = s_label.split(/[^\w]/g);

	// capitalize first letter of each word
	return a_words.map(s => s[0].toUpperCase()+s.substr(1)).join('');
};


const rdf = {
	object_list: (a) => (a.object_list = 1, a),

	string: (h) => `"${h.value.replace(/"/g, '\\"')}"^^xsd:string`,
	variable: (h) => `"${h.id}"^^volt:Variable`,
	operator: (s) => `"${s}"^^volt:Operator`,

	expression(h_expression) {
		debugger;
		return h_expression;
	},

	term: router('rdf.term', 'type', {
		iri: (h) => h.iri,
		number: (h) => h.value,
		string: (h) => rdf.string(h),
		variable: (h) => rdf.variable(h),
		constant: (h, h_program) => rdf.term(h_program.constants[h], h_program),
		operation: (h, h_program) => ({
			a: 'volt:Operation',
			'volt:operator': rdf.operator(h.operator),
			'volt:lhs': rdf.term(h.lhs, h_program),
			'volt:rhs': rdf.term(h.rhs, h_program),
		}),
		function_call: (h, h_program) => ({
			a: 'volt:FunctionCall',
			'volt:function': h.iri,
			'volt:arguments': h.args.map(h_a => rdf.term(h_a, h_program)),
		}),
	}),

	this: router('rdf.this', {
		subject: () => 'this:Subject',
		object: () => 'this:Object',
	}),
};


//
const unparallelizable = router('unparallelizable', 'type', {

	// this statement a function call, must occur by itself
	function_call: () => true,

	// variable
	variable: (h, h_vars) => (h_vars[h.id] = 1, false),
	variable_at: (h, h_vars) => (h_vars[h.id] = 1, false),

	// static data
	number: () => false,
	string: () => false,

	// recurse on left and right terms
	operation: (h, h_vars) => unparallelizable(h.lhs, h_vars) || unparallelizable(h.rhs, h_vars),
});


//
const destruct = router('destruct', 'type', {

	select_variable: (h) => ({
		filters: h.filters || [],
		variable: rdf.variable(h.variable),
	}),
});

//
const graph_pattern = {

	implicit_select: router('graph_pattern', 'expression.type', {

		iri: (h, s_variable) => [{
			a: 'volt:Triple',
			'vs:': rdf.this(h.entity),
			'vp:': h.expression.iri,
			'vo:': s_variable,
		}],
	}),
};

const sparql = {

	query: router('sparql', 'type', {

		implicit_select(h_select, h_program, h_query) {

			//
			let {
				filters: a_filters,
				variable: s_variable,
			} = destruct(h_select.variable);

			// this subject/object needs to be resolved
			if(h_program.context.needs_resolve[h_select.entity]) {
				// select this __
				h_query.selections.push(rdf.this(h_select.entity));

				// mark as resolved
				h_program.context.needs_resolve[h_select.entity] = false;
			}

			// select variable
			h_query.selections.push(s_variable);

			// add filters to query
			h_query.filters.push(...a_filters);

			//
			let a_patterns = graph_pattern.implicit_select(h_select, s_variable, h_program, h_query);

			//
			h_query.bgp.push(...a_patterns);
		},
	}),
};


//
const build = {

	select_query(a_items, h_program) {

		let h_query = {
			selections: [],
			filters: [],
			bgp: [],
		};

		// accumulate each select query fragment
		a_items.map((h_item) => {
			sparql.query(h_item, h_program, h_query);
		});

		// create primary basic graph pattern using triples
		let a_where = [{
			a: 'volt:BasicGraphPattern',
			'volt:triples': h_query.bgp,
		}];

		// add each top-level filter to where
		h_query.filters.forEach((h_filter) => {
			a_where.push({
				a: 'volt:Filter',
				'volt:expression': rdf.term(h_filter, h_program),
			});
		});

		// anti-reflexive
		if(h_program.context.anti_reflexive) {
			// add filter to bgp
			a_where.push({
				a: 'volt:Filter',
				'volt:expression': rdf.term({
					type: 'operation',
					operator: '!=',
					lhs: {
						type: 'iri',
						iri: rdf.this('subject'),
					},
					rhs: {
						type: 'iri',
						iri: rdf.this('object'),
					},
				}),
			});

			// remove anti-reflexive flag
			h_program.context.anti_reflexive = false;
		}

		// bundle into structure fragment
		return {
			a: 'volt:SelectQuery',
			'volt:select': h_query.selections,
			'volt:where': a_where,
		};
	},
};


//
const make = {

	nested(s_rdf_type, f_builder) {
		// make operator
		return (w_item, ...a_args) => (
			Object.assign({
				a: `volt:${camel_case(s_rdf_type)}`,
			}, f_builder(w_item, ...a_args))
		);
	},

	body(a_body, h_program) {
		// create new optimizer context
		let h_context = optimizer.context(h_program);

		debugger;

		// each statement in body
		a_body.forEach((h_statement) => {
			// route statement
			let w_result = volt.statement(h_statement, h_program, h_context);

			// statement returned structure directly, it did not use optimizer
			if(w_result) {
				// close previous, and then append this result
				h_context.close().push(w_result);
			}
		});

		// return structure
		return h_context.close();
	},

	procedure(h_context={}) {
		// make operator
		return (h_procedure, h_program) => {
			// copy-set context on program hash
			h_program = Object.assign({},
				h_program,
				{
					context: Object.assign({},
						H_DEFAULT_MAKE_PROCEDURE_CONTEXT,
						clone(h_context),
						h_procedure.modifiers
					),
				}
			);

			// render procedure structure
			return {
				a: `volt:${camel_case(h_procedure.type)}`,
				'volt:name': h_procedure.iri,
				'volt:instructions': make.body(h_procedure.body, h_program),
			};
		};
	},
};



//
const volt = router.group('volt', 'type', {

	declaration: {

		relation: make.procedure({
			anti_reflexive: true,
			needs_resolve: {
				subject: true,
				object: true,
			},
		}),
	},

	statement: {

		assignment: optimizer('assignment', {

			test(h_assignment, a_items) {
				// prep hash of variables this expression uses
				let h_vars = {};

				// this term's expression is unparallelizable; do not merge this assignment
				if(unparallelizable(h_assignment.expression, h_vars)) return false;

				// if any of the previous statements contain dependent variables, do not merge this assignment
				return !a_items.some((h_item) => {
					// ref variable from item
					let h_variable = h_item.variable;

					// single variable assignment
					if(h_variable.id) {
						// lookup if some variable in current expression depends on this variable found in previous expressions
						return h_vars[h_variable.id];
					}
					else {
						// lookup if one of the variable:ats from previous expression..
						return h_variable.ids.some((s_id) => {
							// is used in current expression
							return h_vars[s_id];
						});
					}
				});
			},

			build: make.nested('assignment', (a_items, h_program) => ({
				'volt:assign': rdf.object_list(
					a_items.map((h_item) => ({
						'volt:variable': rdf.variable(h_item.variable),
						'volt:operator': rdf.operator(h_item.operator),
						'volt:expression': rdf.term(h_item.expression, h_program),
					}))
				),
			})),
		}),

		if: make.nested('if-then-else', (h_if, h_program) => {
			let h = {
				'volt:if': rdf.term(h_if.expression, h_program),
				'volt:then': make.body(h_if.then, h_program),
			};
			if(h.else) {
				h['volt:else'] = make.body(Array.isArray(h_if.else)? h_if.else: [h_if.else], h_program);
			}
			return h;
		}),


		implicit_select: optimizer('select-query', {

			test: (h_item, a_items) => true,

			build: build.select_query,
		}),

		yield: make.nested('yield', (h_yield, h_program) => ({
			'volt:expression': rdf.term(h_yield.expression),
		})),
	},
});



//
class builder {
	constructor(h_program) {
		Object.assign(this, {
			[_private]: h_program
		});
	}

	prologue(add) {

		// add each prefix item
		let h_prefixes = this[_private].prefixes;
		for(let s_prefix in h_prefixes) {
			add(`@prefix ${s_prefix}: <${h_prefixes[s_prefix]}>`);
		}

		// add blankline after prefix block
		add.blank();
	}
}


//
class model_builder extends builder {

	static build_sequence() {
		return ['prologue', 'body'];
	}

	constructor(h_program) {
		super(h_program);
	}

	body(add) {

		// each body statement
		this[_private].body.forEach((h_declaration) => {

			// annotation comment
			add(`# ${
				Object.keys(h_declaration.modifiers).map(s => s+' ').join('')
			}${h_declaration.type} ${h_declaration.iri}`, {close: ''});

			// route declaration
			serializer(
				volt.declaration(h_declaration, this), add
			);
		});
	}
}


/**
* main:
**/
const local = classer('compiler', (h_config) => {

	// destruct config
	let {
		code: s_program,
	} = h_config;

	// prep program hash
	let h_program;

	// parse program
	try {
		h_program = parser.parse(s_program);
	}
	catch(e_parse) {
		return {
			error: e_parse,
		};
	}

	// build model ttl
	let s_model = rapunzel({
		builder: new model_builder(h_program),
		config: {
			closing_delimiter: ' .',
		},
	});

	return {
		model: s_model,
	};
});

export default local;
