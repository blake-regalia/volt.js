
const H_MANDATORY_PREFIXES = {
	volt: 'http://volt-name.space/ontology/',
	vs: 'http://volt-name.space/ontology/subject',
	vp: 'http://volt-name.space/ontology/predicate',
	vo: 'http://volt-name.space/ontology/object',
	this: 'http://volt-name.space/ontology/This',
	input: 'http://volt-name.space/vocab/input#',
	output: 'http://volt-name.space/vocab/output#',
	rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
	xsd: 'http://www.w3.org/2001/XMLSchema#',
	owl: 'http://www.w3.org/2002/07/owl#',
};

const program = {

	prefixes(h_statement) {
		// ref prefixes
		let h_prefixes = this.prefixes;

		// each prefix line
		h_statement.prefixes.forEach((h_line) => {

			// grab prefix
			let s_prefix = h_line.prefix.slice(0, -1);

			// ref expansion
			let p_expansion = h_line.iri.slice(1, -1);

			// prefix already defined
			if(h_prefixes[s_prefix]) {
				// prefixes are not identical
				if(p_expansion !== h_prefixes[s_prefix]) {
					this.error(`cannot redefine prefix '${h_line.prefix}:'`);
				}
			}
			else {
				h_prefixes[s_prefix] = p_expansion;
			}
		});
	},

	constants(h_statement) {
		// ref program constants hash
		let h_constants = this.constants;

		// each constant
		h_statement.constants.forEach((h_constant) => {

			// ref constant name
			let s_name = h_constant.name;

			// constant already defined
			if(h_constants[s_name]) {
				this.error(`constant already defined: ${s_name} = "${h_constants[s_name]}"; refusing to change value to "${h_constant.value}"`);
			}
			else {
				h_constants[s_name] = h_constant.value;
			}
		});
	},

	injector(h_injector) {
		this.injectors[h_injector.name] = h_injector;
	},

	relation(h_relation) {
		this.body.push(h_relation);
	},



	// // loads trigger statements into program
	// trigger(h_program, h_trigger) {

	// 	//
	// 	h_program.triggers.push(h_trigger);
	// },


	// // loads properties into program
	// property(h_program, h_entity) {

	// 	// ref body statements
	// 	let a_body = h_entity.body;

	// 	// extract top-declarative statements
	// 	for(let i=a_body.length-1; i>=0; i--) {

	// 		// ref statement
	// 		let h_statement = a_body[i];

	// 		// ref statement type
	// 		let s_type = h_statement.type;

	// 		// match top-declarative statements
	// 		switch(s_type) {
	// 			case 'abstract':
	// 			case 'using':
	// 				s_type += '_fields';
	// 			case 'version':

	// 				// remove from body
	// 				a_body.splice(i, 1);

	// 				// move to entity
	// 				h_entity[s_type].unshift(h_statement);
	// 				break;
	// 		}
	// 	}

	// 	// using block exists but entity does not extend anything
	// 	if(h_entity.using_fields.length && !h_entity.extends) {
	// 		h_program.warn(`${h_entity.type} ${h_entity.iri} has a 'using' block but does not extend anything`);
	// 	}

	// 	//
	// 	h_program.body.push(h_entity);
	// },

	// // loads properties block into program
	// properties(h_program, h_properties) {

	// 	// ref modifiers
	// 	let a_modifiers = h_properties.modifiers;

	// 	//
	// 	let a_trigger_properties = [];
	// 	let s_trigger_iri = '';

	// 	//
	// 	h_properties.properties.forEach((h_property) => {

	// 		//
	// 		let s_extends;

	// 		// copy attributes from the properties block onto each individual
	// 		a_modifiers.forEach((h_modifier) => {

	// 			// push extending modifier onto each property
	// 			if('extending' === h_modifier.type) {
	// 				s_extends = h_modifier.iri;
	// 			}
	// 			// add trigger for this property
	// 			else if('triggered_via' === h_modifier.type) {
	// 				a_trigger_properties.push(h_property.iri);
	// 				s_trigger_iri = h_modifier.iri;
	// 			}
	// 		});

	// 		// load the property normally
	// 		program.property(h_program, {
	// 			type: 'property',
	// 			iri: h_property.iri,
	// 			extends: s_extends || '',
	// 			version: [],
	// 			abstract_fields: [],
	// 			using_fields: [],
	// 			body: h_property.body,
	// 		});
	// 	});

	// 	// there was a trigger
	// 	if(s_trigger_iri) {

	// 		// add trigger
	// 		program.trigger(h_program, {
	// 			type: 'trigger',
	// 			iri: s_trigger_iri,
	// 			properties: a_trigger_properties,
	// 		});
	// 	}
	// },

	// // loads methods into program
	// method(h_program, h_entity) {

	// 	//
	// 	h_program.body.push(h_entity);
	// },
};

export default (a_declarations) => {

	// create program structure
	let h_program = {

		// lookups
		prefixes: Object.assign({}, H_MANDATORY_PREFIXES),
		constants: {},
		injectors: {},

		// lists
		triggers: [],
		body: [],

		// debugging
		warnings: [],
		errors: [],
		warn(s_msg) {
			this.warnings.push(s_msg);
		},
		error(s_msg) {
			this.errors.push(s_msg);
		},
	};

	// process each declaration
	a_declarations.forEach((h_declaration) => {
		program[h_declaration.type].apply(h_program, [h_declaration]);
	});

	//
	return h_program;
};
