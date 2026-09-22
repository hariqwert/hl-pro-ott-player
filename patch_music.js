const fs = require('fs');
let code = fs.readFileSync('music.html', 'utf8');

code = code.replace(
    /<div id="globalMusicFooter" class="fixed bottom-0 left-0 right-0 z-\[200\]/g,
    '<div id="globalMusicFooter" class="hidden fixed bottom-0 left-0 right-0 z-[200]'
);

fs.writeFileSync('music.html', code);
