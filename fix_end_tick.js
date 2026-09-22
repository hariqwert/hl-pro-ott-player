const fs = require('fs');

let serverContent = fs.readFileSync('server.ts', 'utf8');
const searchStr = 'export const videoBroadcastEmitter = new EventEmitter();';
const replaceStr = '`;\n\nexport const videoBroadcastEmitter = new EventEmitter();';

serverContent = serverContent.replace(searchStr, replaceStr);

fs.writeFileSync('server.ts', serverContent, 'utf8');
console.log('Added missing backtick!');
