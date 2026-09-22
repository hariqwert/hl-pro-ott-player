const fs = require('fs');
let serverContent = fs.readFileSync('server.ts', 'utf8');

const openMusicPlayerFnStart = 'window.openMusicPlayerCard = function() {';
const openMusicPlayerFnCode = `window.openMusicPlayerCard = function() {
            const musicCard = document.getElementById('musicCard');
            const floatingBtn = document.getElementById('floatingMusicBtn');
            const maintenanceDeckBar = document.getElementById('maintenanceDeckBar');
            if (musicCard) musicCard.classList.remove('hidden');
            if (floatingBtn) floatingBtn.classList.add('hidden');
            if (maintenanceDeckBar) maintenanceDeckBar.classList.add('hidden');
            
            const bgCanvasContainer = document.getElementById('canvas-container');
            if (bgCanvasContainer) bgCanvasContainer.style.display = 'block';
            if (!animationFrameId && typeof animate === 'function') {
                animate();
            }
            if (typeof setupAudioReactivity === 'function') setupAudioReactivity();
        };`;

// Replace the old openMusicPlayerCard implementation
const startIndex = serverContent.indexOf(openMusicPlayerFnStart);
const endIndex = serverContent.indexOf('};', startIndex) + 2;

if (startIndex !== -1) {
    serverContent = serverContent.substring(0, startIndex) + openMusicPlayerFnCode + serverContent.substring(endIndex);
    fs.writeFileSync('server.ts', serverContent, 'utf8');
    console.log('Successfully fixed openMusicPlayerCard to hide bottom controller!');
} else {
    console.error('Could not find window.openMusicPlayerCard logic');
}
