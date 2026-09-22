const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// 1. Hide musicCard by default and add floating button
const target1 = `        <!-- Quantum Audio Music Card & Live Visualizer Deck -->
        <div id="musicCard" class="\${isRetired ? 'hidden' : 'glass-card'} rounded-[2rem] p-6 sm:p-7 shadow-2xl relative overflow-hidden transition-all duration-700 text-left">`;

const replacement1 = `        <!-- Floating Button to Open Music Card -->
        <div id="floatingMusicBtn" onclick="openMusicPlayerCard()" class="fixed bottom-6 left-6 z-[60] cursor-pointer bg-black/80 backdrop-blur-xl border border-cyan-500/30 p-4 rounded-full shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:scale-105 transition-all text-cyan-400 group">
            <i data-lucide="music" class="w-6 h-6 group-hover:animate-pulse"></i>
        </div>

        <!-- Quantum Audio Music Card & Live Visualizer Deck -->
        <div id="musicCard" class="hidden glass-card rounded-[2rem] p-6 sm:p-7 shadow-2xl relative overflow-hidden transition-all duration-700 text-left z-[70]">`;

code = code.replace(target1, replacement1);

// 2. Add Fullscreen and Blend buttons next to the other buttons
const target2 = `    <button onclick="toggleVisualizer()" class="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-400 rounded-xl border border-white/5 transition-all group cursor-pointer" title="Toggle Equalizer Frequency Bars / Wave Mode"><i data-lucide="bar-chart-2" class="w-4 h-4 group-hover:scale-110 transition-transform"></i></button>
    <button onclick="showPlaylistsManager()" class="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-400 rounded-xl border border-white/5 transition-all group cursor-pointer" title="Matrix Nodes"><i data-lucide="layers" class="w-4 h-4 group-hover:scale-110 transition-transform"></i></button>
                        <button onclick="closeMusicPlayerCard()" class="p-2 bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 rounded-xl border border-white/5 transition-all group cursor-pointer" title="Minimize / Hide Player (Music Keeps Playing)"><i data-lucide="minus" class="w-4 h-4 group-hover:scale-110 transition-transform"></i></button>`;

const replacement2 = `    <button onclick="toggleMusicCardFullScreen()" class="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-400 rounded-xl border border-white/5 transition-all group cursor-pointer" title="Toggle Full Screen"><i data-lucide="maximize" id="fullScreenIcon" class="w-4 h-4 group-hover:scale-110 transition-transform"></i></button>
    <button onclick="toggleVisualizerBlend()" class="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-400 rounded-xl border border-white/5 transition-all group cursor-pointer" title="Toggle Visualizer Blend Mode"><i data-lucide="layers" class="w-4 h-4 group-hover:scale-110 transition-transform"></i></button>
    <button onclick="toggleVisualizer()" class="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-400 rounded-xl border border-white/5 transition-all group cursor-pointer" title="Toggle Equalizer Frequency Bars / Wave Mode"><i data-lucide="bar-chart-2" class="w-4 h-4 group-hover:scale-110 transition-transform"></i></button>
    <button onclick="showPlaylistsManager()" class="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-400 rounded-xl border border-white/5 transition-all group cursor-pointer" title="Matrix Nodes"><i data-lucide="list-music" class="w-4 h-4 group-hover:scale-110 transition-transform"></i></button>
                        <button onclick="closeMusicPlayerCard()" class="p-2 bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 rounded-xl border border-white/5 transition-all group cursor-pointer" title="Minimize / Hide Player (Music Keeps Playing)"><i data-lucide="x" class="w-4 h-4 group-hover:scale-110 transition-transform"></i></button>`;

code = code.replace(target2, replacement2);

// 3. Add JS functions for toggleMusicCardFullScreen and toggleVisualizerBlend
const target3 = `        function closeMusicPlayerCard() {
            const musicCard = document.getElementById('musicCard');
            if (musicCard) musicCard.classList.add('hidden');`;

const replacement3 = `        let isMusicCardFullScreen = false;
        function toggleMusicCardFullScreen() {
            const musicCard = document.getElementById('musicCard');
            const fsIcon = document.getElementById('fullScreenIcon');
            if (!musicCard) return;
            
            isMusicCardFullScreen = !isMusicCardFullScreen;
            if (isMusicCardFullScreen) {
                musicCard.classList.remove('rounded-[2rem]', 'relative', 'overflow-hidden');
                musicCard.classList.add('fixed', 'inset-0', 'rounded-none', 'overflow-y-auto', 'w-full', 'h-full', 'z-[80]');
                if (fsIcon) {
                    fsIcon.setAttribute('data-lucide', 'minimize');
                    if (window.lucide) lucide.createIcons();
                }
            } else {
                musicCard.classList.add('rounded-[2rem]', 'relative', 'overflow-hidden');
                musicCard.classList.remove('fixed', 'inset-0', 'rounded-none', 'overflow-y-auto', 'w-full', 'h-full', 'z-[80]');
                if (fsIcon) {
                    fsIcon.setAttribute('data-lucide', 'maximize');
                    if (window.lucide) lucide.createIcons();
                }
            }
        }

        let isVisualizerBlended = true;
        function toggleVisualizerBlend() {
            const visCanvas = document.getElementById('visualizerCanvas');
            if (!visCanvas) return;
            isVisualizerBlended = !isVisualizerBlended;
            if (isVisualizerBlended) {
                visCanvas.classList.add('mix-blend-screen', 'opacity-50');
                visCanvas.classList.remove('opacity-100');
            } else {
                visCanvas.classList.remove('mix-blend-screen', 'opacity-50');
                visCanvas.classList.add('opacity-100');
            }
        }

        function closeMusicPlayerCard() {
            const musicCard = document.getElementById('musicCard');
            const floatingBtn = document.getElementById('floatingMusicBtn');
            if (musicCard) musicCard.classList.add('hidden');
            if (floatingBtn) floatingBtn.classList.remove('hidden');`;

code = code.replace(target3, replacement3);

// 4. Update openMusicPlayerCard
const target4 = `        window.openMusicPlayerCard = startMaintenanceExperience;`;

const replacement4 = `        window.openMusicPlayerCard = function() {
            const musicCard = document.getElementById('musicCard');
            const floatingBtn = document.getElementById('floatingMusicBtn');
            if (musicCard) musicCard.classList.remove('hidden');
            if (floatingBtn) floatingBtn.classList.add('hidden');
            
            const bgCanvasContainer = document.getElementById('canvas-container');
            if (bgCanvasContainer) bgCanvasContainer.style.display = 'block';
            if (!animationFrameId && typeof animate === 'function') {
                animate();
            }
            if (typeof setupAudioReactivity === 'function') setupAudioReactivity();
        };`;

code = code.replace(target4, replacement4);

fs.writeFileSync('server.ts', code);
