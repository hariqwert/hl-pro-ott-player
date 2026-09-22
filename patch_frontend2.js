const fs = require('fs');

function patchFile(file) {
    let code = fs.readFileSync(file, 'utf8');

    code = code.replace(
        /if \(role === 'pro_polymath'\) \{\n\s*updateModelUI\('gemini-3\.1-pro-preview'\);\n\s*\} else if \(role === 'fast_assistant'\) \{/g,
        "if (role === 'pro_polymath') {\n        updateModelUI('gemini-3.5-flash');\n      } else if (role === 'fast_assistant') {"
    );

    fs.writeFileSync(file, code);
}

patchFile('public/local-ai.js');
patchFile('assets/local-ai.js');
