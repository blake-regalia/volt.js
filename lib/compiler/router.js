
import classer from 'classer';

/**
* class:
**/
const local = classer('router', (s_name, z_router, h_locals) => {

	// shuffle args
	if(!h_locals) {
		h_locals = z_router;
		z_router = undefined;
	}

	//
	return (...a_args) => {

		// prep route name & default return value
		let s_route;
		let w_return;

		// ref router type
		let s_router_type = typeof z_router;

		// router is string
		if('string' === s_router_type) {

			// split by decimal
			let a_properties = z_router.split(/\./g);

			// no need for recursion
			if(1 === a_properties.length) {
				// use that property name of 0th arg
				s_route = a_args[0][a_properties[0]];
			}
			// recurse
			else {
				// start with 0th arg
				let w_node = a_args[0];
				while(a_properties.length) {
					// shift property from each word
					w_node = w_node[a_properties.shift()];
				}

				// end at terminus
				s_route = w_node;
			}
		}
		// router is function
		else if('function' === s_router_type) {
			// prep route callback; set route value
			let f_set_route = (_s_route) => s_route = _s_route;

			// find which route to use
			w_return = z_router.apply(h_locals, [f_set_route, ...a_args]);
		}
		// router is void
		else if('undefined' === s_router_type) {
			// stringify arg value
			s_route = a_args[0]+'';
		}

		// route was set
		if(s_route) {
			// ref handler
			let k_route_handler = h_locals[s_route];

			// route does not exist
			if(!k_route_handler) {
				local.fail(`${s_name} cannot route "${s_route}"`);
			}

			// forward call to route handler
			return k_route_handler(...a_args);
		}
		// route not set; explicit return value
		else {
			return w_return;
		}
	};
}, {

/**
* public static:
**/

	// define how to route from an input to the local handlers
	group(s_group_name, w_router, h_handlers) {
		let h_output = {};

		// each handler
		for(let s_handler_name in h_handlers) {
			let h_handler = h_handlers[s_handler_name];

			// create handler interface
			h_output[s_handler_name] = local(`${s_group_name}.${s_handler_name}`, w_router, h_handler);
		}

		// render callee as output
		return h_output;
	},
});

export default local;
