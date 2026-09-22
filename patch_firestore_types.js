const fs = require('fs');
let code = fs.readFileSync('src/services/firestoreSyncService.ts', 'utf8');

code = code.replace(/export async function logIpToFirestore\(ip, reqPath\)/g, 'export async function logIpToFirestore(ip: string, reqPath: string)');
code = code.replace(/let data = \{ logs: \[\] \};/g, 'let data: any = { logs: [] };');
code = code.replace(/const results = \{\};/g, 'const results: any = {};');
code = code.replace(/catch\(e\) \{\n        console\.error\("Failed to fetch analytics:", e\);\n        return \{ error: e\.message \};/g, 'catch(e: any) {\n        console.error("Failed to fetch analytics:", e);\n        return { error: e.message };');

fs.writeFileSync('src/services/firestoreSyncService.ts', code);
console.log('Fixed typescript in firestoreSyncService.ts');
