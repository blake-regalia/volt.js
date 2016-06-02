
import fs from 'fs';
import path from 'path';
import util from 'util';

const S_THIS_FILE = path.basename(__filename);

export default function(gulp, $, config) {

	// prep tasks hash
	let h_tasks = {};

	// prep hash of task lists
	let h_task_lists = {};

	//
	let a_dependencies = [];

	//
	const mk_task = function(s_task_spec, s_dir) {
		let [s_task_type, ...a_args] = s_task_spec.split(/:| +/g);
		let f_task_maker = h_tasks[s_task_type];

		// no such task type
		if(!f_task_maker) {
			throw `no such task type "${s_task_type}" found in gulp directory`;
		}

		// 
		if('string' === typeof s_task_type) {
			// create task name
			let s_task = `${s_task_type}-${s_dir}`;

			// create src and dest paths
			let p_src = path.join(config.src, s_dir);
			let p_dest = path.join(config.dest, s_dir);

			// forward task details to task maker
			f_task_maker.apply({

				// pass task-spec args
				args: a_args,

				// enable maker to indicate dependencies
				task(s_mutate) {
					// make other task name
					let s_other_task = `${s_mutate}-${s_dir}`;

					// push to list
					a_dependencies.push({
						spec: s_mutate,
						dir: s_dir,
						name: s_other_task,
					});

					// return other task name
					return s_other_task;
				},
			}, [s_dir, s_task, p_src, p_dest]);

			// ref corresponding task list
			let a_task_list = h_task_lists[s_task_type];

			// corresponding task list does not yet exist; create it
			if(!a_task_list) {
				a_task_list = h_task_lists[s_task_type] = [];
			}

			// append task name to its corresponding task list
			a_task_list.push(s_task);
		}
	};

	return {
		load(h_groups) {

			// fetch js task files
			fs.readdirSync(__dirname).filter((s_file) => {
				return '.js' === path.extname(s_file) && S_THIS_FILE !== s_file;
			}).forEach((s_file) => {

				// ref task type
				let s_task_type = path.basename(s_file, '.js');

				// load maker function into tasks hash
				h_tasks[s_task_type] = require(`./${s_file}`).default(gulp, $, config);
			});

			//
			Object.keys(config.targets).forEach((s_dir) => {
				let a_groups = config.targets[s_dir];
				if('string' === typeof a_groups) a_groups = [a_groups];
				a_groups.forEach((s_group) => {

					// each task type
					h_groups[s_group].forEach((s_task_spec) => {
						mk_task(s_task_spec, s_dir);
					});
				});
			});

			// resolve all dependencies
			while(a_dependencies.length) {

				// ref dependency
				let h_dependency = a_dependencies.shift();

				// dependency not yet exists
				if(!gulp.tasks[h_dependency.name]) {

					// make that task
					mk_task(h_dependency.spec, h_dependency.dir);
				}
			}

			// build default tasks for each type
			for(let s_general_task in h_task_lists) {
				let a_deps = h_task_lists[s_general_task];

				// link dependencies to trigger those tasks
				gulp.task(s_general_task, a_deps);
			}

			// auto-add directory name aliases
			Object.keys(config.targets).forEach((s_dir) => {
				let a_targets = config.targets[s_dir];
				if('string' === typeof a_targets) a_targets = [a_targets];
				let a_task_types = h_groups[a_targets[0]];

				// no task name conflict
				if(!gulp.tasks[s_dir]) {
					gulp.task(s_dir, [`${a_task_types[0]}-${s_dir}`]);
				}
			});

			// add aliases
			Object.keys(config.aliases || {}).forEach((s_alias) => {
				let s_task = config.aliases[s_alias];

				// register alias task
				gulp.task(s_alias, [s_task]);
			});
		},
	};
}
