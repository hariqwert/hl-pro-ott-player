const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
    /<footer id="maintenanceDeckBar" class="fixed bottom-0 left-0 w-full z-40 bg-black\/90 backdrop-blur-2xl border-t border-cyan-500\/20 px-3 sm:px-6 py-2 sm:py-3 shadow-\[0_-10px_40px_rgba\(0,0,0,0\.85\)\] transition-all duration-300 flex flex-col gap-1\.5">/g,
    '<footer id="maintenanceDeckBar" class="hidden fixed bottom-0 left-0 w-full z-40 bg-black/90 backdrop-blur-2xl border-t border-cyan-500/20 px-3 sm:px-6 py-2 sm:py-3 shadow-[0_-10px_40px_rgba(0,0,0,0.85)] transition-all duration-300 flex flex-col gap-1.5">'
);

fs.writeFileSync('server.ts', code);
