const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

let count = 0;
let idx = code.indexOf('Quantum Firewall &bull; Active');
while(idx !== -1) {
    count++;
    console.log('Found at:', idx);
    idx = code.indexOf('Quantum Firewall &bull; Active', idx + 1);
}
console.log('Total:', count);
