const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace the old HTML floating button with the new pill
const oldBtn = `<div id="floatingMusicBtn" onclick="openMusicPlayerCard()" class="fixed bottom-6 left-6 z-[60] cursor-pointer bg-black/80 backdrop-blur-xl border border-cyan-500/30 p-4 rounded-full shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:scale-105 transition-all text-cyan-400 group" title="Open Quantum Music Deck">\n            <i data-lucide="music" class="w-6 h-6 group-hover:animate-pulse"></i>\n        </div>`;

const newPill = `<!-- Minimized Floating Player Pill -->
        <div id="floatingMusicBtn" onclick="openMusicPlayerCard()" class="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] cursor-pointer bg-black/80 backdrop-blur-xl border border-cyan-500/30 px-6 py-3 rounded-full shadow-[0_0_30px_rgba(34,211,238,0.2)] hover:scale-105 hover:bg-black/90 transition-all group flex items-center gap-4" title="Open Music Deck">
            <i data-lucide="music" class="w-5 h-5 text-cyan-400 animate-pulse"></i>
            <div class="flex flex-col items-center">
                <span id="miniPillTitle" class="text-xs font-bold text-white tracking-widest uppercase">Quantum Audio</span>
                <span id="miniPillArtist" class="text-[9px] text-cyan-400 font-medium tracking-widest uppercase mt-0.5">Streaming</span>
            </div>
            <i data-lucide="chevron-up" class="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors"></i>
        </div>`;

if (code.includes(oldBtn)) {
    code = code.replace(oldBtn, newPill);
    console.log('Replaced floating button html!');
} else {
    console.log('Could not find old floating button html');
    // Let's just find `id="floatingMusicBtn"` and replace the block
    const idx = code.indexOf('<div id="floatingMusicBtn"');
    if (idx !== -1) {
        const nextDiv = code.indexOf('</div>', idx) + 6;
        code = code.substring(0, idx) + newPill + code.substring(nextDiv);
        console.log('Replaced floating button using index!');
    }
}

// Now replace the JS part
const jsRegex = /const deckTitle = document\.getElementById\('deckTitle'\);[\s\S]*?const miniTitle = document\.getElementById\('miniNowPlayingTitle'\);\s*if \(miniTitle\) miniTitle\.textContent = \(track\.title \|\| 'Quantum Audio'\) \+ ' - ' \+ \(track\.artist \|\| 'Streaming'\);/g;

const newJs = `const miniPillTitle = document.getElementById('miniPillTitle');
            const miniPillArtist = document.getElementById('miniPillArtist');
            if (miniPillTitle) miniPillTitle.textContent = track.title || 'Quantum Ambient';
            if (miniPillArtist) miniPillArtist.textContent = track.artist || track.author?.name || 'Streaming';`;

code = code.replace(jsRegex, newJs);

// Also need to find `playTrackIndex` and if regex failed, replace directly.
if (!code.includes('miniPillTitle.textContent')) {
    const idx = code.indexOf("const deckTitle = document.getElementById('deckTitle');");
    if (idx !== -1) {
        const nextEmptyLine = code.indexOf('\n\n', idx);
        code = code.substring(0, idx) + newJs + code.substring(nextEmptyLine);
        console.log('Replaced JS via index block!');
    } else {
        // Find existing deck updates
        const deckUpdates = /const deckTitle = document\.getElementById\('deckTitle'\);[\s\S]*?if\s*\(deckArtwork\)\s*\{\s*deckArtwork\.src =[^}]*\}\s*/g;
        code = code.replace(deckUpdates, newJs + '\n');
        console.log('Replaced JS via secondary regex!');
    }
}

fs.writeFileSync('server.ts', code, 'utf8');
