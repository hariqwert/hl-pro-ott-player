const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.ts', 'utf8');

if (!code.includes('import { syncToFirestore }')) {
    code = code.replace(
        /import \{ getClientIp \} from '\.\.\/utils';/,
        "import { getClientIp } from '../utils';\nimport { syncToFirestore } from '../services/firestoreSyncService';"
    );
}

code = code.replace(
    /function saveDB\(db: AdminDB\) \{\n    const tmpFile = DB_FILE \+ '\.tmp';\n    fs\.writeFileSync\(tmpFile, JSON\.stringify\(db, null, 4\), 'utf8'\);\n    fs\.renameSync\(tmpFile, DB_FILE\);\n\}/,
    `function saveDB(db: AdminDB) {
    const tmpFile = DB_FILE + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 4), 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
    syncToFirestore(db).catch(e => console.error("Firestore sync error:", e));
}`
);

fs.writeFileSync('src/routes/admin.ts', code);
