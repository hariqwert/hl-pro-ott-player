const fs = require('fs');
let code = fs.readFileSync('src/services/movies4uService.ts', 'utf8');

const targetStr = `        // Query words matching in slug
        for (const w of queryWords) {
            if (l.includes(w)) score += 40;
        }`;

const replaceStr = `        // Query words matching in slug (strict boundary check)
        for (const w of queryWords) {
            const regex = new RegExp(\`(?:^|[\\\\/-])\${w}(?:[\\\\/-]|$)\`);
            if (regex.test(l)) {
                score += 100; // Explicit word match in slug
            } else if (l.includes(w)) {
                score += 10; // Partial match (e.g., 'leo' in 'napoleon')
            }
        }`;

code = code.replace(targetStr, replaceStr);

const targetReturn = `    if (validUrls.length === 0) return '';
    validUrls.sort((a, b) => b.score - a.score);
    return validUrls[0].url;`;

const replaceReturn = `    if (validUrls.length === 0) return '';
    validUrls.sort((a, b) => b.score - a.score);
    
    // Strict Guard: If the best match has a very low score (e.g. only partial substring matches), reject it
    if (validUrls[0].score < 50) {
        console.warn('[Movies4u] Rejecting low-confidence match:', validUrls[0].url, 'Score:', validUrls[0].score);
        return '';
    }
    
    return validUrls[0].url;`;

code = code.replace(targetReturn, replaceReturn);

fs.writeFileSync('src/services/movies4uService.ts', code);
