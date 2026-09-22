const fs = require('fs');

let serverContent = fs.readFileSync('server.ts', 'utf8');

// There are 39 backticks before line 1987. That means it's an ODD number, so one template string is open!
// The last one was on line 1562: ` : ''}
// And it opened on line 1556: ${isRetired ? `
// But wait, what opened the main template string `<!DOCTYPE html>...`?
// The main string opened on line 1394!
// And it ends around line 1993, but where? Wait, in my sed commands I deleted the ending backtick!
