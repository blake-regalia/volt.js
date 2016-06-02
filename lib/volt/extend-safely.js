/**
* import:
**/

// native imports

// libraries
import arginfo from 'arginfo';

// local classes

// meta class setup
const __class_name = 'ExtendSafely';

//
const is_extendable = function(z_value, b_no_functions=false) {

	// ref value type
	let s_type = typeof z_value;

	// object
	if('object' === s_type) {

		// don't try to extend non-simple objects
		if(null === z_value
			|| Object.prototype !== Object.getPrototypeOf(z_value)
		) return false;

		// value is extendable
		return true;
	}
	// function
	else if('function' === s_type && !b_no_functions) {

		// value is extendable
		return true;
	}

	// value is not extendable
	return false;
};

//
const extend = function(h_target, h_object) {

	// each key in object being used to extend target
	for(let s_key in h_object) {

		// key exists
		if(h_target.hasOwnProperty(s_key)) {

			// ref existing value
			let z_value = h_target[s_key];

			// ref object's value
			let z_object_value = h_object[s_key];

			// existing value is extendable & object's value wants to extend
			if(is_extendable(z_value) && is_extendable(z_object_value, true)) {

				// extend value
				extend(z_value, h_object[s_key]);

				// do not overwrite it
				continue;
			}
		}

		// put / overwrite value @key
		h_target[s_key] = h_object[s_key];
	}
};


/**
* public static operator() ():
**/
const local = function(z_target, ...a_objects) {

	// each object that will be used to extend target
	a_objects.forEach((h_object) => {

		// extend target using object
		extend(z_target, h_object);
	});

	// return mutated target
	return z_target;
};


/**
* public static:
**/
{

	// 
	local.toString = function() {
		return __class_name+'()';
	};

	// prefix output messages to console with class's tag
	require(__dirname+'/../console/log-tag.js').extend(local, __class_name);
}

export default local;
