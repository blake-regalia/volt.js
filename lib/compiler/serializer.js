
export default function local(z_block, add, s_predicate='') {

	// ref block type
	let s_block_type = typeof z_block;

	// predicate was given, format it properly
	if(s_predicate) s_predicate += ' ';

	// direct serialization
	if('string' === s_block_type || 'number' === s_block_type) {
		add(s_predicate+z_block);
	}
	// a list of some type
	else if(Array.isArray(z_block)) {
		// object list
		if(z_block.object_list) {
			// each item in list
			z_block.forEach((w_item) => {
				local(w_item, add, s_predicate);
			});
		}
		// rdf:list
		else {
			// open rdf list
			add.open(s_predicate+'(', '');

			// each item in list
			z_block.forEach((w_item) => {
				local(w_item, add);
			});

			// close rdf list
			add.close(')');
		}
	}
	// blanknode
	else if('object' === typeof z_block) {
		// open blanknode
		add.open(s_predicate+'[', ' ;');

		// each key in blanknode object
		for(let s_key in z_block) {
			local(z_block[s_key], add, s_key);
		}

		// close blanknode
		add.close(']');
	}
}
