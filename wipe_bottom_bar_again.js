const fs = require('fs');

let serverContent = fs.readFileSync('server.ts', 'utf8');

const footerRegex = /<!-- NATIVE AETHERIS DECK CONTROL BAR -->[\s\S]*?<span class="text-\[10px\] uppercase font-bold tracking-widest text-slate-200" id="reopenDeckBarTitle">Quantum Audio Deck<\/span>\s*<\/div>/g;

serverContent = serverContent.replace(footerRegex, "");

fs.writeFileSync('server.ts', serverContent, 'utf8');
console.log('Successfully wiped bottom bar completely!');
