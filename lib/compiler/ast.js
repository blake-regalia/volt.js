import util from 'util';
import arginfo from 'arginfo';

//
import assembler from './assembler';


//
const H_MATH_OPS = {
	'+': (a, b) => a + b,
	'-': (a, b) => a - b,
	'*': (a, b) => a * b,
	'/': (a, b) => a / b,
};

//
let h_immediate_constants = {};

module.exports = {

	inspect(...a_args) {
		debugger;
		let [z_check] = a_args;
	},

	/**
	* helpers:
	**/

	push(a_list, z_item) {
		a_list.push(z_item);
		return a_list;
	},

	append(a_appendage, a_primary) {
		console.warn(typeof a_primary+': '+a_primary);
		return a_primary.concat(a_appendage);
	},

	merge(h_a, h_b) {
		for(let s_key in h_a) {
			h_b[s_key] = h_a[s_key];
		}
		return h_b;
	},

	option(h_pass, z_if, s_key) {
		if(z_if) h_pass[s_key] = true;
		return h_pass;
	},


	/**
	* main types:
	**/

	Prefixes: (a_prefixes) => ({
		type: 'prefixes',
		prefixes: a_prefixes,
	}),

	Constants(a_constants) {

		a_constants.forEach((h_constant) => {
			h_immediate_constants[h_constant.name] = h_constant.gets;
		});

		console.log(a_constants);

		return {
			type: 'constants',
			constants: a_constants,
		};
	},

	Injector: (s_name, a_params, h_body) => ({
		type: 'injector',
		name: s_name,
		params: a_params,
		body: h_body,
	}),

	Relation: (p_iri, h_body, h_modifiers, p_extends) => ({
		type: 'relation',
		iri: p_iri,
		modifiers: h_modifiers,
		extends: p_extends,
		body: h_body,
	}),


	/**
	* modifiers
	**/

	Modifiers: (h_modifiers) => {
		return {
			modifiers: h_modifiers,
		};
	},


	/**
	* prefixes body
	**/

	Prefix: (s_prefix, p_iri) => ({
		prefix: s_prefix,
		iri: p_iri,
	}),


	/**
	* constants body
	**/

	ConstantAssignment: (s_name, h_value) => ({
		name: s_name,
		gets: h_value,
	}),


	/**
	* relation body
	**/

	Yield: (h_expression) => ({
		type: 'yield',
		expression: h_expression,
	}),

	Return: (h_expression) => ({
		type: 'return',
		expression: h_expression,
	}),


	/**
	* parameters
	**/

	InjectorParameter: (a_modifiers, s_parameter) => ({
		type: 'injector_parameter',
		modifiers: a_modifiers,
		parameter: s_parameter,
	}),

	/**
	* abstract destruct
	**/

	AbstractDestruct: (s_variable, a_assignments) => ({
		type: 'abstract_destruct',
		variable: s_variable,
		assignments: a_assignments,
	}),

	AbstractDestructAssignment: (s_variable, h_filter, h_iri) => ({
		variable: s_variable,
		iri: h_iri,
	}),


	/**
	* assignment statement
	**/

	Assignment: (h_variable, s_operator, h_expression) => ({
		type: 'assignment',
		variable: h_variable,
		operator: s_operator,
		expression: h_expression,
	}),

	VariableDestruct: (s_text, a_labels) => {
		let s_name = s_text.replace(/:\[$/, '');
		return {
			type: 'variable_destruct',
			name: s_name,
			labels: a_labels,
			ids: a_labels.map(s_label => s_name+':'+s_label),
		};
	},

	Variable: (s_name) => ({
		type: 'variable',
		name: s_name,
		id: s_name,
	}),

	VariableAt: (s_text) => {
		let [s_name, s_at] = s_text.split(/:/);
		return {
			type: 'variable_at',
			name: s_name,
			at: s_at,
			id: s_text,
		};
	},


	/**
	* if ... else
	**/

	If: (h_expression, h_then, h_else) => ({
		type: 'if',
		expression: h_expression,
		then: h_then,
		else: h_else,
	}),

	/**
	* implicit select
	**/

	ImplicitSelect: (s_entity, h_variable, h_expression) => ({
		type: 'implicit_select',
		entity: s_entity,
		variable: h_variable,
		expression: h_expression,
	}),

	ImplicitPropertyExpression(h_lhs, h_operation) {
		if(!h_operation) return h_lhs;
		return {
			type: 'property_expression',
			lhs: h_lhs,
			operator: h_operation.operator,
			rhs: h_operation.rhs,
		};
	},

	ImplicitPropertyOperation: (s_operator, h_rhs) => ({
		operator: s_operator,
		rhs: h_rhs,
	}),

	Iri: (p_iri) => ({
		type: 'iri',
		iri: p_iri,
	}),

	JoinerCall: (s_joiner, a_args) => ({
		type: 'joiner_call',
		args: a_args,
	}),


	/**
	* general select
	**/

	SelectVariable: (h_variable, a_filters) => ({
		type: 'select_variable',
		variable: h_variable,
		filters: a_filters,
	}),

	FilterIs: (s_is) => ({
		type: 'filter_is',
		is: s_is,
	}),

	FilterDatatype: (p_iri) => ({
		type: 'filter_datatype',
		datatype: p_iri,
	}),

	FilterConstant: (s_constant) => ({
		type: 'filter_constant',
		constant: s_constant,
	}),

	/**
	* expression
	**/

	Expression(h_lhs, h_operation) {
		// no rhs
		if(!h_operation) return h_lhs;

		// ref rhs
		let h_rhs = h_operation.rhs;

		// ref operator
		let s_operator = h_operation.operator;

		// operation is statically evaluatable
		if(H_MATH_OPS[s_operator]) {

			// lhs is constant
			if('constant' === h_lhs.type) {

				// replace with constant
				h_lhs = h_immediate_constants[h_lhs.value];
			}

			// rhs is constant
			if('constant' === h_rhs.type) {

				// replace with constant
				h_rhs = h_immediate_constants[h_rhs.value];
			}

			// both types are numeric
			if('number' === h_lhs.type && 'number' === h_rhs.type) {

				// execute operation
				return {
					type: 'number',
					value: H_MATH_OPS[s_operator](h_lhs.value, h_rhs.value),
				};
			}
		}

		// build normal lhs/rhs
		return {
			type: 'operation',
			operator: s_operator,
			lhs: h_lhs,
			rhs: h_rhs,
		};
	},

	ExpressionOperation: (s_operator, h_expression) => ({
		operator: s_operator,
		rhs: h_expression,
	}),

	Boolean: (b_value) => ({
		type: 'boolean',
		value: b_value,
	}),

	Constant: (s_name) => ({
		type: 'constant',
		name: s_name,
	}),

	Number: (s_value) => ({
		type: 'number',
		value: parseFloat(s_value),
	}),

	FunctionCall: (p_iri, a_args) => ({
		type: 'function_call',
		iri: p_iri,
		args: a_args,
	}),


	InterpolatedString: (a_parts) => ({
		type: 'interpolated_string',
		parts: a_parts,
	}),


	/**
	* program
	**/

	Program: (a_declarations) => assembler(a_declarations),
};
