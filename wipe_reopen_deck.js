const fs = require('fs');

let serverContent = fs.readFileSync('server.ts', 'utf8');

const jsRegex = /const reopenDeckBarTitle = document\.getElementById\('reopenDeckBarTitle'\);\s*if \(deckTitle\) deckTitle\.textContent = track\.title \|\| 'Quantum Ambient';\s*if \(deckArtist\) deckArtist\.textContent = track\.artist \|\| track\.author\?\.name \|\| 'Lossless Audio';\s*if \(deckArtwork\) {\s*deckArtwork\.src = track\.thumbnail \|\| track\.image \|\| 'https:\/\/images\.unsplash\.com\/photo-1614149162883-504ce4d13909\?auto=format&fit=crop&q=80&w=150&h=150';\s*}\s*if \(reopenDeckBarTitle\) {\s*reopenDeckBarTitle\.textContent = \(track\.title \|\| 'Quantum Audio'\) \+ ' - ' \+ \(track\.artist \|\| 'Playing'\);\s*}/g;

serverContent = serverContent.replace(jsRegex, "");

fs.writeFileSync('server.ts', serverContent, 'utf8');
console.log('Successfully wiped pill JS!');
