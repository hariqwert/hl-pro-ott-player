const fs = require('fs');
let code = fs.readFileSync('play_bingr.php', 'utf8');

const targetStr = `        function switchPlayerMode(mode, providerId = 'vidrift') {
            playerMode = mode;`;

const replaceStr = `        function switchPlayerMode(mode, providerId = 'vidrift') {
            // Prevent auto-switching to embed mode to stop fake videos
            if (mode === 'embed' && hlsInstance) {
                 console.log("Embed mode intentionally blocked for safety.");
                 return;
            }
            playerMode = mode;`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('play_bingr.php', code);
