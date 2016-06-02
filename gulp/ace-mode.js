
import path from 'path';
import child_process from 'child_process';
import glob from 'glob';

// module
export default (gulp, $, config={}) => {

	//
	const p_ace = (config.paths && config.paths.ace) || './node_modules/ace';

	// task maker
	return function sublime(s_dir, s_task, p_src, p_dest) {

		// generate syntax highlighter
		gulp.task(s_task, [this.task('tm-language')], (cb) => {

			//
			return glob(p_dest+'/**/*.tmLanguage', (e_glob, a_files) => {
				if(e_glob) cb(e_glob);

				//
				a_files.map((p_file) => {

					//
					let s_mode = path.basename(p_file, '.tmLanguage');

					// convert language file
					child_process.spawnSync('node', [`${p_ace}/tool/tmlanguage.js`, p_file]);

					// copy ace-mode files
					gulp.src(`${p_ace}/lib/ace/mode/${s_mode}*.js`)

						// replace
						.pipe($.replace(/require\("(\.\.\/)/g, 'ace.require("ace/'))
						.pipe($.replace(/require\("(\.\/)/g, 'ace.require("ace/mode/'))
						// .pipe($.replace(/define\(/, `ace.define("ace/mode/volt_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"],`))

						// concat
						.pipe($.concat('mode-'+s_mode+'.js'))

						.pipe($.debug())

						// to output directory
						.pipe(gulp.dest(p_dest+'/ace'));
				});
			});
		});
	};
};
