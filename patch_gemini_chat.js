const fs = require('fs');
let code = fs.readFileSync('src/services/geminiChatService.ts', 'utf8');

// Update defaultModel types
code = code.replace(
    /defaultModel: 'gemini-3\.1-pro-preview' \| 'gemini-3\.5-flash' \| 'gemini-3\.1-flash-lite';/,
    "defaultModel: 'gemini-3.5-flash' | 'gemini-3.1-flash-lite';"
);

// Update pro_polymath role default model
code = code.replace(
    /title: 'Deep Complex Reasoning & Scientific Analysis',\n\s*icon: 'brain',\n\s*defaultModel: 'gemini-3\.1-pro-preview',/g,
    "title: 'Deep Complex Reasoning & Scientific Analysis',\n        icon: 'brain',\n        defaultModel: 'gemini-3.5-flash',"
);

// Update resolveGeminiModel
code = code.replace(
    /if \(complexity === 'complex'\) \{\n\s*return 'gemini-3\.1-pro-preview';\n\s*\}/g,
    "if (complexity === 'complex') {\n        return 'gemini-3.5-flash';\n    }"
);

code = code.replace(
    /if \(lower\.includes\('pro'\) \|\| lower\.includes\('3\.1-pro'\)\) \{\n\s*return 'gemini-3\.1-pro-preview';\n\s*\}/g,
    "if (lower.includes('pro') || lower.includes('3.1-pro')) {\n            return 'gemini-3.5-flash';\n        }"
);

// Remove from /models endpoint
code = code.replace(
    /,\s*\{\s*id:\s*'gemini-3\.1-pro-preview',[\s\S]*?description:[\s\S]*?\}\s*(?=\])/g,
    "\n            "
);

fs.writeFileSync('src/services/geminiChatService.ts', code);
