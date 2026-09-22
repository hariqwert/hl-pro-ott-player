const fs = require('fs');
let code = fs.readFileSync('src/services/peakStreamService.ts', 'utf8');

const targetStr = `    let url = \`https://api.speedracelight.com/cdn/sources-with-title?title=\${encTitle}&mediaType=\${type}&year=\${year}&tmdbId=\${tmdbId}&imdbId=\${finalImdbId}&enc=2&seed=\${seed}\`;`;

const replaceStr = `    let url = \`https://api.speedracelight.com/cdn/sources-with-title?title=\${encTitle}&mediaType=\${type}&year=\${year}&tmdbId=\${tmdbId}&imdbId=\${finalImdbId}&enc=2&seed=\${seed}\`;
    
    // In SpeedRace, if you pass an imdb_id and it doesn't match perfectly, it might still return *something*.
    // However, if we know we want Leo (2023) Tamil (tt15654328), and it doesn't exist, it might fallback to tt1152063 (Animation).
    // The only way to know is if SpeedRace's encrypted JSON includes the title, but it's encrypted.
    // If the API returns a master playlist that works, we have to assume it found it.
    // To prevent the fake Leo from playing on S4K, we will explicitly block the animation tt1152063 from playing if the user requested the Tamil one (tt15654328).
    
    if (finalImdbId === 'tt15654328') {
         // Lokesh Kanagaraj's Leo is notoriously missing from PeakStream, they only have the animation.
         // If we request tt15654328, Peakstream will silently serve the animation. 
         // Since PeakStream doesn't return metadata with its stream, we must manually block this specific known collision.
         throw new Error('PeakStream known collision: Tamil Leo not available, blocked animation fallback.');
    }`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/services/peakStreamService.ts', code);
