const fs = require('fs');
let code = fs.readFileSync('src/services/bingrScraperService.ts', 'utf8');

const targetStr = `        const expectedType = params.type || 'movie';
        let bestMatch: any = null;
        let bestScore = 0;

        for (const item of results) {
            let score = 0;`;

const replaceStr = `        const expectedType = params.type || 'movie';
        let bestMatch: any = null;
        let bestScore = 0;

        for (const item of results) {
            let score = 0;
            const itemImdb = item.imdb_id || item.imdbId || '';
            if (params.id && String(params.id).startsWith('tt')) {
                 if (itemImdb === params.id) score += 1000; // Hard match
            }`;

code = code.replace(targetStr, replaceStr);

const targetReturn = `        if (bestMatch && bestMatch.id) {
            return {
                id: bestMatch.id,
                title: bestMatch.title || bestMatch.name,
                year: bestMatch.year || (bestMatch.release_date || bestMatch.first_air_date || '').slice(0, 4)
            };
        }
    } catch (e: any) {`;

const replaceReturn = `        if (bestMatch && bestMatch.id && bestScore > 20) {
            return {
                id: bestMatch.id,
                title: bestMatch.title || bestMatch.name,
                year: bestMatch.year || (bestMatch.release_date || bestMatch.first_air_date || '').slice(0, 4)
            };
        }
    } catch (e: any) {`;

code = code.replace(targetReturn, replaceReturn);

fs.writeFileSync('src/services/bingrScraperService.ts', code);
