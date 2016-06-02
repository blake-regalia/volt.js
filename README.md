# VOLT


This node.js module is an implementation of the **V**olt **O**ntoloy and **L**inked-data **T**echnology.

## What this module is
This module is for the low-level processing of SPARQL queries, compiling procedures to javascript, evaluating procedures in memory, etc. *and* compiling `.volt` source files to their serialized `.ttl` form.

## The "Proxy"
An HTTP proxy for VOLT is available as [volt-proxy.js](blake-regalia/volt-proxy.js), which simply wraps this module using the express  library.

## Demo
If you simply want to connect VOLT to your local triple store and execute SPARQL queries over HTTP, go check out [volt-demo.js](blake-regalia/volt-demo.js) which launches a local webapp with a SPARQL interface for submitting queries directly to the VOLT proxy.

## Install
```sh
$ npm install volt
```

## Usage

```js
const volt = require('volt');

// create volt instance
let volt_query = volt({
    plugins: 
});

// issue sparql query
volt_query('ask {:A :b :C}', (h_sparql_results) => {
    // ...
});

// use the library to compile .volt => .ttl
let h_compiled_procedures = volt.compile({
    code: fs.readFileSync('source.volt'),
});
```

## Development

```sh
$ gulp develop
```
