# VOLT


This node.js module is an implementation of the **V**olt **O**ntoloy and **L**inked-data **T**echnology.


## What this module is
This module is for the low-level processing of SPARQL queries, compiling procedures to javascript, evaluating procedures in memory, etc. *and* compiling `.volt` source files to their serialized `.ttl` form.


## Demo
If you simply want to connect VOLT to your local triple store and execute SPARQL queries over HTTP, go check out [volt-demo.js](https://github.com/blake-regalia/volt-demo.js) which launches an HTTP proxy (via express) to interact with VOLT. The demo also ships as a webapp that includes a SPARQL interface for submitting queries directly to the VOLT proxy. Go check it out if you are interested in using VOLT as a proxy.


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
