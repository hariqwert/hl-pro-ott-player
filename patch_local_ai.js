const fs = require('fs');

function patchFile(file) {
    let code = fs.readFileSync(file, 'utf8');
    
    // Replace the isFast heuristic using string replacement
    const target = "const isFast = (text.length < 45 && !isComplex) || /^(?:hi|hello|hey|what time|who is|status|ping|help)\\b/i.test(text.trim());";
    const replacement = "const isFast = (text.length < 45 && !isComplex && !activeSearchGrounding) || /^(?:hi|hello|hey|status|ping|help)\\b/i.test(text.trim());";
    
    code = code.replace(target, replacement);
    
    fs.writeFileSync(file, code);
}

patchFile('public/local-ai.js');
patchFile('assets/local-ai.js');
