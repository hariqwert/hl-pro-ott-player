const fs = require('fs');

let serverContent = fs.readFileSync('server.ts', 'utf8');

// 1. Clean Maintenance Center Container (Only text & status badge, clean & centered)
const startTag = '<!-- Main Quantum Theme Maintenance Center Container -->';
const endTag = '<!-- Quantum Audio Music Card Deck -->';

const startIndex = serverContent.indexOf(startTag);
const endIndex = serverContent.indexOf(endTag);

if (startIndex !== -1 && endIndex !== -1) {
    const cleanCenterHtml = `<!-- Main Quantum Theme Maintenance Center Container -->
    <div id="quantumMaintenanceContainer" class="max-w-[92vw] sm:max-w-lg w-full z-10 relative space-y-4 my-auto px-1 sm:px-0 transition-all duration-300 text-center">
        <!-- Status Badge -->
        <div class="\${isRetired ? 'hidden' : 'flex'} items-center justify-center gap-2 bg-black/60 border border-white/10 py-1.5 px-4 rounded-full w-fit mx-auto backdrop-blur-md shadow-lg">
            <div class="relative flex h-2.5 w-2.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full \${badgeOuter}"></span>
              <span class="relative inline-flex rounded-full h-2.5 w-2.5 \${badgeInner}"></span>
            </div>
            <span class="text-[10px] sm:text-xs font-bold uppercase tracking-widest \${badgeTextColor}">\${badgeLabel}</span>
        </div>

        \${isRetired ? \`
        <div class="flex justify-center mb-2">
            <div class="p-3 bg-white/5 border border-white/10 rounded-2xl shadow-xl shadow-black/50">
                <svg class="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
            </div>
        </div>
        \` : ''}

        <!-- Maintenance Title & Status Description (Centered Text) -->
        <div class="space-y-2.5">
            <h1 class="\${isRetired ? 'text-2xl sm:text-4xl font-light tracking-widest text-slate-200' : 'text-xl sm:text-3xl font-black tracking-tighter text-white'} drop-shadow-lg z-10 relative">\${title}</h1>
            <p class="\${descriptionColor} text-xs sm:text-sm leading-relaxed font-medium z-10 relative max-w-md mx-auto px-1">\${description}</p>
        </div>

        <!-- Floating Button to Open Music Card -->
        <div id="floatingMusicBtn" onclick="openMusicPlayerCard()" class="fixed bottom-6 left-6 z-[60] cursor-pointer bg-black/80 backdrop-blur-xl border border-cyan-500/30 p-4 rounded-full shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:scale-105 transition-all text-cyan-400 group" title="Open Quantum Music Deck">
            <i data-lucide="music" class="w-6 h-6 group-hover:animate-pulse"></i>
        </div>

        `;

    serverContent = serverContent.substring(0, startIndex) + cleanCenterHtml + serverContent.substring(endIndex);
}

// 2. Update Header of Music Card Deck (#musicCard) with dedicated MINIMIZE BUTTON
const musicCardHeaderOld = `<button onclick="minimizeMaintenanceContainer()" class="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-400 rounded-xl border border-white/5 transition-all group cursor-pointer" title="Minimize Whole Container"><i data-lucide="minimize-2" class="w-4 h-4 group-hover:scale-110 transition-transform"></i></button>
<button onclick="closeMusicPlayerCard()" class="p-2 bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 rounded-xl border border-white/5 transition-all group cursor-pointer" title="Minimize / Hide Player (Music Keeps Playing)"><i data-lucide="x" class="w-4 h-4 group-hover:scale-110 transition-transform"></i></button>`;

const musicCardHeaderNew = `<button type="button" onclick="closeMusicPlayerCard()" class="px-2.5 py-1.5 bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/30 text-cyan-300 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95" title="Minimize Music Player (Playing Song Continues in Deck Bar)">
    <i data-lucide="minimize-2" class="w-3.5 h-3.5 text-cyan-400"></i>
    <span>Minimize</span>
</button>`;

if (serverContent.includes(musicCardHeaderOld)) {
    serverContent = serverContent.replace(musicCardHeaderOld, musicCardHeaderNew);
} else {
    // Fallback replacement if slightly different
    serverContent = serverContent.replace(
        '<button onclick="closeMusicPlayerCard()" class="p-2 bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 rounded-xl border border-white/5 transition-all group cursor-pointer" title="Minimize / Hide Player (Music Keeps Playing)"><i data-lucide="x" class="w-4 h-4 group-hover:scale-110 transition-transform"></i></button>',
        musicCardHeaderNew
    );
}

// 3. Ensure closeMusicPlayerCard ensures maintenanceDeckBar is visible so currently playing song shows at bottom
const closeMusicFnOld = `function closeMusicPlayerCard() {
            const musicCard = document.getElementById('musicCard');
            const floatingBtn = document.getElementById('floatingMusicBtn');
            if (musicCard) musicCard.classList.add('hidden');
            if (floatingBtn) floatingBtn.classList.remove('hidden');`;

const closeMusicFnNew = `function closeMusicPlayerCard() {
            const musicCard = document.getElementById('musicCard');
            const floatingBtn = document.getElementById('floatingMusicBtn');
            const maintenanceDeckBar = document.getElementById('maintenanceDeckBar');
            if (musicCard) musicCard.classList.add('hidden');
            if (floatingBtn) floatingBtn.classList.remove('hidden');
            if (maintenanceDeckBar) maintenanceDeckBar.classList.remove('hidden');`;

serverContent = serverContent.replace(closeMusicFnOld, closeMusicFnNew);

fs.writeFileSync('server.ts', serverContent, 'utf8');
console.log('Successfully updated Music Deck minimize behavior!');
