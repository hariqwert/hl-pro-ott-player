const fs = require('fs');
let code = fs.readFileSync('src/services/bingrScraperService.ts', 'utf8');

const targetStr = `        const res = await bingrRequest<{
            results: any[];
        }>(\`/search?q=\${encodeURIComponent(clean)}\`, { referer, timeout: 3500 });`;

const replaceStr = `        const res = await bingrRequest<{
            results: any[];
        }>(\`/search?q=\${encodeURIComponent(clean)}\`, { referer, timeout: 3500 });
        if (!res.data?.results) throw new Error('No results from upstream search');`;

if(code.includes(targetStr)) {
    code = code.replace(targetStr, replaceStr);
    fs.writeFileSync('src/services/bingrScraperService.ts', code);
    console.log("Patched");
}
