const fs = require('fs');
let code = fs.readFileSync('src/services/geminiChatService.ts', 'utf8');

const replacement = `        const currentDate = new Date().toLocaleString('en-US', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' UTC';
        const config: any = {
            systemInstruction: roleConfig.systemInstruction + '\\n\\nCurrent System Time: ' + currentDate,
            temperature: typeof options.temperature === 'number' ? options.temperature : 0.7
        };`;

code = code.replace(/const config: any = \{\n\s*systemInstruction: roleConfig\.systemInstruction,\n\s*temperature:[^\n]+\n\s*\};/g, replacement);

fs.writeFileSync('src/services/geminiChatService.ts', code);
