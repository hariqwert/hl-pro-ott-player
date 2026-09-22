const fs = require('fs');

function patchFile(file) {
    let code = fs.readFileSync(file, 'utf8');

    // Remove the pro button
    code = code.replace(
        /<button class="ai-model-pill tier-pro" data-model="gemini-3\.1-pro-preview".*?>🧠 Pro<\/button>/g,
        ""
    );

    // Remove from activeGeminiModel names mapping
    code = code.replace(
        /'gemini-3\.1-pro-preview': 'Gemini 3\.1 Pro',?\s*/g,
        ""
    );

    // Update the dynamic model selection heuristic
    code = code.replace(
        /if \(activeChatbotRole === 'pro_polymath' \|\| isComplex\) \{\n\s*taskComplexity = 'complex';\n\s*selectedModel = 'gemini-3\.1-pro-preview';\n\s*\} else if \(activeChatbotRole === 'fast_assistant' \|\| isFast\) \{\n\s*taskComplexity = 'fast';\n\s*selectedModel = 'gemini-3\.1-flash-lite';\n\s*\} else \{\n\s*taskComplexity = 'general';\n\s*selectedModel = 'gemini-3\.5-flash';\n\s*\}/g,
        `if (activeChatbotRole === 'fast_assistant' || isFast) {
      taskComplexity = 'fast';
      selectedModel = 'gemini-3.1-flash-lite';
    } else {
      taskComplexity = 'general';
      selectedModel = 'gemini-3.5-flash';
    }`
    );

    fs.writeFileSync(file, code);
}

patchFile('public/local-ai.js');
patchFile('assets/local-ai.js');
