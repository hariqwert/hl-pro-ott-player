const fs = require('fs');
let code = fs.readFileSync('src/services/firestoreSyncService.ts', 'utf8');

const regex = /catch\s*\(\s*(e|error|err)(?:\s*:\s*any)?\s*\)\s*\{([\s\S]*?)\}/g;

code = code.replace(regex, (match, errVar, body) => {
    if (body.includes('disableNetwork')) return match;
    const addCode = `
        if (${errVar} && ${errVar}.message && ${errVar}.message.includes && ${errVar}.message.includes('RESOURCE_EXHAUSTED')) {
            console.log('[Firestore] Quota exceeded in another operation. Disabling network.');
            disableNetwork(db).catch(() => {});
            quotaExceeded = true;
            quotaResetTime = Date.now() + 3600000;
        }
    `;
    return `catch (${errVar}: any) {${addCode}${body}}`;
});

fs.writeFileSync('src/services/firestoreSyncService.ts', code);
