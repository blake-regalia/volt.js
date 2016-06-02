
import classer from 'classer';
import qs from 'qs';

//
const R_FUNCTION_URI = /^([^]+?)(?:\?(.+)&function=(\w+))?$/;



//
const local = classer('plugins', (h_plugin_modules, h_util) => {

	//
	let h_router = {};

	// add all plugins from hash
	for(let p_namespace in h_plugin_modules) {
		h_router[p_namespace] = {};
	}

	//
	return function(p_function, a_args, f_okay) {

		// prep namespace uri
		let p_namespace;

		// prep user config hash
		let h_user_config = {};

		// parse function uri
		let [, p_prefix, s_querystring, s_function_name] = R_FUNCTION_URI.exec(p_function);

		// querystring-style uri
		if(s_function_name) {
			// no plugin exists in namespace
			if(!h_router.hasOwnProperty(p_prefix)) {
				debugger;
				throw 'no plugin is registered that matches namespace';
			}

			// set namespace
			p_namespace = p_prefix;
		}
		// no querystring, search for namespace
		else {
			// set default querystring
			s_querystring = '';

			// find which namespaces match
			let a_namespace_matches = Object.keys(h_plugin_modules).filter(p_ns => p_prefix.startsWith(p_ns));

			// no matching namespace
			if(!a_namespace_matches.length) {
				debugger;
				throw 'no plugin is registered that matches namespace';
			}
			// multiple namespaces
			else if(a_namespace_matches.length > 1) {
				debugger;
				throw 'multiple namespaces occupy same prefix';
			}
			// single namespace
			else {
				// set namespace
				p_namespace = a_namespace_matches[0];

				// extract function name
				s_function_name = p_function.substr(p_namespace.length);
			}
		}

		// prep plugin instance
		let k_plugin_instance;

		// ref plugin
		let h_plugin = h_router[p_namespace];

		// plugin not yet reserved
		if(!h_plugin) {
			// claim the namespace
			h_plugin = h_router[p_namespace] = {};
		}

		// user config instance does not yet exist
		if(!h_plugin.hasOwnProperty(s_querystring)) {
			// parse querystring using default options from qs module
			h_user_config =s_querystring.length? qs.parse(s_querystring): {};

			// lazily create instance with user config
			k_plugin_instance = h_plugin[s_querystring] = h_plugin_modules[p_namespace](h_user_config);

			// plugin did not return anything useful
			let s_instance_type = typeof k_plugin_instance;
			if('object' !== s_instance_type && 'function' !== s_instance_type) {
				debugger;
				throw 'plugin did not produce a routable datatype';
			}
		}
		// instance exists
		else {
			// ref instance
			k_plugin_instance = h_plugin[s_querystring];
		}

		// function does not exist
		if(!k_plugin_instance.hasOwnProperty(s_function_name)) {
			debugger;
			throw 'function not exists in plugin';
		}
		// function exists
		else {
			// apply function to input args
			k_plugin_instance[s_function_name](f_okay, ...a_args);
		}
	};
});

export default local;
