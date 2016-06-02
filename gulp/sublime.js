import util from 'util';

// module
export default (gulp, $, config={}) => {

	// task maker
	return function sublime(s_dir, s_task, p_src, p_dest) {

		// generate syntax highlighter
		gulp.task(s_task, [this.task('tm-language')], () => {

			// path to sublime user packages remapper
			let f_user_packages = config.sublime_user_packages;
			if(f_user_packages) {

				// fetch path of user packages
				let p_user_packages = f_user_packages(s_dir, s_task, p_src);

				// load textmate language files
				return gulp.src(p_dest+'/**/*')

					// copy to sublime user plugins directory
					.pipe(gulp.dest(p_user_packages));
			}
		});
	};
};
