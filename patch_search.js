const fs = require('fs');
let code = fs.readFileSync('consumet.html', 'utf8');

const targetStr = `        } else {
            try {
                const data = await fetchTMDB('search/multi', { query });
                const list = data?.results || [];
                if (list.length > 0) {
                    renderTMDBSearchResults(list, resultsContainer);
                    return;
                }
            } catch(e){}

            const backendRes = await fetch(\`/api/v1/search?q=\${encodeURIComponent(query)}\`).catch(() => null);
            if (backendRes && backendRes.ok) {
                const searchRes = await backendRes.json();
                if (searchRes.results && searchRes.results.length > 0) {
                    renderBackendSearchResults(searchRes.results, resultsContainer);
                    return;
                }
            }

            resultsContainer.innerHTML = \`<div class="text-center py-10 text-zinc-500 text-xs font-bold uppercase">No results found for "\${query}"</div>\`;
        }`;

const replaceStr = `        } else {
            let searchList = [];
            let fallbackUsed = null;
            
            try {
                const data = await fetchTMDB('search/multi', { query });
                searchList = data?.results || [];
                
                // INTELLIGENT AUTO SPELLING & FUZZY FALLBACK
                if (searchList.length === 0 && query.length > 3) {
                    // Try removing special chars
                    const cleaned = query.replace(/[^a-zA-Z0-9 ]/g, '').trim();
                    if (cleaned && cleaned !== query) {
                        const dataClean = await fetchTMDB('search/multi', { query: cleaned });
                        searchList = dataClean?.results || [];
                        if (searchList.length > 0) fallbackUsed = cleaned;
                    }
                    
                    // Try dropping the last word if multiple words
                    if (searchList.length === 0 && query.includes(' ')) {
                        const words = query.trim().split(' ');
                        words.pop(); // remove last word
                        const fallbackQuery = words.join(' ');
                        if (fallbackQuery.length > 2) {
                            const dataFallback = await fetchTMDB('search/multi', { query: fallbackQuery });
                            searchList = dataFallback?.results || [];
                            if (searchList.length > 0) fallbackUsed = fallbackQuery;
                        }
                    }
                }
            } catch(e){}

            if (searchList.length > 0) {
                if (fallbackUsed) {
                    resultsContainer.innerHTML = \`<div class="text-center py-2 text-amber-500 text-[10px] font-bold uppercase">No exact match. Showing similar results for: "\${fallbackUsed}"</div><div id="fallbackResultsGrid"></div>\`;
                    renderTMDBSearchResults(searchList, document.getElementById('fallbackResultsGrid'));
                } else {
                    renderTMDBSearchResults(searchList, resultsContainer);
                }
                return;
            }

            // Backend scraper fallback
            const backendRes = await fetch(\`/api/v1/search?q=\${encodeURIComponent(query)}\`).catch(() => null);
            if (backendRes && backendRes.ok) {
                const searchRes = await backendRes.json();
                if (searchRes.results && searchRes.results.length > 0) {
                    renderBackendSearchResults(searchRes.results, resultsContainer);
                    return;
                }
            }

            resultsContainer.innerHTML = \`<div class="text-center py-10 text-zinc-500 text-xs font-bold uppercase">No results found for "\${query}"</div>\`;
        }`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('consumet.html', code);
