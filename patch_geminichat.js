const fs = require('fs');
let code = fs.readFileSync('src/services/geminiChatService.ts', 'utf8');

code = code.replace(
    /if \(options\.enableSearch\) \{\n\s*config\.tools = \[\{ googleSearch: \{\} \}\];\n\s*\}/g,
    `if (options.enableSearch && !targetModel.includes('flash-lite')) {
            config.tools = [{ googleSearch: {} }];
        }`
);

fs.writeFileSync('src/services/geminiChatService.ts', code);
