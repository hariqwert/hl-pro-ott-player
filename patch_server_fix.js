const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
    /app\.get\('\/test-ua', \(req, res\) => \{ res\.send\(req\.headers\['user-agent'\] \|\| 'none'\); \}\);\n\nstartServer\(\);/g,
    `app.get('/test-ua', (req, res) => { res.send(req.headers['user-agent'] || 'none'); });\n}\n\nstartServer();`
);

fs.writeFileSync('server.ts', code);
