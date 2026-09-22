const fs = require('fs');
let code = fs.readFileSync('play_bingr.php', 'utf8');

const targetStr = `        function cascadeFallback(failedServerId) {
            const fallbackOrder = ['s70', 's62', 'animesalt', 'm4u', 's3', 's30', 's4k', 's40'];
            const nextServer = fallbackOrder.find(srv => srv !== failedServerId);
            if (nextServer) {
                fetchAndPlayStream(nextServer);
            } else {
                showLoading(false);
                switchPlayerMode('embed');
            }
        }`;

const replaceStr = `        let failedServers = new Set();
        function cascadeFallback(failedServerId) {
            failedServers.add(failedServerId);
            const fallbackOrder = ['s70', 's62', 'animesalt', 'm4u', 's3', 's30', 's4k', 's40'];
            const nextServer = fallbackOrder.find(srv => !failedServers.has(srv));
            if (nextServer) {
                fetchAndPlayStream(nextServer);
            } else {
                showLoading(false);
                failedServers.clear(); // reset for manual retries
                switchPlayerMode('embed');
            }
        }`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('play_bingr.php', code);
