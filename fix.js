const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const anchor = `<div>
                                <h3 class="text-base sm:text-lg font-bold tracking-tight text-white">QUANTUM AUDIO</h3>`;

const htmlToAdd = `        <!-- Quantum Audio Music Card Deck -->
        <div id="musicCard" class="hidden glass-card rounded-2xl sm:rounded-[2rem] p-3.5 sm:p-7 shadow-2xl relative overflow-hidden transition-all duration-700 text-left z-[70]">
            <div class="relative z-10 space-y-5">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 sm:pb-4 border-b border-white/10 gap-2.5">
                    <div class="text-left flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
                        <div class="flex items-center gap-2.5">
                            <div class="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20 flex-shrink-0"><i data-lucide="radio" class="w-5 h-5 text-cyan-400"></i></div>
                            `;

if (code.includes('id="musicCard"')) {
    console.log("musicCard already exists");
} else {
    code = code.replace(anchor, htmlToAdd + anchor);
    fs.writeFileSync('server.ts', code, 'utf8');
    console.log("Restored musicCard tags!");
}
