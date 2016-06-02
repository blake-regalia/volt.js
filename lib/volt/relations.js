// native imports
import util from 'util';

// third-party libraries
import async from 'async';
import classer from 'classer';
import graphy from 'graphy';

// local classes
import builder from './builder';
import evaluator from './evaluator';



/**
* private static:
**/


/**
* globals:
**/

const h_catalog = {};

const local = classer('relations', (...a_args) => {
	return new relations_inspector(...a_args);
});

/**
* class:
**/

class relations_inspector {

	constructor(h_transfer, f_okay_all) {

		// destruct config
		let {
			$$,
			graphs: h_graphs,
			patterns: k_patterns,
			plugin_router: k_plugin_router,
		} = h_transfer;

		// prep async task queue
		let a_tasks = [];

		//
		Object.assign(this, {
			$$,
			graphs: h_graphs,
			tasks: a_tasks,
			plugin_router: k_plugin_router,
		});

		/**
		* main:
		**/

		// each top-level pattern in graph
		for(let [h_triple, s_subject, s_predicate, s_object] of k_patterns.top_level()) {

			// subject is a blanknode; skip this triple
			if(s_subject.startsWith('_:')) continue;

			// object is a variable or an iri
			if('?' === s_object[0] || $$.isIri(s_object)) {

				// predicate is a variable
				if('?' === s_predicate[0]) {

					// // inspect closure of predicate variable
					// inspect_variable_predicate(h_transfer);
				}
				// predicate is a named thing
				else if($$.isNamedPredicate(s_predicate)) {

					//
					let h_trigger = {
						subject: s_subject,
						predicate: s_predicate,
						object: s_object,
					};

					// subject and object are uris (ie, they are known)
					if($$.isIri(s_subject) && $$.isIri(s_object)) {
						// go async
						a_tasks.push((f_okay_relation) => {

							// so then is this solution already cached?
							$$.ask([s_subject, s_predicate, s_object].map($$.iri))
								.from(h_graphs.content)
								.answer((b_solution_exists) => {

									// solution is not cached; inspect relation
									if(!b_solution_exists) {
										this.inspect_named_predicate(h_trigger);
									}

									// task complete
									return f_okay_relation();
								});
						});
					}
					// subject, object or both are variables; must inspect relation
					else {
						this.inspect_named_predicate(h_trigger);
					}
				}
			}
		}

		// no tasks were added; return immediately
		if(!a_tasks.length) return f_okay_all();

		// otherwise, there are tasks to process
		async.parallel(a_tasks, () => {
			local.good('==== all tasks completed ====');

			// all done
			f_okay_all();
		});
	}

	//
	inspect_named_predicate(h_trigger) {

		// destruct members
		let {
			$$,
			graphs: h_graphs,
			tasks: a_tasks,
		} = this;

		// destruct input
		let {
			subject: s_subject,
			predicate: p_predicate, // relation is known to be absolute uri
			object: s_object,
		} = h_trigger;

		// lookup relation cache already loaded in memory
		let f_relation = h_catalog[p_predicate];

		// relation function needs to be loaded from graph
		if(!f_relation) {
			// go async
			a_tasks.push((f_okay_task) => {

				// discover volt relation by name
				$$.describe('?relation')
					.from(h_graphs.model)
					.where(
						['?relation', {
							a: 'volt:Relation',
							'volt:name': `<${p_predicate}>`,
						}]
					)
					.dump()
					.browse((h_jsonld) => {

						// create graphy instance; then create graphy network in volt: namespace
						graphy(h_jsonld, (k_network) => {

							// ref list of entities at top of graph
							let a_entities = k_network.top(w => w.$('volt:'));

							// no relations were found by this name
							if(!a_entities.length) {
								// complete; short-circuit out of function
								return f_okay_task();
							}
							// more than one relation share same name
							else if(a_entities.length > 1) {
								// cannot resolve uniquely
								return local.fail(`multiple volt relations share the name uri: <${p_predicate}>`);
							}

							// ref relation's graphy node
							let k_relation = a_entities[0];

							// compile into javascript function
							f_relation = builder({
								node: k_relation,
							});

							// save to cache
							h_catalog[p_predicate] = f_relation;

							// excute function
							this.execute(f_relation, h_trigger, f_okay_task);
						});
					});
			});
		}
		// relation cache is available in memory
		else {
			// execute immediately
			a_tasks.push((f_okay_task) => {
				this.execute(f_relation, h_trigger, f_okay_task);
			});
		}
	}

	//
	execute(f_relation, h_trigger, f_okay_relation) {

		// destruct members
		let {
			$$,
			graphs: h_graphs,
			plugin_router: k_plugin_router,
		} = this;

		// args to inject into relation functions at runtime
		let a_injection_args = [
			// util: support functions
			evaluator({
				$$: {
					// proxy spaz select call by choosing graphs too
					select(...a_args) {
						return $$.select(...a_args).from(h_graphs.content);
					},
				},
				plugin_router: k_plugin_router,
			}, (a_yields) => {

				// prep hash to produce unique array of triples
				let h_truths = {};

				// materialize positive results
				a_yields.forEach((h_yield) => {
					if(h_yield.positive) {
						let s_triple = h_yield.triple.map($$.turtle).join(' ');
						h_truths[s_triple] = 1;
					}
				});

				// unique array of truth triples
				let a_truths = Object.keys(h_truths);

				// no positive results
				if(!a_truths.length) {
					// done
					f_okay_relation();
				}
				// yes positive results
				else {
					// insert them into output graph
					$$.insert
						.into(h_graphs.output[0])
						.data(...a_truths)
						.then(() => {
							f_okay_relation();
						});
				}
			}),
		];

		//
		let s_query_supplement = '';

		if($$.isIri(h_trigger.subject)) {
			s_query_supplement += `values ?_subject { ${$$.iri(h_trigger.subject)} }`;
		}

		if($$.isIri(h_trigger.object)) {
			s_query_supplement += `values ?_object { ${$$.iri(h_trigger.subject)} }`;
		}

		//
		f_relation.apply({
			query_supplement: s_query_supplement,
			subject: {type: 'uri', value: h_trigger.subject},
			predicate: {type: 'uri', value: h_trigger.predicate},
			object: {type: 'uri', value: h_trigger.object},
		}, a_injection_args);
	}
}

export default local;
