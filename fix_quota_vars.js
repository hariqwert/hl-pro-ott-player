const fs = require('fs');
let code = fs.readFileSync('src/services/firestoreSyncService.ts', 'utf8');

// Remove existing declarations
code = code.replace('let quotaExceeded = false;\nlet quotaResetTime = 0;\n', '');

// Insert at top after imports
code = code.replace('let db: any = null;', 'let db: any = null;\nlet quotaExceeded = false;\nlet quotaResetTime = 0;');

fs.writeFileSync('src/services/firestoreSyncService.ts', code);
