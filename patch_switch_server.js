const fs = require('fs');
let code = fs.readFileSync('play_bingr.php', 'utf8');

// Update switchServer to pass isManual = true
code = code.replace(/fetchAndPlayStream\(serverId\)\.then/g, "fetchAndPlayStream(serverId, true).then");

// Update fetchAndPlayStream signature
code = code.replace(/async function fetchAndPlayStream\(serverId\) \{/g, "async function fetchAndPlayStream(serverId, isManual = false) {");

// Update cascade fallback logic inside fetchAndPlayStream
const targetFallback1 = `                    console.warn('Server ' + serverId + ' returned no stream, auto-cascading...');
                    cascadeFallback(serverId);`;
const replaceFallback1 = `                    console.warn('Server ' + serverId + ' returned no stream.');
                    if (isManual) {
                        showLoading(false);
                        showToast('Content not available on ' + getServerName(serverId), 'error');
                        // Do not cascade if manually selected, just stay
                    } else {
                        cascadeFallback(serverId);
                    }`;
code = code.replace(targetFallback1, replaceFallback1);

const targetFallback2 = `            } catch (err) {
                console.error('Failed to fetch stream:', err);
                cascadeFallback(serverId);
            }`;
const replaceFallback2 = `            } catch (err) {
                console.error('Failed to fetch stream:', err);
                if (isManual) {
                    showLoading(false);
                    showToast('Failed to connect to ' + getServerName(serverId), 'error');
                } else {
                    cascadeFallback(serverId);
                }
            }`;
code = code.replace(targetFallback2, replaceFallback2);

fs.writeFileSync('play_bingr.php', code);
