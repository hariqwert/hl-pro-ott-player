const fs = require('fs');
const code = fs.readFileSync('server.ts', 'utf8');

// Find all backticks up to line 1987
let lines = code.split('\n');
let backtickCount = 0;
for (let i = 0; i < 1986; i++) {
    const chars = lines[i];
    for (let j = 0; j < chars.length; j++) {
        if (chars[j] === '`' && chars[j-1] !== '\\') {
            backtickCount++;
            console.log(`Backtick on line ${i+1}: ${chars}`);
        }
    }
}
console.log(`Total backticks: ${backtickCount}`);
