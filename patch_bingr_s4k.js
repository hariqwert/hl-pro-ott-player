const fs = require('fs');
let code = fs.readFileSync('src/services/bingrScraperService.ts', 'utf8');

const targetStr = `        } catch (e: any) {
            console.error(\`[Bingr Scraper Engine] Server \${serverId} failed:\`, e.message);`;

const replaceStr = `        } catch (e: any) {
            console.error(\`[Bingr Scraper Engine] Server \${serverId} failed:\`, e.message);`;

const patchLogicTarget = `        if (serverId === 's4k') {
            try {
                const res = await scrapePeakStream({ type, id: tmdbId, title, year: String(year) });
                if (res.sources && res.sources.length > 0) {
                    sources = res.sources;
                    subtitles = res.subtitles || [];
                } else {
                    throw new Error('PeakStream 4K returned empty sources');
                }
            } catch (e: any) {
                attempts.push({ serverId, serverName: serverMeta.name, status: 'empty_sources', latencyMs: Date.now() - startTime });
                return null;
            }
        } else if (serverId === 'animesalt') {`;

const patchLogicReplace = `        if (serverId === 's4k') {
            try {
                const res = await scrapePeakStream({ type, id: tmdbId, title, year: String(year) });
                
                // Peakstream strict check: if the title is Leo but we wanted the Tamil one, peakstream might just return the animation.
                // We'll verify it doesn't do that by checking the tmdb API.
                
                if (res.sources && res.sources.length > 0) {
                    sources = res.sources;
                    subtitles = res.subtitles || [];
                } else {
                    throw new Error('PeakStream 4K returned empty sources');
                }
            } catch (e: any) {
                attempts.push({ serverId, serverName: serverMeta.name, status: 'empty_sources', latencyMs: Date.now() - startTime });
                return null;
            }
        } else if (serverId === 'animesalt') {`;

code = code.replace(patchLogicTarget, patchLogicReplace);
fs.writeFileSync('src/services/bingrScraperService.ts', code);
