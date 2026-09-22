const fs = require('fs');
const path = require('path');

const dirs = ['.', './public'];

for (const dir of dirs) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file.endsWith('.html') || file.endsWith('.php')) {
            const filepath = path.join(dir, file);
            let content = fs.readFileSync(filepath, 'utf8');
            if (content.includes('<head>') && !content.includes('<meta name="robots" content="noindex">')) {
                content = content.replace('<head>', '<head>\n    <meta name="robots" content="noindex">');
                fs.writeFileSync(filepath, content);
                console.log('Patched ' + filepath);
            }
        }
    }
}

// Also check server.ts for any HTML rendered from there
let serverCode = fs.readFileSync('server.ts', 'utf8');
if (serverCode.includes('<head>') && !serverCode.includes('<meta name="robots" content="noindex">')) {
    serverCode = serverCode.replace(/<head>/g, '<head>\n    <meta name="robots" content="noindex">');
    fs.writeFileSync('server.ts', serverCode);
    console.log('Patched server.ts');
}
