
import del from 'del';

export default function clean(gulp) {
	return (s_dir, s_task, p_src, p_dest) => {
		gulp.task(s_task, () => {
			return del.sync([p_dest]);
		});
	};
}
