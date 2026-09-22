const fs = require('fs');
let code = fs.readFileSync('src/services/channelJsonService.ts', 'utf8');

if (!code.includes('import { syncToFirestore }')) {
    code = code.replace(
        /import fs from 'fs';\nimport path from 'path';/,
        "import fs from 'fs';\nimport path from 'path';\nimport { syncToFirestore } from './firestoreSyncService';"
    );
}

code = code.replace(
    /fs\.writeFileSync\(adminDbPath \+ '\.tmp', JSON\.stringify\(db, null, 2\), 'utf8'\); fs\.renameSync\(adminDbPath \+ '\.tmp', adminDbPath\);/,
    `fs.writeFileSync(adminDbPath + '.tmp', JSON.stringify(db, null, 2), 'utf8'); fs.renameSync(adminDbPath + '.tmp', adminDbPath); syncToFirestore(db).catch(e => console.error("Firestore sync error from channelJsonService:", e));`
);

fs.writeFileSync('src/services/channelJsonService.ts', code);
