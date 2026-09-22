const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

serverCode = serverCode.replace("import { syncFromFirestore, syncM3uFromFirestore } from './src/services/firestoreSyncService';", 
"import { syncFromFirestore, syncM3uFromFirestore, logIpToFirestore } from './src/services/firestoreSyncService';");

const middlewareCode = `
app.use((req, res, next) => {
    const ip = getClientIp(req);
    // Ignore static assets
    if (!req.path.match(/\\.(css|js|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)$/i) && !req.path.startsWith('/api/stream')) {
        logIpToFirestore(ip, req.path).catch(()=>{});
    }
    next();
});
`;

// Insert after app.use(express.json()) which is around line 1113
const parts = serverCode.split('app.use(express.json({ limit: \'100mb\' }));');
if (parts.length === 2) {
    serverCode = parts[0] + "app.use(express.json({ limit: '100mb' }));\n" + middlewareCode + parts[1];
    fs.writeFileSync('server.ts', serverCode);
    console.log("Patched server.ts with logging middleware");
} else {
    console.log("Could not find express.json");
}
