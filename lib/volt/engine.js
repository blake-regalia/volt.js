// native includes

// third-party libraries
import async from 'async';
import classer from 'classer';
import graphy from 'graphy';
import spaz from 'spaz';

// local classes
import relations from './relations';
import plugins from './plugins';



/**
* defaults:
**/

// default graph groups
const H_GRAPH_GROUPS = {
	content: ['graph:source', 'graph:reference', 'graph:output'],
	model: ['graph:model', 'graph:reference'],
	output: ['graph:output'],
	fallacy: ['graph:fallacy'],
	solution: ['graph:output', 'graph:fallacy'],
};

// which graphs are unique per each query
const A_UNIQUE_GRAPHS = [
	'input',
	'cache',
];

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
* config:
**/

//
const N_ID_RADIX = 36;



/**
* globals:
**/

// counter tracks unique id for queries
let i_query = 0;



/**
* class:
**/
const local = classer('engine', (h_config={}) => {

	// destruct config arg
	let {
		endpoint: s_endpoint,
		plugins: h_plugins,
	} = h_config;

	// open connection to SPARQL endpoint
	let $$ = spaz({
		engine: {
			endpoint: s_endpoint,
			http_methods: 'post',
		},
		prefixes: Object.assign({}, H_DEFAULT_PREFIXES, h_config.prefixes || {}, H_REQUIRED_PREFIXES),
	});

	// create plugin router
	let k_plugin_router = plugins(h_config.plugins || {}, $$);


	/**
	* operator:
	**/
	return classer.operator((s_sparql, f_okay) => {

		// new query id
		let s_query_id = i_query.toString(N_ID_RADIX);

		// parse sparql query
		let q_input;
		try {
			q_input = $$(s_sparql);
		}
		catch(e) {
			return f_okay({
				error: e+'',
			});
		}

		// extract graph patterns as a structured graph
		let k_patterns = q_input.patterns();

		// create graphs for this query instance; copy defaults
		let h_graphs = {};
		for(let s_key in H_GRAPH_GROUPS) {
			h_graphs[s_key] = H_GRAPH_GROUPS[s_key].slice(0);
		}

		// set unique graphs for this query
		A_UNIQUE_GRAPHS.forEach((s_graph_type) => {
			h_graphs[s_graph_type] = ['graph:'+s_graph_type+'_'+s_query_id];
		});

		// prep transfer hash
		let h_transfer = {
			$$,
			graphs: h_graphs,
			patterns: k_patterns,
			plugin_router: k_plugin_router,
		};

		// step through the query phases in series
		async.series([

			// relations
			(f_next) => {
				relations(h_transfer, () => {
					local.good('all done with relations');
					f_next();
				});
			},
		], () => {

			// all done evaluating phases of query
			local.good('=== all done evaluating phases of input query ===');

			// set the default `from` graphs
			q_input
				// content graphs
				.from(h_graphs.content)
				// input graph
				.from(h_graphs.input);

			// ref query's `order by` conditions
			let a_order = q_input.order();

			// no order clause!
			if(!a_order.length) {
				// execute input query and return results to callback
				return q_input.exec(f_okay);
			}
			// at least one order clause
			else {

				throw 'no order by clause handler yet';
				debugger;
				// // examine each order clause
				// a_order.forEach((h_order) => {

				// 	// clause contains function call
				// 	if(h_order.expression && 'functionCall' === h_order.expression.type) {

				// 		// set resolve to results filter function
				// 		h_transfer.resolve = f_filter_results;

				// 		// set expression
				// 		h_transfer.expression = h_order.expression;

				// 		// set extra args for function call
				// 		h_transfer.extra_args = a_extra_args;

				// 		// evaluate the function call
				// 		solve_query_function_call(h_transfer);
				// 	}
				// });
			}
		});

	}, {

	});
}, {

	/**
	* public static:
	**/

	// lazily load compiler
	compile(...a_args) {
		return require('../compiler/compiler.js').default(...a_args);
	},

});

export default local;
