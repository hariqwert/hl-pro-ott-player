const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetStr = "Quantum Firewall &bull; Active";
const idx1 = code.indexOf(targetStr);
const idx2 = code.indexOf(targetStr, idx1 + 1);
console.log('idx2:', idx2);
console.log('text around idx2:', code.substring(idx2, idx2 + 100));
