const fs = require('fs');
const html = fs.readFileSync('consumet.html', 'utf8');
const regex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
const acorn = require('acorn');
while ((match = regex.exec(html))) {
    const code = match[1];
    try {
        acorn.parse(code, { ecmaVersion: 2020 });
    } catch (e) {
        console.log("Syntax error:", e.message, "at position", e.pos);
    }
}
