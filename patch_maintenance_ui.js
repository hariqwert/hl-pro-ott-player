const fs = require('fs');

let serverContent = fs.readFileSync('server.ts', 'utf8');

// 1. Update Container classes for mobile sizing
serverContent = serverContent.replace(
    '<div id="quantumMaintenanceContainer" class="max-w-lg w-full z-10 relative space-y-5 my-auto">',
    '<div id="quantumMaintenanceContainer" class="max-w-[92vw] sm:max-w-lg w-full z-10 relative space-y-3 sm:space-y-5 my-auto px-1 sm:px-0 transition-all duration-300">'
);

// 2. Add Minimize button to top status badge bar
const oldBadgeBar = `<div class="\${isRetired ? 'hidden' : 'flex'} items-center justify-center gap-3 bg-black/40 border border-white/5 py-2 px-4 rounded-full w-fit mx-auto backdrop-blur-md shadow-lg">
            <div class="relative flex h-2.5 w-2.5">
              <span class="animate-ping absolute inline-flex h-full w-full \${badgeOuter}"></span>
              <span class="relative inline-flex rounded-full h-2.5 w-2.5 \${badgeInner}"></span>
            </div>
            <span class="text-[10px] font-bold uppercase tracking-widest \${badgeTextColor}">\${badgeLabel}</span>
        </div>`;

const newBadgeBar = `<div class="\${isRetired ? 'hidden' : 'flex'} items-center justify-between gap-3 bg-black/50 border border-cyan-500/20 py-1.5 px-3.5 rounded-full w-full max-w-xs sm:max-w-sm mx-auto backdrop-blur-md shadow-lg">
            <div class="flex items-center gap-2">
                <div class="relative flex h-2.5 w-2.5">
                  <span class="animate-ping absolute inline-flex h-full w-full \${badgeOuter}"></span>
                  <span class="relative inline-flex rounded-full h-2.5 w-2.5 \${badgeInner}"></span>
                </div>
                <span class="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest \${badgeTextColor}">\${badgeLabel}</span>
            </div>
            <button type="button" onclick="minimizeMaintenanceContainer()" class="text-[9px] font-mono font-bold text-cyan-400/80 hover:text-cyan-300 flex items-center gap-1 bg-cyan-500/10 hover:bg-cyan-500/20 px-2 py-0.5 rounded-full border border-cyan-500/20 transition-all cursor-pointer hover:scale-105" title="Minimize Maintenance Deck">
                <i data-lucide="minimize-2" class="w-3 h-3"></i>
                <span>Minimize</span>
            </button>
        </div>`;

serverContent = serverContent.replace(oldBadgeBar, newBadgeBar);

// 3. Add Floating Minimized Maintenance Pill before quantumMaintenanceContainer
const minPillHtml = `
    <!-- Floating Minimized Maintenance Bar Pill -->
    <div id="minimizedMaintenancePill" onclick="expandMaintenanceContainer()" class="hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] cursor-pointer items-center gap-2.5 px-4 py-2.5 rounded-full bg-black/90 border border-cyan-400/50 backdrop-blur-2xl shadow-[0_0_30px_rgba(34,211,238,0.4)] hover:scale-105 transition-all text-cyan-300 group select-none">
        <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full \${badgeOuter}"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 \${badgeInner}"></span>
        </span>
        <i data-lucide="shield-alert" class="w-4 h-4 text-cyan-400"></i>
        <span class="text-[10px] uppercase font-mono font-bold tracking-wider text-cyan-200 group-hover:text-cyan-100">\${title} (Expand Deck)</span>
        <div class="p-1 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 ml-1">
            <i data-lucide="maximize-2" class="w-3 h-3"></i>
        </div>
    </div>
    <!-- Main Quantum Theme Maintenance Center Container -->`;

serverContent = serverContent.replace('<!-- Main Quantum Theme Maintenance Center Container -->', minPillHtml);

// 4. Update musicCard container for mobile
serverContent = serverContent.replace(
    '<div id="musicCard" class="hidden glass-card rounded-[2rem] p-6 sm:p-7 shadow-2xl relative overflow-hidden transition-all duration-700 text-left z-[70]">',
    '<div id="musicCard" class="hidden glass-card rounded-2xl sm:rounded-[2rem] p-3.5 sm:p-7 shadow-2xl relative overflow-hidden transition-all duration-700 text-left z-[70]">'
);

// 5. Update musicCard artwork size for mobile
serverContent = serverContent.replace(
    '<div class="w-40 h-40 sm:w-48 sm:h-48 rounded-3xl overflow-hidden relative shadow-2xl border border-white/10 group">',
    '<div class="w-28 h-28 sm:w-48 sm:h-48 rounded-2xl sm:rounded-3xl overflow-hidden relative shadow-2xl border border-white/10 group">'
);

// 6. Update Minimize button inside musicCard header
const musicCardHeaderOld = `<button onclick="closeMusicPlayerCard()" class="p-2 bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 rounded-xl border border-white/5 transition-all group cursor-pointer" title="Minimize / Hide Player (Music Keeps Playing)"><i data-lucide="x" class="w-4 h-4 group-hover:scale-110 transition-transform"></i></button>`;
const musicCardHeaderNew = `<button onclick="minimizeMaintenanceContainer()" class="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-400 rounded-xl border border-white/5 transition-all group cursor-pointer" title="Minimize Whole Container"><i data-lucide="minimize-2" class="w-4 h-4 group-hover:scale-110 transition-transform"></i></button>
<button onclick="closeMusicPlayerCard()" class="p-2 bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 rounded-xl border border-white/5 transition-all group cursor-pointer" title="Minimize / Hide Player (Music Keeps Playing)"><i data-lucide="x" class="w-4 h-4 group-hover:scale-110 transition-transform"></i></button>`;

