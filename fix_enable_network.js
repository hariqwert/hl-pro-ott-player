const fs = require('fs');
let code = fs.readFileSync('src/services/firestoreSyncService.ts', 'utf8');

code = code.replace(
    'quotaExceeded = false;\n        } else {', 
    'quotaExceeded = false;\n            enableNetwork(db).catch(() => {});\n        } else {'
);

fs.writeFileSync('src/services/firestoreSyncService.ts', code);
