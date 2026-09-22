const fs = require('fs');
let code = fs.readFileSync('src/services/firestoreSyncService.ts', 'utf8');

if (!code.includes('disableNetwork')) {
    code = code.replace("collection, getDocs, deleteDoc } from 'firebase/firestore';", "collection, getDocs, deleteDoc, disableNetwork, enableNetwork } from 'firebase/firestore';");
}

code = code.replace("if (e.message && e.message.includes('RESOURCE_EXHAUSTED')) {", 
`if (e.message && e.message.includes('RESOURCE_EXHAUSTED')) {
            console.log('[Firestore] Quota exceeded. Disabling network and pausing analytics logs for 1 hour.');
            disableNetwork(db).catch(() => {});`);

fs.writeFileSync('src/services/firestoreSyncService.ts', code);
