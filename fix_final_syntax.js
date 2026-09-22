const fs = require('fs');

let serverContent = fs.readFileSync('server.ts', 'utf8');

// I've messed up the music button by deleting the <i class="lucide-music"> from floatingMusicBtn
// And also I deleted `</div>` for floatingMusicBtn

const floatBtnStart = '<div id="floatingMusicBtn" onclick="openMusicPlayerCard()" class="fixed bottom-6 left-6 z-[60] cursor-pointer bg-black/80 backdrop-blur-xl border border-cyan-500/30 p-4 rounded-full shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:scale-105 transition-all text-cyan-400 group" title="Open Quantum Music Deck">';
const floatBtnFix = `<div id="floatingMusicBtn" onclick="openMusicPlayerCard()" class="fixed bottom-6 left-6 z-[60] cursor-pointer bg-black/80 backdrop-blur-xl border border-cyan-500/30 p-4 rounded-full shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:scale-105 transition-all text-cyan-400 group" title="Open Quantum Music Deck">
            <i data-lucide="music" class="w-6 h-6 group-hover:animate-pulse"></i>
        </div>`;

serverContent = serverContent.replace(floatBtnStart, floatBtnFix);

fs.writeFileSync('server.ts', serverContent, 'utf8');
console.log('Successfully fixed floating button tag!');
