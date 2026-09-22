const fs = require('fs');
let code = fs.readFileSync('play_bingr.php', 'utf8');

const targetStr = `            if (nextServer) {
                fetchAndPlayStream(nextServer);
            } else {
                showLoading(false);
                failedServers.clear(); // reset for manual retries
                switchPlayerMode('embed');
            }`;

const replaceStr = `            if (nextServer) {
                fetchAndPlayStream(nextServer);
            } else {
                showLoading(false);
                failedServers.clear(); // reset for manual retries
                showToast('Stream not found on any primary server.', 'error');
                // Do not auto-switch to embed, as it may play fake/unrelated movies.
                // Just stay on the screen and let the user manually try embeds if they want.
            }`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('play_bingr.php', code);
