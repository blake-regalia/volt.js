
import classer from 'classer';

// default config for adder
let H_DEFAULT_ADDER_CONFIG = {
	closing_delimiter: '',
	indent_char: '\t',
};


// adder
const adder = (a_chunks, h_config=H_DEFAULT_ADDER_CONFIG) => {

	// destruct config
	let {
		closing_delimiter: s_closing_delimiter,
		indent_char: s_indent_char,
	} = h_config;

	// level of indentation
	let c_indent_count = 0;

	// filo queue of closing delimiters
	let a_closing_delimiters = [s_closing_delimiter];


	// operator
	let add = classer.operator((s_chunk, h_add_options={}) => {

		// append close delimiter
		let s_close = h_add_options.hasOwnProperty('close')
			? (h_add_options.close || '')
			: s_closing_delimiter;

		// merge with previous using delimiter
		if(h_add_options.hasOwnProperty('merge') && a_chunks.length) {
			debugger;
			a_chunks.push('');
		}
		// new chunk
		else {
			a_chunks.push(
				s_indent_char.repeat(c_indent_count)+s_chunk+s_close
			);
		}
	}, {

		// auto-indenting, delimiter-injecting block opener
		open(s_opening, s_delimiter, h_add_options={}) {

			// open block
			add(s_opening || '',
				// merge options, do not close previous line
				Object.assign(h_add_options, {close: false}));

			// set closing delimiter
			a_closing_delimiters.push(s_delimiter);
			s_closing_delimiter = s_delimiter;

			// increase indentation
			c_indent_count += 1;
		},

		// close block and decrease indentation
		close(s_closing, h_add_options={}) {

			// decrease indentation
			c_indent_count -= 1;

			// pop a closing delimiter of end of list
			a_closing_delimiters.pop();

			// fetch next
			s_closing_delimiter = a_closing_delimiters.slice(-1)[0];

			// close block
			add(s_closing || '', h_add_options);
		},

		// adds blankline(s)
		blank(n_newlines=1) {
			while(0 < n_newlines--) a_chunks.push('');
		},
	});

	return add;
};



export default (h_args) => {

	// destruct config
	let {
		builder: k_builder,
		config: h_config,
	} = h_args;

	// ref build sequence
	let a_build_sequence = k_builder.constructor.build_sequence();

	// prep string chunks
	let a_chunks = [];

	// make a new adder
	let k_adder = adder(a_chunks,
		Object.assign({
			closing_delimiter: ' ;',
			indent_char: '    ',
		}, h_config)
	);

	// each sequence
	a_build_sequence.forEach((s_sequence_name) => {

		// call sequence builder
		k_builder[s_sequence_name](k_adder);
	});

	// combine all string chunks
	return a_chunks.join('\n');
};
