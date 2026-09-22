const fs = require('fs');

function patchFile(file) {
    let content = fs.readFileSync(file, 'utf8');

    const muteBtnCode = `
            // --- GLOBAL PERSISTENT MUTE/UNMUTE BUTTON ---
            if (finalType !== 'image') {
                const existingMuteBtn = document.getElementById('globalBgMuteBtn');
                if (existingMuteBtn) existingMuteBtn.remove();

                const muteBtn = document.createElement('button');
                muteBtn.id = 'globalBgMuteBtn';
                // Initially muted (since autoplay requires it)
                let isMuted = true;
                
                const getIcon = (muted) => muted ? 
                    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>' : 
                    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>';
                
                muteBtn.innerHTML = getIcon(isMuted);
                muteBtn.title = "Toggle Background Audio";
                muteBtn.style.position = 'fixed';
                muteBtn.style.bottom = '20px';
                muteBtn.style.right = '20px';
                muteBtn.style.zIndex = '9999999';
                muteBtn.style.width = '44px';
                muteBtn.style.height = '44px';
                muteBtn.style.borderRadius = '50%';
                muteBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
                muteBtn.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                muteBtn.style.color = '#fff';
                muteBtn.style.display = 'flex';
                muteBtn.style.alignItems = 'center';
                muteBtn.style.justifyContent = 'center';
                muteBtn.style.cursor = 'pointer';
                muteBtn.style.backdropFilter = 'blur(10px)';
                muteBtn.style.transition = 'all 0.3s ease';
                muteBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
                
                muteBtn.onmouseover = () => { muteBtn.style.backgroundColor = 'rgba(34, 211, 238, 0.2)'; muteBtn.style.borderColor = 'rgba(34, 211, 238, 0.5)'; muteBtn.style.color = '#22d3ee'; };
                muteBtn.onmouseout = () => { muteBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.6)'; muteBtn.style.borderColor = 'rgba(255, 255, 255, 0.1)'; muteBtn.style.color = '#fff'; };
                
                muteBtn.onclick = () => {
                    isMuted = !isMuted;
                    muteBtn.innerHTML = getIcon(isMuted);
                    
                    // Hide the "Tap to enable" prompt if it's still there
                    const p = document.getElementById('bgUnmutePrompt');
                    if (p) p.style.display = 'none';

                    if (finalType === 'youtube' || (typeof type !== "undefined" && type === 'youtube')) {
                        const iframe = container.querySelector('iframe');
                        if (iframe && iframe.contentWindow) {
                            if (isMuted) {
                                iframe.contentWindow.postMessage('{"event":"command","func":"mute","args":""}', '*');
                            } else {
                                iframe.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}', '*');
                                iframe.contentWindow.postMessage('{"event":"command","func":"setVolume","args":[100]}', '*');
                            }
                        }
                    } else {
                        const video = container.querySelector('video');
                        if (video) {
                            video.muted = isMuted;
                            if (!isMuted) video.volume = 1;
                        }
                    }
                };
                document.body.appendChild(muteBtn);

                // If they click the prompt, sync this button's state
                const promptEl = document.getElementById('bgUnmutePrompt');
                if (promptEl) {
                    const originalOnClick = promptEl.onclick;
                    promptEl.onclick = (e) => {
                        if (originalOnClick) originalOnClick(e);
                        isMuted = false;
                        muteBtn.innerHTML = getIcon(isMuted);
                    };
                }
            }
            // ------------------------------------------------
`;

    // Inject after the prompt insertion
    content = content.replace(/document\.body\.appendChild\(prompt\);/g, "document.body.appendChild(prompt);\n" + muteBtnCode);

    fs.writeFileSync(file, content);
}

patchFile('public/background_injector.js');
patchFile('public/bg-inject.js');
