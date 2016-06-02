/* ------------------------ */
/* abstract syntax tree functions */
/* ------------------------ */
%{

	var ast = require('./ast.js');

	// copy all abstract syntax tree constructors onto global scope object
	for(var s_thing in ast) {
		global[s_thing] = ast[s_thing];
	}
%}


/* ------------------------ */
/* operators & precedence */
/* ------------------------ */

%left '>' '<' '>=' '<=' '!=' '=='
%left '+' '-'
%left '*' '/'
%left '^'


%start grammar

/* enable EBNF grammar syntax */
%ebnf

%%
/* ------------------------ */
/* language grammar */
/* ------------------------ */

grammar
	: declaration* EOF
		{ return Program($1) }
	;

declaration
	: prefixes
	| constants
	| injector
	| function
	| relation
	;


/* ------------------------ */
/* main types */
/* ------------------------ */

prefixes
	: PREFIXES prefixes_body -> Prefixes($prefixes_body)
	;

constants
	: CONSTANTS constants_body -> Constants($2)
	;

injector
	: INJECTOR INLINE injector_parameters '{' injector_body '}' -> Injector($INLINE, $injector_parameters, $injector_body)
	;

function
	: FUNCTION
	;

relation
	: relation_modifiers RELATION iri (extends)? relation_body -> Relation($iri, $relation_body, $relation_modifiers, $4)
	;


/* ------------------------ */
/* modifiers
/* ------------------------ */

extends
	: EXTENDS iri -> $iri
	;

relation_modifiers
	: ABSTRACT? -> Modifiers({abstract: $1})
	;



/* ------------------------ */
/* prefixes body
/* ------------------------ */
prefixes_body
	: prefix_statement -> [$1]
	| '{' prefix_statement* '}' -> $2
	;

prefix_statement
	: PREFIXED_NAME IRIREF ';' -> Prefix($PREFIXED_NAME, $IRIREF)
	;


/* ------------------------ */
/* constants body
/* ------------------------ */
constants_body
	: '{' constant_assignment* '}' -> $2
	;

constant_assignment
	: CONSTANT '=' assignment_value ';' -> ConstantAssignment($CONSTANT, $assignment_value)
	;

assignment_value
	: expression
	;


/* ------------------------ */
/* injector body
/* ------------------------ */
injector_body
	: injector_statement*
	;

injector_statement
	: RETURN expression ';' -> Return($expression)
	;


/* ------------------------ */
/* relation body
/* ------------------------ */
relation_body
	: '{' relation_statement* '}' -> $2
	;

relation_statement
	: assignment
	| abstract_destruct
	| relation_if
	| implicit_select
	| YIELD expression ';' -> Yield($expression)
	;


/* ------------------------ */
/* parameters
/* ------------------------ */
parameters
	: '(' (VARIABLE ',')* VARIABLE? ')' -> push($2, $3)
	;

injector_parameters
	: '(' (injector_parameter ',')* injector_parameter ')' -> push($2, $3)
	;

injector_parameter
	: injector_parameter_modifier* VARIABLE -> InjectorParameter($1, $2)
	;

injector_parameter_modifier
	: SINGLE
	;


/* ------------------------ */
/* statements
/* ------------------------ */

/* ------------------------ */
/* abstract destruct
/* ------------------------ */
abstract_destruct
	: ABSTRACT VARIABLE '{' abstract_destruct_assignment* '}' -> AbstractDestruct($VARIABLE, $4)
	;

abstract_destruct_assignment
	: variable variable_filter? '=' iri ';' -> AbstractDestructAssignment($variable, $2, $iri)
	;

/* ------------------------ */
/* assignment statement
/* ------------------------ */
assignment
	: variable_gets assignment_operator expression ';' -> Assignment($1, $2, $3)
	;

assignment_operator
	: '=' | '+=' | '-=' | '*=' | '/=' | '%=' | '&=' | '|='
	;

