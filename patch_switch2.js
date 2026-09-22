const fs = require('fs');
let code = fs.readFileSync('play_bingr.php', 'utf8');

const targetStr = `            if (mode === 'embed' && hlsInstance) {
                 console.log("Embed mode intentionally blocked for safety.");
                 return;
            }`;

const replaceStr = ``;

code = code.replace(targetStr, replaceStr);

const targetBlock = `        function switchPlayerMode(mode, providerId = 'vidrift') {`;
const replaceBlock = `        function switchPlayerMode(mode, providerId = 'vidrift', isManualTrigger = false) {
            // Prevent auto-switching to embed mode to stop fake videos unless manually clicked by user
            if (mode === 'embed' && !isManualTrigger) {
                 console.log("Auto-embed mode intentionally blocked for safety.");
                 return;
            }`;

code = code.replace(targetBlock, replaceBlock);


const targetOnClick = `<button onclick="switchPlayerMode('embed')"`;
const replaceOnClick = `<button onclick="switchPlayerMode('embed', 'vidrift', true)"`;

code = code.replace(targetOnClick, replaceOnClick);

const targetOnClickGrid = `switchPlayerMode('embed', '\${prov.id}')`;
const replaceOnClickGrid = `switchPlayerMode('embed', '\${prov.id}', true)`;
code = code.replace(targetOnClickGrid, replaceOnClickGrid);


fs.writeFileSync('play_bingr.php', code);
