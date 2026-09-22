const fs = require('fs');

let serverContent = fs.readFileSync('server.ts', 'utf8');

const startTag = '<!-- Main Quantum Theme Maintenance Center Container -->';
const endTag = '<!-- Quantum Audio Music Card Deck -->';

const startIndex = serverContent.indexOf(startTag);
const endIndex = serverContent.indexOf(endTag);

if (startIndex !== -1 && endIndex !== -1) {
    const replacement = `<!-- Main Quantum Theme Maintenance Center Container -->
    <div id="quantumMaintenanceContainer" class="max-w-[92vw] sm:max-w-lg w-full z-10 relative my-auto px-1 sm:px-0 transition-all duration-300">
        <!-- Primary Maintenance Glass Card -->
        <div class="glass-card p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-cyan-500/30 relative shadow-[0_0_50px_rgba(34,211,238,0.2)] space-y-4 text-center backdrop-blur-2xl bg-black/75">
            
            <!-- Header Row with Status Badge & PROMINENT MINIMIZE BUTTON -->
            <div class="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div class="flex items-center gap-2 bg-black/50 border border-white/10 py-1 px-3 rounded-full backdrop-blur-md shadow-sm">
                    <div class="relative flex h-2.5 w-2.5">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full \${badgeOuter}"></span>
                      <span class="relative inline-flex rounded-full h-2.5 w-2.5 \${badgeInner}"></span>
                    </div>
                    <span class="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest \${badgeTextColor}">\${badgeLabel}</span>
                </div>

                <!-- PROMINENT MINIMIZE BUTTON -->
                <button type="button" onclick="minimizeMaintenanceContainer()" class="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/40 text-cyan-300 text-xs font-bold font-mono flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_15px_rgba(34,211,238,0.25)] hover:scale-105 active:scale-95" title="Minimize Maintenance Deck">
                    <i data-lucide="minimize-2" class="w-4 h-4"></i>
                    <span>Minimize</span>
                </button>
            </div>

            \${isRetired ? \`
            <div class="flex justify-center mb-2">
                <div class="p-3 bg-white/5 border border-white/10 rounded-2xl shadow-xl">
                    <svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                </div>
            </div>
            \` : ''}

            <!-- Maintenance Title & Status Description -->
            <div class="space-y-2.5 py-1">
                <h1 class="\${isRetired ? 'text-2xl sm:text-3xl font-light tracking-widest text-slate-200' : 'text-xl sm:text-3xl font-black tracking-tighter text-white'} drop-shadow-lg relative">\${title}</h1>
                <p class="\${descriptionColor} text-xs sm:text-sm leading-relaxed font-medium relative max-w-md mx-auto">\${description}</p>
            </div>

            <!-- Action Controls -->
            <div class="pt-2 flex items-center justify-center gap-2 border-t border-white/5">
                <button type="button" onclick="openMusicPlayerCard()" class="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer">
                    <i data-lucide="music" class="w-4 h-4 text-cyan-400"></i>
                    <span>Quantum Audio Deck</span>
                </button>
                <button type="button" onclick="minimizeMaintenanceContainer()" class="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer" title="Minimize to View Background Visuals">
                    <i data-lucide="eye" class="w-4 h-4 text-slate-400"></i>
                    <span>Hide Container</span>
                </button>
            </div>
        </div>

        <!-- Floating Button to Open Music Card -->
        <div id="floatingMusicBtn" onclick="openMusicPlayerCard()" class="fixed bottom-6 left-6 z-[60] cursor-pointer bg-black/80 backdrop-blur-xl border border-cyan-500/30 p-4 rounded-full shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:scale-105 transition-all text-cyan-400 group">
            <i data-lucide="music" class="w-6 h-6 group-hover:animate-pulse"></i>
        </div>

        `;

    serverContent = serverContent.substring(0, startIndex) + replacement + serverContent.substring(endIndex);
    fs.writeFileSync('server.ts', serverContent, 'utf8');
    console.log('Successfully replaced maintenance container with prominent glass card & minimize buttons!');
} else {
    console.error('Failed to find tags in server.ts', { startIndex, endIndex });
}
