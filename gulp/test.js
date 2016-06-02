
import {Instrumenter} from 'isparta';

export default (gulp, $) => {

	return function(s_dir, s_task, p_src, p_dest) {

		// make pre task name
		let s_pre_task = this.task('pre');

		// pre-test
		gulp.task(s_pre_task, () => {
			return gulp.src(p_src+'/**/*.js')
				.pipe($.istanbul({
					includeUntested: true,
					instrumenter: Instrumenter
				}))
				.pipe($.istanbul.hookRequire());
		});

		// test
		gulp.task(s_task, [s_pre_task]);

		// // coveralls
		// gulp.task(`coveralls-${s_task}`, [s_task], () => {
		// 	if (!process.env.CI) {
		// 		return;
		// 	}
		// 	return gulp.src(path.join(__dirname, 'coverage/lcov.info'))
		// 		.pipe($.coveralls());
		// });
	};
};
