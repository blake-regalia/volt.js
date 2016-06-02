
import through from 'through2';
import plist from 'plist';

// module
export default (gulp, $) => {

	// task maker
	return function tm_language(s_dir, s_task, p_src, p_dest) {

		// generate syntax highlighter
		gulp.task(s_task, [this.task('clean'), this.task('tm-preferences')], () => {

			// load yaml text-mate language definition
			return gulp.src(p_src+'/*.YAML-tmLanguage')

				// convert yaml => json
				.pipe($.yaml())

				// process plist => xml
				.pipe(through.obj(function(d_file, s_encoding, f_done) {

					// prepare buffer for new contents
					let d_contents;

					// empty file
					if(d_file.isNull()) {
						return f_done(null, d_file);
					}
					// buffer
					else if(d_file.isBuffer()) {
						// convert buffer to string, parse JSON, build plist
						let s_plist = plist.build(JSON.parse(d_file.contents.toString()));

						// convert string back to buffer
						d_contents = new Buffer(s_plist, s_encoding);
					}
					// stream
					else if(d_file.isStream()) {
						this.emit('error', new $.util.PluginError('plist', 'Stream not supported'));
						return f_done();
					}

					// set file contents
					d_file.contents = d_contents;

					// all done
					return f_done(null, d_file);
				}))

				// rename file extension => .tmLanguage
				.pipe($.rename((h_path) => {
					h_path.extname = '.tmLanguage';
				}))

				// write to dist diretory
				.pipe(gulp.dest(p_dest));
		});
	};
};
