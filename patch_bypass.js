const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.ts', 'utf8');

code = code.replace(
    /if \(db\.maintenanceMode\) \{\n\s*systemState\.maintenanceMode = true;/,
    `if (db.maintenanceMode) {\n        systemState.maintenanceMode = true;\n        systemState.maintenanceAdminBypass = db.maintenanceAdminBypass || false;`
);

code = code.replace(
    /\} else \{\n\s*systemState\.maintenanceMode = false;/,
    `} else {\n        systemState.maintenanceMode = false;\n        systemState.maintenanceAdminBypass = db.maintenanceAdminBypass || false;`
);

fs.writeFileSync('src/routes/admin.ts', code);
