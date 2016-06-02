/**
* import:
**/

// libraries
import async from 'async';
import arginfo from 'arginfo';
import classer from 'classer';
import clone from 'clone';
import clc from 'cli-color';
import graphy from 'graphy';
import merge from 'merge';
import spaz from 'spaz';
// import emoji from 'node-emoji';

// local classes
// import volt_values from './volt-values.js';
// import volt_subqueries from './volt-subqueries.js';
// import volt_properties from './volt-properties.js';
// import volt_methods from './volt-methods.js';

import properties from './properties';
import plugins from './plugins';


/**
* private static:
**/

// creates a colorized terminal string of the given spaz query builder; for debugging purposes
const sparql_str = (q_query) => {
	let s_sparql = q_query.toSparql({meaty: true, indent: '    '});
	s_sparql = s_sparql.replace(/^|\n/g, '\n  ');
	return clc.cyan(s_sparql);
};

//
const A_UNIQUE_GRAPHS = [
	'input',
	'cache',
];

//
const H_GRAPHS = {
	content: ['graph:source', 'graph:reference', 'graph:output'],
	model: ['graph:model', 'graph:reference'],
	output: ['graph:output'],
	fallacy: ['graph:fallacy'],
	solution: ['graph:output', 'graph:fallacy'],
};

//
let i_query_uuid = 0;
const next_query_uuid = () => {
	return i_query_uuid++;
};

//
let h_issues = {};
const issue = (s_err) => {
	if(!h_issues[s_err]) {
		h_issues[s_err] = 1;
	}
	else {
		h_issues[s_err] += 1;
	}
};


// prefixes to load into spaz by default
const H_DEFAULT_PREFIXES = {
	'': 'vocab://local/',

	unit: 'http://qudt.org/vocab/unit#',
	qudt: 'http://qudt.org/schema/qudt#',
};

// prefixes reserved and used by volt, mandatory for n3 queries
const H_REQUIRED_PREFIXES = {
	graph: 'graph://',
	volt: 'http://volt-name.space/ontology/',
	input: 'http://volt-name.space/vocab/input#',
	output: 'http://volt-name.space/vocab/output#',
	stko: 'http://stko.geog.ucsb.edu/vocab/',
};


