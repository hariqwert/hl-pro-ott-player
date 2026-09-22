const fs = require('fs');
let html = fs.readFileSync('consumet.html', 'utf8');

// 1. Add "Channels" option to search Engine Source
html = html.replace(
    '<option value="anilist">Anime (AniList)</option>',
    '<option value="anilist">Anime (AniList)</option>\n<option value="channels">Live Channels</option>'
);

// 2. Add handling in executeSearch()
const newExecuteSearch = `
    try {
        if (source === 'channels') {
            const list = (window.allSportsChannels || []).filter(c => (c.name || c.Name || '').toLowerCase().includes(query.toLowerCase()));
            if (list.length === 0) {
                resultsContainer.innerHTML = \`<div class="text-center py-10 text-slate-500 text-xs font-bold uppercase tracking-widest">No channels found</div>\`;
                return;
            }
            resultsContainer.innerHTML = '';
            resultsContainer.className = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 p-2";
            
            list.forEach(ch => {
                const name = ch.name || ch.Name || 'Unknown';
                const logo = ch.logo || ch.stream_icon || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=0f172a&color=f59e0b&bold=true';
                const card = document.createElement('div');
                card.className = "bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden hover:border-amber-500/50 transition-all cursor-pointer group hover:-translate-y-1";
                card.onclick = () => { closeSearchPalette(); openFullscreenPlayer(ch.url || ch.stream_url, name); };
                card.innerHTML = \`
                    <div class="aspect-video relative bg-black flex items-center justify-center p-4">
                        <img src="\${logo}" class="max-w-full max-h-full object-contain drop-shadow-md group-hover:scale-110 transition-transform">
                        <div class="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>
                        <div class="absolute bottom-2 left-2 right-2 flex justify-between items-end">
                            <span class="text-xs font-bold text-white truncate max-w-[80%]">\${name}</span>
                            <i data-lucide="play-circle" class="w-4 h-4 text-amber-500"></i>
                        </div>
                    </div>
                \`;
                resultsContainer.appendChild(card);
            });
            try { lucide.createIcons({ root: resultsContainer }); } catch(e) {}
            return;
        }
        
        if (source === 'anilist') {
`;
html = html.replace("if (source === 'anilist') {", newExecuteSearch);

fs.writeFileSync('consumet.html', html);
console.log('Patched consumet.html');
