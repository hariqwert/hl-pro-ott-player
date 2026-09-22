const fs = require('fs');
let serverContent = fs.readFileSync('server.ts', 'utf8');

const musicCardStart = '<div id="musicCard"';
const searchInputStart = '<div class="flex gap-2">';

const startIndex = serverContent.indexOf(musicCardStart);
const endIndex = serverContent.indexOf(searchInputStart, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
    const replacement = `<div id="musicCard" class="hidden glass-card rounded-2xl sm:rounded-[2rem] p-3.5 sm:p-7 shadow-2xl relative overflow-hidden transition-all duration-700 text-left z-[70]">
            <div class="relative z-10 space-y-5">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 sm:pb-4 border-b border-white/10 gap-2.5">
                    <div class="text-left flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
                        <div class="flex items-center gap-2.5">
                            <div class="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20 flex-shrink-0"><i data-lucide="radio" class="w-5 h-5 text-cyan-400"></i></div>
                            <div>
                                <h3 class="text-base sm:text-lg font-bold tracking-tight text-white">QUANTUM AUDIO</h3>
                                <p class="text-[9px] uppercase font-bold text-cyan-500 tracking-widest mt-0.5">Secure Network Stream</p>
                            </div>
                        </div>
                    </div>

                    <!-- DESKTOP & MOBILE CONTROL TOOLBAR -->
                    <div class="flex items-center justify-end gap-1.5 sm:gap-2 flex-wrap w-full sm:w-auto">
                        <div class="relative group">
                            <button class="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-400 rounded-xl border border-white/5 transition-all cursor-pointer" title="Player Opacity">
                                <i data-lucide="settings-2" class="w-4 h-4"></i>
                            </button>
                            <div class="absolute right-0 top-full mt-2 hidden group-hover:block bg-black/90 border border-cyan-500/30 p-3 rounded-xl z-50">
                                <label class="text-[9px] text-cyan-400 font-bold uppercase tracking-widest block mb-2">Opacity</label>
                                <input type="range" id="musicCardOpacity" min="0.2" max="1" step="0.1" value="1" oninput="document.getElementById('musicCard').style.opacity = this.value" class="w-24 accent-cyan-500">
                            </div>
                        </div>
                        <button onclick="toggleMusicCardFullScreen()" class="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-400 rounded-xl border border-white/5 transition-all group cursor-pointer" title="Toggle Full Screen"><i data-lucide="maximize" id="fullScreenIcon" class="w-4 h-4 group-hover:scale-110 transition-transform"></i></button>
                        <button onclick="toggleVisualizerBlend()" class="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-400 rounded-xl border border-white/5 transition-all group cursor-pointer" title="Toggle Visualizer Blend Mode"><i data-lucide="layers" class="w-4 h-4 group-hover:scale-110 transition-transform"></i></button>
                        <button onclick="toggleVisualizer()" class="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-400 rounded-xl border border-white/5 transition-all group cursor-pointer" title="Toggle Equalizer Frequency Bars / Wave Mode"><i data-lucide="bar-chart-2" class="w-4 h-4 group-hover:scale-110 transition-transform"></i></button>
                        <button onclick="showPlaylistsManager()" class="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-400 rounded-xl border border-white/5 transition-all group cursor-pointer" title="Matrix Nodes"><i data-lucide="list-music" class="w-4 h-4 group-hover:scale-110 transition-transform"></i></button>
                        
                        <!-- PROMINENT MINIMIZE BUTTON -->
                        <button type="button" onclick="closeMusicPlayerCard()" class="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_12px_rgba(34,211,238,0.25)] hover:scale-105 active:scale-95 ml-1" title="Minimize Music Deck">
                            <i data-lucide="minimize-2" class="w-4 h-4 text-cyan-300"></i>
                            <span class="hidden sm:inline">Minimize</span>
                        </button>
                    </div>
                </div>
                `;
    
    serverContent = serverContent.substring(0, startIndex) + replacement + serverContent.substring(endIndex);
    fs.writeFileSync('server.ts', serverContent, 'utf8');
    console.log('Successfully fixed duplicate buttons in music deck header!');
} else {
    console.error('Failed to find tags in server.ts', { startIndex, endIndex });
}