serverContent = serverContent.replace(musicCardHeaderOld, musicCardHeaderNew);

// 7. Update Eye Icon in HTML (default OFF: eye-off)
const oldEyeBtn = `<button onclick="toggleVisualizer()" id="visualizerToggleBtn" class="p-2 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]" title="Quantum Visualizer: Audio-Reactive Mode (Click for Autonomous Free State)"><i data-lucide="eye" id="visualizerToggleIcon" class="w-4 h-4"></i></button>`;
const newEyeBtn = `<button onclick="toggleReactiveEye()" id="visualizerToggleBtn" class="p-2 text-cyan-500/50 hover:text-cyan-400 transition-colors cursor-pointer" title="Quantum Visualizer: Autonomous Free State (Click for Audio-Reactive Mode)"><i data-lucide="eye-off" id="visualizerToggleIcon" class="w-4 h-4"></i></button>`;

serverContent = serverContent.replace(oldEyeBtn, newEyeBtn);

// 8. Update JS for isMusicReactive default = false, and toggleReactiveEye & minimizeMaintenanceContainer
serverContent = serverContent.replace(
    'let isMusicReactive = true; // true = audio-reactive; false = quantum free state',
    'let isMusicReactive = false; // default OFF on startup'
);

// Add toggleReactiveEye, minimizeMaintenanceContainer, expandMaintenanceContainer
const jsCodeToInject = `
        window.toggleReactiveEye = function() {
            isMusicReactive = !isMusicReactive;
            const icon = document.getElementById('visualizerToggleIcon');
            const btn = document.getElementById('visualizerToggleBtn');
            if (icon && btn) {
                if (isMusicReactive) {
                    icon.setAttribute('data-lucide', 'eye');
                    btn.className = 'p-2 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]';
                    btn.setAttribute('title', 'Quantum Visualizer: Audio-Reactive Mode (Click for Autonomous Free State)');
                } else {
                    icon.setAttribute('data-lucide', 'eye-off');
                    btn.className = 'p-2 text-cyan-500/50 hover:text-cyan-400 transition-colors cursor-pointer';
                    btn.setAttribute('title', 'Quantum Visualizer: Autonomous Free State (Click for Audio-Reactive Mode)');
                }
                if (window.lucide) lucide.createIcons();
            }
            if (!animationFrameId && typeof animate === 'function') {
                animationFrameId = requestAnimationFrame(animate);
            }
        };

        window.minimizeMaintenanceContainer = function() {
            const container = document.getElementById('quantumMaintenanceContainer');
            const pill = document.getElementById('minimizedMaintenancePill');
            if (container) container.classList.add('hidden');
            if (pill) {
                pill.classList.remove('hidden');
                pill.classList.add('flex');
            }
        };

        window.expandMaintenanceContainer = function() {
            const container = document.getElementById('quantumMaintenanceContainer');
            const pill = document.getElementById('minimizedMaintenancePill');
            if (pill) {
                pill.classList.add('hidden');
                pill.classList.remove('flex');
            }
            if (container) container.classList.remove('hidden');
        };
`;

serverContent = serverContent.replace(
    'window.toggleVisualizer = function() {',
    jsCodeToInject + '\n        window.toggleVisualizer = function() {'
);

// 9. Good Quality Sound - High Fidelity Audio Processing
const oldAudioSetup = `                audioContext = new AudioCtx();
                audioAnalyser = audioContext.createAnalyser();
                audioAnalyser.fftSize = 128;
                audioAnalyser.smoothingTimeConstant = 0.82;
                audioFreqData = new Uint8Array(audioAnalyser.frequencyBinCount);
                
                audioSourceNode = audioContext.createMediaElementSource(playerIndex);
                audioSourceNode.connect(audioAnalyser);
                audioAnalyser.connect(audioContext.destination);`;

const newAudioSetup = `                audioContext = new AudioCtx({ latencyHint: 'interactive' });
                audioAnalyser = audioContext.createAnalyser();
                audioAnalyser.fftSize = 256;
                audioAnalyser.smoothingTimeConstant = 0.8;
                audioFreqData = new Uint8Array(audioAnalyser.frequencyBinCount);
                
                const compressor = audioContext.createDynamicsCompressor();
                compressor.threshold.setValueAtTime(-24, audioContext.currentTime);
                compressor.knee.setValueAtTime(30, audioContext.currentTime);
                compressor.ratio.setValueAtTime(12, audioContext.currentTime);
                compressor.attack.setValueAtTime(0.003, audioContext.currentTime);
                compressor.release.setValueAtTime(0.25, audioContext.currentTime);

                const eqHigh = audioContext.createBiquadFilter();
                eqHigh.type = 'highshelf';
                eqHigh.frequency.setValueAtTime(4000, audioContext.currentTime);
                eqHigh.gain.setValueAtTime(1.5, audioContext.currentTime);

                audioSourceNode = audioContext.createMediaElementSource(playerIndex);
                audioSourceNode.connect(audioAnalyser);
                audioAnalyser.connect(eqHigh);
                eqHigh.connect(compressor);
                compressor.connect(audioContext.destination);`;

serverContent = serverContent.replace(oldAudioSetup, newAudioSetup);

fs.writeFileSync('server.ts', serverContent, 'utf8');
console.log('Successfully patched server.ts!');
