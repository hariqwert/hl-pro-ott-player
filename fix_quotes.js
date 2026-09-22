const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
let before = code.substring(0, 12495);
let after = code.substring(12495);

// The syntax error must be somewhere around 12495 in the text representation.
