
import util from 'util';
import classer from 'classer';

const H_PRIMITIVE_DATATYPES_MAP = {
	boolean: 'http://www.w3.org/2001/XMLSchema#boolean',
	number: 'http://www.w3.org/2001/XMLSchema#decimal',
	string: 'http://www.w3.org/2001/XMLSchema#string',
};

//
const P_XSD_IRI = 'http://www.w3.org/2001/XMLSchema#';
const P_XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string';

// primitive datatype unboxers
const H_PARSEABLE_DATATYPES = {
	'http://www.w3.org/2001/XMLSchema#boolean': (a) => 'boolean' === typeof a? a: /^t/i.test(a),
	'http://www.w3.org/2001/XMLSchema#string': (a) => a+'',
	'http://www.w3.org/2001/XMLSchema#decimal': (a) => parseFloat(a),
	'http://www.w3.org/2001/XMLSchema#byte': (a) => parseInt(a),
	'http://www.w3.org/2001/XMLSchema#unsignedByte': (a) => parseInt(a),
	'http://www.w3.org/2001/XMLSchema#short': (a) => parseInt(a),
	'http://www.w3.org/2001/XMLSchema#unsignedShort': (a) => parseInt(a),
	'http://www.w3.org/2001/XMLSchema#long': (a) => parseInt(a),
	'http://www.w3.org/2001/XMLSchema#unsignedLong': (a) => parseInt(a),
	'http://www.w3.org/2001/XMLSchema#int': (a) => parseInt(a),
	'http://www.w3.org/2001/XMLSchema#unsignedInt': (a) => parseInt(a),
	'http://www.w3.org/2001/XMLSchema#integer': (a) => parseInt(a),
	'http://www.w3.org/2001/XMLSchema#positiveInteger': (a) => parseInt(a),
	'http://www.w3.org/2001/XMLSchema#nonPositiveInteger': (a) => parseInt(a),
	'http://www.w3.org/2001/XMLSchema#negativeInteger': (a) => parseInt(a),
	'http://www.w3.org/2001/XMLSchema#nonNegativeInteger': (a) => parseInt(a),
	'http://www.w3.org/2001/XMLSchema#float': (a) => parseFloat(a),
	'http://www.w3.org/2001/XMLSchema#double': (a) => parseFloat(a),
	'http://www.w3.org/2001/XMLSchema#dateTime': (a) => new Date(a),
};

//
const H_XSD_DATATYPE_PRECEDENCE = {
	byte: {up: 'int', level: 5},
	unsignedByte: {up: 'int', level: 5},
	short: {up: 'int', level: 5},
	unsignedShort: {up: 'int', level: 5},
	long: {up: 'integer', level: 4},
	unsignedLong: {up: 'integer', level: 4},
	int: {up: 'integer', level: 4},
	unsignedInt: {up: 'integer', level: 4},
	positiveInteger: {up: 'integer', level: 4},
	nonPositiveInteger: {up: 'integer', level: 4},
	negativeInteger: {up: 'integer', level: 4},
	nonNegativeInteger: {up: 'integer', level: 4},
	integer: {up: 'float', level: 3},
	float: {up: 'double', level: 2},
	double: {up: 'decimal', level: 1},
};

//
const AS_INT = (f_fn) => {
	return (...a_args) => {
		return {
			value: f_fn(...a_args),
			type: 'typed-literal',
			datatype: 'http://www.w3.org/2001/XMLSchema#integer',
		};
	};
};

//
const AS_BOOL = (f_fn) => {
	return (...a_args) => {
		return {
			value: f_fn(...a_args),
			type: 'typed-literal',
			datatype: 'http://www.w3.org/2001/XMLSchema#boolean',
		};
	};
};

