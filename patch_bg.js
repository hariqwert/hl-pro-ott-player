const fs = require('fs');

function patchFile(file) {
    let content = fs.readFileSync(file, 'utf8');

    // Add enablejsapi=1 to youtube iframes if missing
    content = content.replace(/&modestbranding=1&playsinline=1/g, '&modestbranding=1&playsinline=1&enablejsapi=1');

    // Remove mute=1 from youtube iframes
    // Actually, leave mute=1 so it autoplays, we will unmute it via JS.

    const unmuteCode = `
            // --- SOUND SUPPORT (Background Audio Unmuter) ---
            const existingPrompt = document.getElementById('bgUnmutePrompt');
            if (existingPrompt) existingPrompt.remove();
            
            const prompt = document.createElement('div');
            prompt.id = 'bgUnmutePrompt';
            prompt.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;margin-right:8px;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg><span>Tap to enable background audio</span>';
            prompt.style.position = 'fixed';
            prompt.style.bottom = '40px';
            prompt.style.left = '50%';
            prompt.style.transform = 'translateX(-50%)';
            prompt.style.zIndex = '999999';
            prompt.style.padding = '10px 20px';
            prompt.style.borderRadius = '50px';
            prompt.style.backgroundColor = 'rgba(8, 51, 68, 0.85)';
            prompt.style.border = '1px solid rgba(34, 211, 238, 0.5)';
            prompt.style.color = '#67e8f9';
            prompt.style.fontSize = '12px';
            prompt.style.fontWeight = 'bold';
            prompt.style.cursor = 'pointer';
            prompt.style.backdropFilter = 'blur(10px)';
            prompt.style.boxShadow = '0 0 30px rgba(34,211,238,0.3)';
            prompt.style.display = 'flex';
            prompt.style.alignItems = 'center';
            prompt.style.animation = 'pulse 2s infinite';
            
            // Add pulse animation if not exists
            if (!document.getElementById('bgUnmuteStyle')) {
                const style = document.createElement('style');
                style.id = 'bgUnmuteStyle';
                style.innerHTML = '@keyframes pulse { 0% { transform: translateX(-50%) scale(1); } 50% { transform: translateX(-50%) scale(1.05); } 100% { transform: translateX(-50%) scale(1); } }';
                document.head.appendChild(style);
            }

            prompt.onclick = () => {
                if (finalType === 'youtube' || (typeof type !== "undefined" && type === 'youtube')) {
                    const iframe = container.querySelector('iframe');
                    if (iframe && iframe.contentWindow) {
                        iframe.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}', '*');
                        iframe.contentWindow.postMessage('{"event":"command","func":"setVolume","args":[100]}', '*');
                    }
                } else {
                    const video = container.querySelector('video');
                    if (video) {
                        video.muted = false;
                        video.volume = 1;
                    }
                }
                prompt.style.display = 'none';
            };
            document.body.appendChild(prompt);
            // ------------------------------------------------
`;

    // Inject just before container.appendChild(overlay) or document.body.prepend(container) or document.body.appendChild(container)
    if (file.includes('background_injector.js')) {
        content = content.replace(/document\.body\.appendChild\(container\);/g, unmuteCode + '\n            document.body.appendChild(container);');
    } else {
        content = content.replace(/container\.appendChild\(overlay\);/g, unmuteCode + '\n            container.appendChild(overlay);');
    }

    fs.writeFileSync(file, content);
}

patchFile('public/background_injector.js');
patchFile('public/bg-inject.js');
