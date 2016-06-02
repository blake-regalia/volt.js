
// module
export default (gulp, $) => {

	// make transpile task
	return function(s_dir, s_task, p_src, p_dest) {

		// register new task
		gulp.task(s_task, () => {

			// load all javascript source files
			return gulp.src(p_src+'/*.js')

				// handle uncaught exceptions thrown by any of the plugins that follow
				.pipe($.plumber())

				// do not recompile unchanged files
				.pipe($.cached(s_task))

				// lint all javascript source files
				.pipe($.eslint())
				.pipe($.eslint.format())

				// preserve mappings to source files for debugging
				.pipe($.sourcemaps.init())

					// transpile
					.pipe($.babel())
				.pipe($.sourcemaps.write())

				// write output to dist directory
				.pipe(gulp.dest(p_dest));
		});
	};
};