const H_NATIVE_OPERATIONS = {
	'+': (a, b) => a + b,
	'-': (a, b) => a - b,
	'*': (a, b) => a * b,
	'/': (a, b) => a / b,
	'%': (a, b) => a % b,
	'&': AS_INT((a, b) => a & b),
	'|': AS_INT((a, b) => a | b),
	'^': AS_INT((a, b) => a ^ b),
	'&&': AS_BOOL((a, b) => a && b),
	'||': AS_BOOL((a, b) => a || b),
	'>': AS_BOOL((a, b) => a > b),
	'<': AS_BOOL((a, b) => a < b),
	'>=': AS_BOOL((a, b) => a >= b),
	'<=': AS_BOOL((a, b) => a <= b),
	'==': AS_BOOL((a, b) => a === b),
	'!=': AS_BOOL((a, b) => a !== b),
	'===': AS_BOOL((a, b, at, bt) => a === b && at === bt),
	'!==': AS_BOOL((a, b, at, bt) => a !== b && at === bt),
};

const H_OPERATIONS = {
	boolean: H_NATIVE_OPERATIONS,
	number: H_NATIVE_OPERATIONS,
	string: {
		'+': (a, b) => a + b,
	},
};

const H_TYPE_COERCION = {
	'boolean/number': H_NATIVE_OPERATIONS,
	'number/string': {
		'+': (a, b) => a + b,
		'*': (a, b, n, s) => s.repeat(n),
		// '/': (a, b, n, s) => s.length
	},
};


const type_value = (z_it) => {

	// ref javascript datatype
	let s_type = typeof z_it;

	// primitive
	if(H_PRIMITIVE_DATATYPES_MAP[s_type]) {
		// convert into ld equivalent
		return [H_PRIMITIVE_DATATYPES_MAP[s_type], z_it];
	}
	// non-primitive
	else {
		// sparql entity
		if('object' === s_type) {

			// literal
			if('typed-literal' === z_it.type) {
				// ref datatype iri
				let p_datatype = z_it.datatype;

				// lookup if parseable datatype
				let f_parser = H_PARSEABLE_DATATYPES[p_datatype];

				// datatype is parseable
				if(f_parser) {
					// return with parsed value
					return [p_datatype, f_parser(z_it.value)];
				}
				// datatype not parseable
				else {
					// return with value as string
					return [p_datatype, z_it.value];
				}
			}
			else {
				local.fail(`cannot handle ${z_it.type} types of entities, only typed-literals`);
			}
		}
		// other
		else {
			local.fail(`should not be encountering ${s_type} value in expression evaluation: ${z_it}`);
		}
	}
};

//
const as_literal = (w_value, p_type_a, p_type_b) => {
	// type has already been decided
	if('object' === typeof w_value && w_value.datatype) {
		return w_value;
	}

	// start with a's type
	let p_negotiated_datatype = p_type_a;

	// b has different type
	if(p_negotiated_datatype !== p_type_b) {
		// both are xsd
		if(p_type_a.startsWith(P_XSD_IRI) && p_type_b.startsWith(P_XSD_IRI)) {
			// extract type from suffix of datatype iri
			let s_type_a = p_type_a.substr(P_XSD_IRI.length);
			let s_type_b = p_type_b.substr(P_XSD_IRI.length);

			// lookup their precedence level
			let n_level_a = H_XSD_DATATYPE_PRECEDENCE.hasOwnProperty(s_type_a)? H_XSD_DATATYPE_PRECEDENCE[s_type_a].level: 0;
			let n_level_b = H_XSD_DATATYPE_PRECEDENCE.hasOwnProperty(s_type_b)? H_XSD_DATATYPE_PRECEDENCE[s_type_b].level: 0;

			// negotiate highest fair level
			let n_target_level = Math.min(n_level_a, n_level_b);

			// iterate up until they are at the same level
			while(n_level_a > n_target_level) {
				s_type_a = H_XSD_DATATYPE_PRECEDENCE[s_type_a].up;
				n_level_a = H_XSD_DATATYPE_PRECEDENCE.hasOwnProperty(s_type_a)? H_XSD_DATATYPE_PRECEDENCE[s_type_a].level: 0;
			}
			while(n_level_b > n_target_level) {
				s_type_b = H_XSD_DATATYPE_PRECEDENCE[s_type_b].up;
				n_level_b = H_XSD_DATATYPE_PRECEDENCE.hasOwnProperty(s_type_b)? H_XSD_DATATYPE_PRECEDENCE[s_type_b].level: 0;
			}

			// iterate up until they are the same type
			while(s_type_a !== s_type_b && n_target_level > 0) {
				let h_link_a = H_XSD_DATATYPE_PRECEDENCE[s_type_a];
				n_target_level = h_link_a.level;
				s_type_a = h_link_a.up;
				s_type_b = H_XSD_DATATYPE_PRECEDENCE[s_type_b].up;
			}

			// datatypes still not the same
			if(s_type_a !== s_type_b) {
				local.fail(`failed to negotiate types`);
			}

			// render this as negotiated datatype
			p_negotiated_datatype = P_XSD_IRI+s_type_a;
		}
		else {
			local.fail(`failed to negotiate non-xsd datatypes <${p_type_a}> and <${p_type_b}>`);
		}
	}

	//
	return {
		value: w_value,
		type: 'typed-literal',
		datatype: p_negotiated_datatype,
	};
};


