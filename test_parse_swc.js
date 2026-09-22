const fs = require('fs');
const { parse } = require('@swc/core');
const code = fs.readFileSync('server.ts', 'utf8');

parse(code, { syntax: 'typescript' }).then(() => {
    console.log("SWC passed");
}).catch(e => {
    console.log(e.message);
});
