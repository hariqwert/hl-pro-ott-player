const fs = require('fs');
let code = fs.readFileSync('src/services/firestoreSyncService.ts', 'utf8');

// Add quota flag
if (!code.includes('let quotaExceeded = false;')) {
    code = code.replace('let logQueue: any[] = [];', 'let logQueue: any[] = [];\nlet quotaExceeded = false;\nlet quotaResetTime = 0;');
}

// Check quota flag
code = code.replace('if (!db || logQueue.length === 0 || isFlushingLogs) return;', `if (!db || logQueue.length === 0 || isFlushingLogs) return;
    if (quotaExceeded) {
        if (Date.now() > quotaResetTime) {
            quotaExceeded = false;
        } else {
            return;
        }
    }`);

// Handle quota error
code = code.replace('console.error("Failed to log IP to firestore:", e.message);', `console.error("Failed to log IP to firestore:", e.message);
        if (e.message && e.message.includes('RESOURCE_EXHAUSTED')) {
            console.log('[Firestore] Quota exceeded. Pausing analytics logs for 1 hour.');
            quotaExceeded = true;
            quotaResetTime = Date.now() + 3600000; // 1 hour
        }`);

fs.writeFileSync('src/services/firestoreSyncService.ts', code);