/**
* class:
**/
const local = classer('evaluator', (h_config, f_okay) => {

	//
	let {
		$$,
		plugin_router: k_plugin_router,
	} = h_config;

	//
	let n_expected_yields = 1;
	let a_yields = [];

	// 
	const h_helpers = {

		// evaluate an expression using an operator symbol
		x(z_lhs, s_operator, z_rhs) {

			// get type and value of each term
			let [p_lhs_type, z_lhs_value] = type_value(z_lhs);
			let [p_rhs_type, z_rhs_value] = type_value(z_rhs);

			// ref lhs javascript type
			let s_lhs_js_type = typeof z_lhs_value;
			let s_rhs_js_type = typeof z_rhs_value;

			// values are compatible for the same operation
			if(s_lhs_js_type === s_rhs_js_type) {
				// ensure they are not strings while datatypes are not xsd:string
				if('string' !== s_lhs_js_type || P_XSD_STRING === p_lhs_type) {
					// ref operation group
					let h_operation_group = H_OPERATIONS[s_lhs_js_type];

					// no such group?!
					if(!h_operation_group) {
						local.fail(`no operations can be performed on ${s_lhs_js_type} types`);
					}

					// lookup operation based on type
					let f_operation = h_operation_group[s_operator];

					// no such operation
					if(!f_operation) {
						local.fail(`no such operation '${s_operator}' exists between values of types ${s_lhs_js_type}`);
					}

					// execute operation
					let w_value = f_operation(z_lhs_value, z_rhs_value, p_lhs_type, p_rhs_type);

					// create literal
					return as_literal(w_value, p_lhs_type, p_rhs_type);
				}
			}

			local.fail('mixed type operations not yet supported');
		},

		// evaluate a function call asynchronously
		call(p_function, a_args, f_okay_call) {

			// let plugin router handle it
			k_plugin_router(p_function, a_args, (w_result) => {

				// pass result to callback
				f_okay_call(w_result);
			});
		},

		// evaluate truthiness of value as boolean
		as: {
			boolean(z_value) {
				// already a primitive
				if('boolean' === typeof z_value) {
					return z_value;
				}
				// sparql literal
				else if('object' === typeof z_value) {
					// parse the value to javascript equivalent
					let [, z_parsed_value] = type_value(z_value);

					// truthiness
					return !!z_parsed_value;
				}
				// other
				else {
					local.fail(`failed to cast ${typeof z_value} value to boolean: ${z_value}`);
				}
			},
		},

		//
		sparql: $$,

		//
		yield_(b_positive, h_triple) {

			// save yield result to list
			a_yields.push({
				positive: b_positive,
				triple: h_triple && [h_triple.subject, h_triple.predicate, h_triple.object],
			});

			// this is the last yield
			if(n_expected_yields === a_yields.length) {

				// return results to callback
				f_okay(a_yields);
			}
		},

		// traverse each item in list and account for increased number of yields
		each(a_list, f_each) {

			// the number of expected yields multiplies with each new for-each loop
			n_expected_yields *= a_list.length;

			// apply iteration
			a_list.forEach(f_each);
		},
	};

	//
	return h_helpers;
}, {

	/**
	* public static:
	**/

	destruct(s_arg_name) {
		// create dummy object
		let k_dummy = local();

		// use hash to create destruct string
		return `let {${Object.keys(k_dummy).join(', ')}} = ${s_arg_name};`;
	},
});

export default local;
