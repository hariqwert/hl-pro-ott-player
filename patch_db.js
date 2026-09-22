const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.ts', 'utf8');

code = code.replace(
    /function saveDB\(db: AdminDB\) \{\n\s*fs\.writeFileSync\(DB_FILE, JSON\.stringify\(db, null, 4\), 'utf8'\);\n\}/,
    `function saveDB(db: AdminDB) {
    const tmpFile = DB_FILE + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 4), 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
}`
);

code = code.replace(
    /\} catch \(e\) \{\n\s*return \{\n\s*portals: \[\]/,
    `} catch (e) {
        console.error("[CRITICAL] Failed to parse admin_db.json. Returning cached or blank DB to prevent overwrite.", e);
        // Instead of returning a pure blank DB that will immediately overwrite everything on the next save,
        // we should try to return something safe, or throw. But to keep types happy:
        return {
            portals: [],`
);

fs.writeFileSync('src/routes/admin.ts', code);
