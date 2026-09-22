const fs = require('fs');
let code = fs.readFileSync('consumet.html', 'utf8');

const target = `        const card = document.createElement('div');
        card.className = "bg-zinc-900 border border-white/10 hover:border-red-500/50 rounded-2xl overflow-hidden cursor-pointer group transition-all transform hover:-translate-y-1";
        card.onclick = () => {
            closeSearchPalette();
            openDetails(item.id, type, title);
        };
        card.innerHTML = \`
            <div class="aspect-[2/3] relative overflow-hidden bg-black">
                <img loading="lazy" src="\${poster}" class="w-full h-full object-cover group-hover:scale-105 transition-transform">
                <div class="absolute top-2 right-2 bg-black/70 px-2 py-0.5 rounded-full text-[9px] font-bold text-amber-400 border border-white/10 flex items-center gap-1">
                    <i data-lucide="star" class="w-3 h-3 fill-amber-400"></i> \${rating}
                </div>
            </div>
            <div class="p-3">
                <h4 class="text-xs font-bold text-white truncate" title="\${title}">\${title}</h4>
                <div class="flex items-center justify-between text-[9px] font-bold text-zinc-400 uppercase mt-1">
                    <span>\${type === 'tv' ? 'TV Series' : 'Movie'}</span>
                    <span>\${year}</span>
                </div>
            </div>
        \`;`;

const replace = `        const lang = (item.original_language || '').toUpperCase();
        const overview = (item.overview || '').substring(0, 45) + (item.overview && item.overview.length > 45 ? '...' : '');
        
        const card = document.createElement('div');
        card.className = "bg-zinc-900 border border-white/10 hover:border-amber-500/50 rounded-2xl overflow-hidden cursor-pointer group transition-all transform hover:-translate-y-1";
        card.onclick = () => {
            closeSearchPalette();
            openDetails(item.id, type, title);
        };
        card.innerHTML = \`
            <div class="aspect-[2/3] relative overflow-hidden bg-black">
                <img loading="lazy" src="\${poster}" class="w-full h-full object-cover group-hover:scale-105 transition-transform">
                <div class="absolute top-2 right-2 bg-black/70 px-2 py-0.5 rounded-full text-[9px] font-bold text-amber-400 border border-white/10 flex items-center gap-1">
                    <i data-lucide="star" class="w-3 h-3 fill-amber-400"></i> \${rating}
                </div>
                <div class="absolute bottom-2 left-2 bg-black/80 px-2 py-0.5 rounded-md text-[9px] font-bold text-white border border-white/10">
                    \${lang || 'EN'}
                </div>
            </div>
            <div class="p-3">
                <h4 class="text-xs font-bold text-white truncate" title="\${title}">\${title}</h4>
                <p class="text-[9px] text-zinc-500 mt-0.5 truncate" title="\${item.overview || ''}">\${overview || 'No description'}</p>
                <div class="flex items-center justify-between text-[9px] font-bold text-zinc-400 uppercase mt-1.5 pt-1.5 border-t border-white/5">
                    <span>\${type === 'tv' ? 'TV Series' : 'Movie'}</span>
                    <span class="text-amber-400/80">ID: \${item.id}</span>
                    <span>\${year}</span>
                </div>
            </div>
        \`;`;

code = code.replace(target, replace);
fs.writeFileSync('consumet.html', code);
