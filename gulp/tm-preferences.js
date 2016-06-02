
// module
export default (gulp, $) => {

	// task maker
	return function(s_dir, s_task, p_src, p_dest) {

		// register task
		gulp.task(s_task, () => {

			// simply copy tmPreferences to dist
			return gulp.src(p_src+'/*.tmPreferences')
				.pipe(gulp.dest(p_dest));
		});
	};
};
