
/**
* class:
**/
export default Object.assign((s_group_id, h_structure) => {

	// wrapper
	return (h_item, h_program, h_context) => {

		// ref current context's group id
		let s_context_group_id = h_context.group_id;

		// item is of different group
		if(s_group_id !== s_context_group_id) {

			// there are items in the queue
			if(h_context.items.length) {
				// build & close previous list
				h_context.close();
			}

			// update context group id
			h_context.group_id = s_group_id;

			// update context builder
			h_context.build = h_structure.build;
		}

		// ref item list
		let a_items = h_context.items;

		// call structure's test function to tell whether or not this item should be merged with previous
		if(a_items.length && !h_structure.test(h_item, a_items, h_program)) {

			// close & build previous
			h_context.close();
		}

		// add this item, whether merging or starting new group
		a_items.push(h_item);
	};
}, {

	/**
	* public static:
	**/

	context: (h_program) => ({
		items: [],
		output: [],

		// build last item group
		close() {

			// there are items to build
			if(this.items.length) {
				// build previous context, append to output
				this.output.push(
					this.build(this.items, h_program)
				);

				// reset item list
				this.items.length = 0;
			}

			return this.output;
		},
	}),
});