/**
* class
**/
const local = classer('Volt', function(h_config) {

	/**
	* private:
	**/

	let k_plugin_router = {};

	// argument type-checking
	(() => {
		if('object' !== typeof h_config) {
			local.fail('constructor\'s config argument must be [object]. instead got: '+arginfo(h_config));
		}
		if('string' !== typeof h_config.endpoint) {
			local.fail('constructor\'s config.endpoint argument must be [string]. instead got: '+arginfo(h_config));
		}
	})();

	// open abstract connection to SPARQL endpoint
	let $$ = spaz({
		engine: {
			endpoint: h_config.endpoint,
			http_methods: 'post',
		},
		prefixes: merge(
			H_DEFAULT_PREFIXES,
			h_config.prefixes || {},
			H_REQUIRED_PREFIXES
		),
	});


	// plugins are present
	if(h_config.plugins) {

		// load plugins (create plugin router)
		k_plugin_router = plugins(h_config.plugins, {
			$$, // pass spaz instance
		});
	}


	// 
	const execute_function_call = (s_function, a_args, h_row, f_okay_call) => {

		//
		let a_input_args = a_args.map($$.rabbit).map((h_arg) => {
			if('variable' === h_arg.type) {

				// ref var name
				let s_var = h_arg.name;

				if(h_row.hasOwnProperty(s_var)) {
					return h_row[s_var];
				}
				else {
					local.fail('variable not defined: '+s_var);
				}
			}
		});

		//
		k_plugin_router(s_function, a_input_args, (s_err, h_result) => {
			local.warn('function call returned');
			if(s_err) {
				local.fail(s_err);
			}
			else {
				f_okay_call(h_result, a_input_args);
			}
		});
	};


	//
	const solve_query_function_call = (h_opt) => {

		// destruct options arg hash
		let {
			expression: h_expr,
			graphs: w_graphs,
			input_query: q_input,
			resolve: f_results,
			extra_args: a_extra_args,
		} = h_opt;

		// extract limit / offset
		let n_limit = q_input.limit();
		let n_offset = q_input.offset();

		// extract select variables
		let w_select = q_input.select(true);

		// reset affected clauses
		q_input.order.clear();

		// set limit / offset
		q_input.limit(0);
		q_input.offset(0);

		// execute input query; collect all results
		q_input.select('*').rows(function(a_results) {

			//
			local.info('input query: '+sparql_str(this)+' => '+arginfo(a_results));

			// no results
			if(!a_results.length) {

				// callback immediately
				f_results(a_results);

				// don't bother ordering empty resutls
				return;
			}

			// prepare list of tasks
			let a_tasks = [];

			// each result
			a_results.forEach((h_row) => {

				// create new task
				a_tasks.push((f_okay_task) => {

					// evaluate function call on these args
					execute_function_call(h_expr.function, h_expr.args, h_row, (z_return_value, a_input_args) => {

						// insert results
						let q_function_eval = $$.insert
							.into(w_graphs.cache[0])
							.data({
								a: 'volt:FunctionCall',
								'volt:function': '<'+h_expr.function+'>',
								'volt:arguments': $$.list(a_input_args),
								'volt:returned': $$.val(z_return_value),
							});

						local.info('function eval "'+h_expr.function+'"\n'+sparql_str(q_function_eval));

						q_function_eval.then(() => {
							f_okay_task(null);
						});
					});
				});

				local.good(a_tasks.length+' function call tasks');
			});

			// execute tasks in parallel
			async.parallel(a_tasks, () => {

				local.good('sample result value: '+arginfo(a_results[0]));

				// once all tasks complete, do query to order by return value
				let q_order = $$.select(w_select)
					.from(w_graphs.cache[0])
					.where({
						a: 'volt:FunctionCall',
						'volt:function': '<'+h_expr.function+'>',
						'volt:arguments': $$.list(h_expr.args),
						'volt:returned': '?returnValue',
					})
					.values(a_results)
					.order('?returnValue')
					.limit(n_limit)
					.offset(n_offset);

				// output query before execution
				local.info('order query: '+sparql_str(q_order));

				// execute
				q_order
					.rows((h_result) => {

						// clear cache graph
						$$.silently.drop.graph(w_graphs.cache[0]);

						// send back results
						f_results(h_result);
					});
			});
		});
	};

	//
	const execute_methods = (q_input, k_patterns, f_okay_methods) => {
		f_okay_methods();
	};

	//
	const execute_input_query = (h_transfer, f_results, a_extra_args) => {

		// destruct transfer object
		let {
			graphs: w_graphs,
			input_query: q_input,
			query_uuid: s_query_uuid,
			input_mapping: h_input_mapping,
		} = h_transfer;

		//
		local.info('fixing input mappings on input query: '+sparql_str(q_input));

		// each input iri in input mapping
		for(let p_input_iri in h_input_mapping) {
			let h_input = h_input_mapping[p_input_iri];

			// recreate original variable
			let s_variable = '?'+h_input.field;

			// replace substitute iri with variable
			q_input.where.replace(p_input_iri, h_input.n3);

			// // plugin a values block for this mapping
			// q_input.values(s_variable, [$$.iri(p_input_iri)]);
		}

		//
		local.warn('executing input query: '+sparql_str(q_input));

		// execute no matter the type; forward response to waiter
		q_input.exec(f_results);


		// // input query type: ASK
		// if('ask' === q_input.query_type) {

		// 	//
		// 	q_input.answer(f_results, ...a_extra_args);
		// }
		// // input query type: SELECT
		// if('select' === q_input.query_type) {

		// 	//
		// 	q_input.rows(f_results, ...a_extra_args);
		// }
		// // input query type: DESCRIBE
		// if('describe' === q_input.query_type) {

		// 	//
		// 	q_input.browse(f_results, ...a_extra_args);
		// }
	};


	//
	const query_from_sparql = (s_query_uuid, s_input_query, f_results, ...a_extra_args) => {

		// 
		let q_input;

		// instantiate query builder on input in order to extract query patterns
		try {
			q_input = $$(s_input_query);
		}
		catch(e) {
			f_results({
				error: e+'',
			});
			return;
		}

		//
		query_from_spaz_node(s_query_uuid, q_input, f_results, ...a_extra_args);
	};


	//
	const query_from_spaz_node = (s_query_uuid, q_input, f_results, ...a_extra_args) => {

		// adds additional info to certain result types
		let f_filter_results = (h_results) => {

			// select query
			if(h_results.results) {

				// inspect bindings
				let a_bindings = h_results.results.bindings;
				if(Array.isArray(a_bindings)) {

					// each row
					a_bindings.forEach((h_row) => {

						// each field in row
						for(let s_var in h_row) {
							let h_field = h_row[s_var];

							// depending on n3 type
							switch(h_field.type) {

								// iri
								case 'uri':
									// include `.terse` property
									h_field.terse = q_input.shorten(h_field.value);
									break;
							}
						}
					});
				}
			}

			// return results
			f_results(h_results);
		};

		// get a proxy to the graph patterns as a structured graph
		let k_patterns = q_input.patterns();

		// create graphs for this query instance; use clone of defaults
		let w_graphs = clone(H_GRAPHS, false);

		// set unique graphs for this query
		A_UNIQUE_GRAPHS.forEach((s_graph_type) => {
			w_graphs[s_graph_type] = ['graph:'+s_graph_type+'_'+s_query_uuid];
		});

		// prepare boiler-plate transfer object
		let h_transfer = {
			$$,
			graphs: w_graphs,
			plugin_router: k_plugin_router,
			input_query: q_input,
			patterns: k_patterns,
			query_uuid: s_query_uuid,
			input_mapping: {},
		};

		// execute order of operations on input patterns
		async.series([

			// // values interceptor
			// (f_okay_task) => {

			// 	// set resolve callback
			// 	h_transfer.resolve = f_okay_task;

			// 	// execute interceptor
			// 	volt_values(h_transfer);
			// },

			// // subquery interceptor
			// (f_okay_task) => {

			// 	// set resolve callback
			// 	h_transfer.resolve = f_okay_task;

			// 	// execute interceptor
			// 	volt_subqueries(h_transfer);
			// },

			// properties
			(f_okay_task) => {

				// set resolve callback
				h_transfer.resolve = f_okay_task;

				// execute properties
				new properties(h_transfer);
			},

			// // methods
			// (f_okay_task) => {

			// 	// set resolve callback
			// 	h_transfer.resolve = f_okay_task;

			// 	// execute methods
			// 	volt_methods(h_transfer);
			// },
		], (h_err) => {

			local.log('=== all series tasks completed ===');

			// set the default from graphs
			q_input
				// content graphs
				.from(w_graphs.content)
				// input graph
				.from(w_graphs.input);

			// ref order conditions
			let a_order = q_input.order();

			// no order clause!
			if(!a_order.length) {
				execute_input_query(h_transfer, f_filter_results, a_extra_args);
			}
			// at least one order clause
			else {

				// examine each order clause
				a_order.forEach((h_order) => {

					// clause contains function call
					if(h_order.expression && 'functionCall' === h_order.expression.type) {

						// set resolve to results filter function
						h_transfer.resolve = f_filter_results;

						// set expression
						h_transfer.expression = h_order.expression;

						// set extra args for function call
						h_transfer.extra_args = a_extra_args;

						// evaluate the function call
						solve_query_function_call(h_transfer);
					}
				});
			}
		});
	};


	/**
	* public operator():
	**/

	// parse a SPARQL string and return a query-builder
	return classer.operator(function(...a_args) {
		return query_from_sparql(next_query_uuid(), ...a_args);
	}, {
		// clear input graph
		reset() {
			$$.silently.drop.graph('graph:input_0');
		},
	});
}, {
	/**
	* public static:
	**/

});


export default local;