variable_gets
	: variable
	| VARIABLE_DESTRUCT WORD? word_more* ']' -> VariableDestruct($VARIABLE_DESTRUCT, push($WORD, $word_more))
	;

word_more
	: ',' WORD? -> $WORD
	;


variable
	: VARIABLE -> Variable($VARIABLE)
	| VARIABLE_AT -> VariableAt($VARIABLE_AT)
	;


/* ------------------------ */
/* if ... else
/* ------------------------ */
relation_if
	: IF expression relation_body relation_else? -> If($2, $3, $4)
	;

relation_else
	: ELSE (relation_if | relation_body) -> $2
	;

/* ------------------------ */
/* implicit select
/* ------------------------ */
implicit_select
	: (SUBJECT | OBJECT)[entity] select_variable '=' implicit_property_expression ';'
		-> ImplicitSelect($entity, $select_variable, $implicit_property_expression)
	;

implicit_property_expression
	: implicit_property_value implicit_property_operation?
		-> ImplicitPropertyExpression($1, $2)
		/*-> inspect($1, $2)*/
	;

implicit_property_operation
	: implicit_property_operator implicit_property_expression -> ImplicitPropertyOperation($1, $2)
	;

implicit_property_operator
	: UNION -> 'union'
	| ','-> 'else'
	;

implicit_property_value
	: iri -> Iri($iri)
	| INLINE '(' (implicit_property_value ',')* implicit_property_value ')' -> JoinerCall($INLINE, push($3, $4))
	;


/* ------------------------ */
/* general select
/* ------------------------ */
select_variable
	: variable variable_filter? -> SelectVariable($variable, $2)
	;

variable_filter
	: '(' (filter ',')* filter ')' -> push($2, $3)
	;

filter
	: filter_is -> FilterIs($filter_is)
	| '^^' iri -> FilterDatatype($iri)
	| CONSTANT -> FilterConstant($CONSTANT)
	;

filter_is
	: 'IRI' | 'NUMERIC' | 'LITERAL' | 'STRING' | 'BLANKNODE'
	;

filter_more
	: ',' filter -> $filter
	;



/* ------------------------ */
/* expression
/* ------------------------ */
expression
	: expression_value expression_operation? -> Expression($1, $2)
	;

expression_operation
	: expression_operator expression -> ExpressionOperation($1, $2)
	;

expression_value
	: common_value
	| '(' expression ')' -> $expression
	;

expression_operator
	: '+' | '-' | '*' | '/' | '&&' | '||' | '==' | '!=' | '>' | '<' | '>=' | '<='
	;

expression_iri
	: iri function_call_args? -> $2? FunctionCall($1, $2): Iri($iri)
	;

function_call_args
	: '(' (expression ',')* expression? ')' -> push($2, $3)
	;



/* ------------------------ */
/* return
/* ------------------------ */



/* ------------------------ */
/* common values
/* ------------------------ */

common_value
	: variable
	| interpolated_string
	| expression_iri
	| constant
	| number
	| boolean
	;

constant: CONSTANT -> Constant($1)
	;

number
	: NUMBER -> Number($1)
	| PI -> Number(Math.PI)
	| TAU -> Number(Math.PI * 2)
	;

boolean
	: TRUE -> Boolean(true)
	| FALSE -> Boolean(false)
	;

interpolated_string
	: '`' interpolated_string_part* '`' -> InterpolatedString($2)
	;

interpolated_string_part
	: STRING
	| '${' interpolated_string_expression '}' -> $2
	;

interpolated_string_expression
	: variable
	| 'FUNCTION_CALL(' (interpolated_string_expression ',')* interpolated_string_expression? ')'
	;



/****       TERMINAL PROXIES       ****/


iri
	: IRIREF
	| PREFIXED_NAME
	;

quoted_string
	: SINGLE_QUOTED_STRING -> $1.slice(1, -1)
	| DOUBLE_QUOTED_STRING -> $1.slice(1, -1)
	;
