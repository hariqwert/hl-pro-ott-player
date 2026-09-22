const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
    /fs\.writeFileSync\(dbFile, JSON\.stringify\(db, null, 2\)\);/g,
    `fs.writeFileSync(dbFile + '.tmp', JSON.stringify(db, null, 2)); fs.renameSync(dbFile + '.tmp', dbFile);`
);

fs.writeFileSync('server.ts', code);
