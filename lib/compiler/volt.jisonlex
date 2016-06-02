
/* ------------------------ */
/* regular expressions */
/* ------------------------ */

numeric			[+-]?((\d+(\.\d*)?)|(\.\d+))
alphanum_u		[A-Za-z_0-9]
word 			{alphanum_u}+

prefix 			[A-Za-z](({alphanum_u}|[.\-])*{alphanum_u})?
postfix			{alphanum_u}|[:]|%[A-Fa-f0-9]{2}|\\[_~.\-!$&'()*+,;=/?#@%]

variable 		[?]{word}
constant 		[$]{word}
inline 			[&]{word}

regex 			[~][/](?:[^/\n\\]|\\.)+[/][a-z]*

iriref 			[<]([^<>"{}|^` \t\n\\\u0000-\u0020])+[>]


ident			[?][A-Za-z_\u00c0-\u024f][A-Za-z_0-9\$\u00c0-\u024f]*

pname 			{prefix}?[:]({postfix}({postfix}|".")*{postfix}?)?

single_quoted_string 	['](?:[^'\\]|\\.)*[']
double_quoted_string 	["](?:[^"\\]|\\.)*["]


%s block destruct backtick interpolate

%options flex

%%
/* ------------------------ */
/* lexical vocabulary */
/* ------------------------ */



<block>\s*\n+\s* 		{} /* return '\n' */
<block>"}"				this.popState(); return '}'

<destruct>{word}		return 'WORD'
<destruct>","			return ','
<destruct>"]"			this.popState(); return ']'
<destruct>.				return 'INVALID'

<backtick>"${"			this.pushState('interpolate'); return '${';
<backtick>"`"			this.popState(); return '`'
<backtick>"\\`"			return 'STRING'
<backtick>"$"			return 'STRING'
<backtick>[^`$]*		return 'STRING'

<interpolate>"}"					this.popState(); return '}'
<interpolate>{variable}				return 'VARIABLE'
<interpolate>{variable}":"{word} 	return 'VARIABLE_AT'
<interpolate>{word}"("				return 'FUNCTION_CALL('
<interpolate>")"					return ')'
<interpolate>","					return ','
<interpolate>\s+					{ /*ignore ws*/ }
<interpolate>.						return 'INVALID'

\s+				{ /* skip whitespace */ }
// \n+	{ /* skip newlines */ }

[#][^\n]*\n		{ /* ignore line comments */ }
[#][^\n]*$		{ return 'EOF'; }
"/*"[^]*?"*/" 	{ /* ignore block comments */ }

/* ------------------------ */
/* top-level statement keywords  */
/* ------------------------ */
/*"prefix"		return 'PREFIX'
"constant" 		return 'CONSTANT'*/


/* ------------------------ */
/* top-level cluster keywords */
/* ------------------------ */

"prefixes"		return 'PREFIXES'
"constants" 	return 'CONSTANTS'


/* ------------------------ */
/* type modifiers  */
/* ------------------------ */

"abstract"		return 'ABSTRACT'
/*"transitive"	return 'TRANSITIVE'*/


/* ------------------------ */
/* type keywords */
/* ------------------------ */

"injector"		return 'INJECTOR'
"function"		return 'FUNCTION'
"relation"		return 'RELATION'



/*"alias"			return 'ALIAS'*/


/* ------------------------ */
/* block relations */
/* ------------------------ */

/*"extends"		return 'EXTENDS'*/
/*"extending"		return 'EXTENDING'*/


/* ------------------------ */
/* mode triggers */
/* ------------------------ */


/* ------------------------ */
/* body keywords */
/* ------------------------ */

"super"			return 'SUPER'

"subject"		return 'SUBJECT'
"object"		return 'OBJECT'

"if"			return 'IF'
"else"			return 'ELSE'

"return"		return 'RETURN'
"yield"			return 'YIELD'

/*"input"			return 'INPUT'*/
/*"output"		return 'OUTPUT'*/


/* ------------------------ */
/* query keywords */
/* ------------------------ */

"this"				return 'THIS'


/* ------------------------ */
/* query/expression types */
/* ------------------------ */

{iriref}			return 'IRIREF'
{pname}				return 'PREFIXED_NAME'

{variable}			return 'VARIABLE'
{variable}":"{word} return 'VARIABLE_AT'
{variable}":["		this.begin('destruct'); return 'VARIABLE_DESTRUCT'

{constant}			return 'CONSTANT'
{inline}			return 'INLINE'

{single_quoted_string}	return 'SINGLE_QUOTED_STRING'
{double_quoted_string}	return 'DOUBLE_QUOTED_STRING'
"`"						this.begin('backtick'); return '`'

{regex}				return 'REGULAR_EXPRESSION'

{numeric}		return 'NUMBER'

"a"				return 'A'
"@parent"		return 'QUICK_PARENT'

"single"		return 'SINGLE'

"{"				return '{'
"}"				return '}'
"("				return '('
")"				return ')'
"["				return '['
"]"				return ']'

">="			return '>='
"<="			return '<='
"=="			return '=='
"!="			return '!='
"&&"			return '&&'
"||"			return '||'
">"				return '>'
"<"				return '<'

"+="			return '+='
"-="			return '-='
"*="			return '*='
"/="			return '/='
"%="			return '%='
"&="			return '&='
"|="			return '|='

"="				return '='
","				return ','
";"				return ';'
"."				return '.'

"+"				return '+'
"-"				return '-'
"*"				return '*'
"/"				return '/'

"~"				return '~'

"&"				return "&"
"u"				return "UNION"


"pi"			return 'PI'
"tau"			return 'TAU'

"true"			return 'TRUE'
"false"			return 'FALSE'

"iri"			return 'IRI'
"numeric"		return 'NUMERIC'
"literal"		return 'LITERAL'
"string"		return 'STRING'
"blanknode"		return 'BLANKNODE'

{word}				return 'WORD'

<<EOF>> 		return 'EOF'
