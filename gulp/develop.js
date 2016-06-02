
// module
export default (gulp) => {

	// make develop task
	return function develop(s_dir, s_task, p_src) {

		// make build task name
		let s_build_task = this.task(this.args[0]);

		// register develop task
		gulp.task(s_task, [s_build_task], () => {
			gulp.watch(p_src+'/**/*', [s_build_task]);
		});
	};
};
