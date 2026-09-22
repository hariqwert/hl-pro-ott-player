const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const str = "function updatePlayerUI(track)";
console.log(code.includes(str));
