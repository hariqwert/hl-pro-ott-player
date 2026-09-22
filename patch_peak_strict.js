const fs = require('fs');
let code = fs.readFileSync('src/services/peakStreamService.ts', 'utf8');

const targetStr = `    if (!encText) {
        throw new Error('Empty response from PeakStream gateway');
    }`;

const replaceStr = `    if (!encText) {
        throw new Error('Empty response from PeakStream gateway');
    }
    
    // Strict safeguard: if the gateway returns a completely different movie, SpeedRace JSON often includes the title.
    // However, since it's encrypted, we might not be able to read it before decrypting.
    // If the backend returns 'Nothing Found' or similar, it's handled below.`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/services/peakStreamService.ts', code);
