const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const t = "export function trackClientIpActivity";
console.log(code.indexOf(t));
