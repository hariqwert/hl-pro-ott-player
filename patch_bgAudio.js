const fs = require('fs');

// Patch hari.html
let hariHtml = fs.readFileSync('public/hari.html', 'utf8');
const targetHtml = `                            <!-- Preview & Current Selection -->
                            <div class="p-3.5 rounded-xl bg-black/50 border border-white/5 space-y-3">`;
const replacementHtml = `                            <!-- Target Page Selector -->
                            <div class="space-y-1">
                                <label class="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block">Target Page</label>
                                <select id="bgAudioTarget" class="w-full bg-gray-900/60 border border-gray-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white outline-none">
                                    <option value="global">Global (All Pages)</option>
                                    <option value="hero">Hero / Aetheris</option>
                                    <option value="music">Music Lounge</option>
                                    <option value="consumet">Cinema / Stream</option>
                                    <option value="index">Main Portal</option>
                                </select>
                            </div>
                            <!-- Preview & Current Selection -->
                            <div class="p-3.5 rounded-xl bg-black/50 border border-white/5 space-y-3">`;
hariHtml = hariHtml.replace(targetHtml, replacementHtml);
fs.writeFileSync('public/hari.html', hariHtml);

// Patch hari.js
let hariJs = fs.readFileSync('public/hari.js', 'utf8');
const targetJs1 = `                    if(data.backgrounds.globalAudio.thumbnail) document.getElementById('bgAudioSelectedImg').src = data.backgrounds.globalAudio.thumbnail;`;
const replacementJs1 = `                    if(data.backgrounds.globalAudio.thumbnail) document.getElementById('bgAudioSelectedImg').src = data.backgrounds.globalAudio.thumbnail;
                    if(document.getElementById('bgAudioTarget') && data.backgrounds.globalAudio.target) {
                        document.getElementById('bgAudioTarget').value = data.backgrounds.globalAudio.target;
                    }`;
hariJs = hariJs.replace(targetJs1, replacementJs1);

const targetJs2 = `            thumbnail: document.getElementById('bgAudioSelectedImg').src
        }
    };`;
const replacementJs2 = `            thumbnail: document.getElementById('bgAudioSelectedImg').src,
            target: document.getElementById('bgAudioTarget') ? document.getElementById('bgAudioTarget').value : 'global'
        }
    };`;
hariJs = hariJs.replace(targetJs2, replacementJs2);
fs.writeFileSync('public/hari.js', hariJs);

// Patch bg-inject.js
let bgInject = fs.readFileSync('public/bg-inject.js', 'utf8');
const targetInject = `        if (config.globalAudio && config.globalAudio.url && config.globalAudio.url.trim() !== '') {
            window.injectGlobalAudio(config.globalAudio.url.trim());
        }`;
const replacementInject = `        if (config.globalAudio && config.globalAudio.url && config.globalAudio.url.trim() !== '') {
            const target = config.globalAudio.target || 'global';
            let shouldPlay = false;
            const p = window.location.pathname.toLowerCase();
            if (target === 'global') shouldPlay = true;
            else if (target === 'hero' && (p.includes('hero.html') || p === '/hero')) shouldPlay = true;
            else if (target === 'music' && (p.includes('music.html') || p.includes('music'))) shouldPlay = true;
            else if (target === 'consumet' && (p.includes('consumet') || p === '/cinema')) shouldPlay = true;
            else if (target === 'index' && (p.includes('index') || p === '/' || p === '/tv')) shouldPlay = true;

            if (shouldPlay) {
                window.injectGlobalAudio(config.globalAudio.url.trim());
            }
        }`;
bgInject = bgInject.replace(targetInject, replacementInject);
fs.writeFileSync('public/bg-inject.js', bgInject);

console.log("Patched backgrounds for page-specific ambient audio");
