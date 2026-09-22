const fs = require('fs');
let code = fs.readFileSync('play_bingr.php', 'utf8');

const targetStr = `            mainVideo.addEventListener('ended', () => {
                if (MEDIA_TYPE === 'tv') {
                    showToast('Episode finished! Auto-playing next episode...');
                    setTimeout(() => {
                        playNextEpisode();
                    }, 1200);
                }
            });`;

const replaceStr = `            mainVideo.addEventListener('ended', () => {
                if (MEDIA_TYPE === 'tv') {
                    showToast('Episode finished! Auto-playing next episode...');
                    setTimeout(() => {
                        playNextEpisode();
                    }, 1200);
                } else {
                    const firstRec = window.recommendations && window.recommendations.length > 0 ? window.recommendations[0] : null;
                    if (firstRec) {
                        showToast('Movie finished! Auto-playing recommended movie...');
                        setTimeout(() => {
                            switchMovie(firstRec.id, firstRec.media_type || 'movie', firstRec.title || firstRec.name);
                        }, 5000);
                    }
                }
            });`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('play_bingr.php', code);
