const fs = require('fs');
let code = fs.readFileSync('src/services/localAiService.ts', 'utf8');

code = code.replace(
    /const targetModel = isComplex \? 'gemini-3\.1-pro-preview' : \(isFast \? 'gemini-3\.1-flash-lite' : 'gemini-3\.5-flash'\);/g,
    "const targetModel = isFast ? 'gemini-3.1-flash-lite' : 'gemini-3.5-flash';"
);

code = code.replace(
    /TIER 1: GOOGLE GEMINI NATIVE PRIMARY \(gemini-3\.5-flash, gemini-3\.1-pro-preview, gemini-3\.1-flash-lite\)/g,
    "TIER 1: GOOGLE GEMINI NATIVE PRIMARY (gemini-3.5-flash, gemini-3.1-flash-lite)"
);

fs.writeFileSync('src/services/localAiService.ts', code);
