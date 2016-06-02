
import fs from 'fs';
import glob from 'glob';
import through from 'through2';

import {Generator} from 'jison';
import ebnf_parser from 'ebnf-parser';
import lex_parser from 'lex-parser';


// module
export default (gulp, $) => {

	// make jison task
	return function jison_task(s_dir, s_task, p_src, p_dest) {

		// resolve lex file
		let p_lex_file = glob.sync(p_src+'/*.jisonlex')[0];

		// register new task
		gulp.task(s_task, [this.task('transpile')], () => {

			// load jison source file
			return gulp.src(p_src+'/*.jison')

				// handle uncaught exceptions thrown by any of the plugins that follow
				.pipe($.plumber())

				// do not recompile unchanged files
				.pipe($.cached(s_task))

				// compile jison script
				.pipe(through.obj(function(d_file, s_encoding, f_done) {

					// no file
					if(d_file.isNull()) return f_done(null, d_file);

					// stream
					if(d_file.isStream()) return f_done(new $.util.PluginError('gulp-jison-parser', 'Streams not supported'));

					// try generating parser
					try {
						// ref file contents
						let s_contents = d_file.contents.toString();

						// parse jison grammer
						let h_grammar = ebnf_parser.parse(s_contents);

						//	read lex file
						let s_lex_contents = fs.readFileSync(p_lex_file, 'utf-8');

						// set lex option on grammar
						h_grammar.lex = lex_parser.parse(s_lex_contents);

						// pass grammer to jison to generate parser
						let s_parser = new Generator(h_grammar, {}).generate();

						// convert parser string to buffer
						d_file.contents = new Buffer(s_parser);

						// rename file extension
						d_file.path = $.util.replaceExtension(d_file.path, '.js');

						// add this file to stream
						this.push(d_file);
					}
					catch (err) {
						// Convert the keys so PluginError can read them
						err.lineNumber = err.line; err.fileName = err.filename;

						// Add a better error message
						err.message = `${err.message} in file ${err.fileName} line no. ${err.lineNumber}`;

						// throw error
						throw new $.util.PluginError('jison', err);
					}

					// done
					return f_done();
				}))

				// rename output file
				.pipe($.rename('parser.js'))

				// write output to dist directory
				.pipe(gulp.dest(p_dest));
		});
	};
};
