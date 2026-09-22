const fs = require('fs');
let code = fs.readFileSync('src/services/movies4uService.ts', 'utf8');

const target1 = `    let targetTitle = query;
    let tmdbId = rawId;

    // 1. If ID is numeric (TMDB ID) or starts with tt (IMDB ID), fetch TMDB metadata if title is missing
    if ((/^\\d+$/.test(rawId) || rawId.startsWith('tt')) && (!targetTitle || targetTitle.length < 2)) {
        try {
            const apiKey = process.env.TMDB_API_KEY || 'a07e22bc18f5cb106bfe4cc1f83ad8ed';
            const tmdbRes = await axios.get(\`https://api.themoviedb.org/3/\${mediaType}/\${rawId}?api_key=\${apiKey}\`, { timeout: 3000 });
            if (tmdbRes.data) {
                targetTitle = tmdbRes.data.title || tmdbRes.data.name || targetTitle;
                tmdbId = String(tmdbRes.data.id || rawId);
            }
        } catch (e: any) {}
    }`;

const replace1 = `    let targetTitle = query;
    let tmdbId = rawId;
    let releaseYear = '';
    let imdbId = '';
    let originalTitle = '';

    // 1. Always fetch TMDB metadata if ID is numeric or starts with tt, to get year and original title for accurate double-checking
    if (/^\\d+$/.test(rawId) || rawId.startsWith('tt')) {
        try {
            const apiKey = process.env.TMDB_API_KEY || 'a07e22bc18f5cb106bfe4cc1f83ad8ed';
            const tmdbIdToFetch = rawId.startsWith('tt') ? rawId : String(rawId);
            const tmdbRes = await axios.get(\`https://api.themoviedb.org/3/\${mediaType === 'tv' ? 'tv' : 'movie'}/\${tmdbIdToFetch}?api_key=\${apiKey}\`, { timeout: 3000 });
            if (tmdbRes.data) {
                if (!targetTitle || targetTitle.length < 2) {
                    targetTitle = tmdbRes.data.title || tmdbRes.data.name || targetTitle;
                }
                tmdbId = String(tmdbRes.data.id || rawId);
                const releaseDate = tmdbRes.data.release_date || tmdbRes.data.first_air_date || '';
                if (releaseDate) {
                    releaseYear = releaseDate.substring(0, 4);
                }
                imdbId = tmdbRes.data.imdb_id || '';
                originalTitle = tmdbRes.data.original_title || tmdbRes.data.original_name || '';
            }
        } catch (e: any) {}
    }`;

code = code.replace(target1, replace1);

const target2 = `                    const targetPageUrl = selectBestMovies4uPostUrl(postLinks, searchHtml, queryWithEp);`;
const replace2 = `                    const targetPageUrl = selectBestMovies4uPostUrl(postLinks, searchHtml, queryWithEp, releaseYear, originalTitle);`;

code = code.replace(target2, replace2);

const target3 = `export function selectBestMovies4uPostUrl(postLinks: string[], searchHtml: string, query: string): string {`;
const replace3 = `export function selectBestMovies4uPostUrl(postLinks: string[], searchHtml: string, query: string, yearHint?: string, originalTitleHint?: string): string {`;

code = code.replace(target3, replace3);

const target4 = `        // Query words matching in slug
        for (const w of queryWords) {
            if (l.includes(w)) score += 40;
        }

        // 1. Check if URL slug contains Malayalam`;
const replace4 = `        // Query words matching in slug
        for (const w of queryWords) {
            if (l.includes(w)) score += 40;
        }

        // Double check by Year and Original Title (to distinguish e.g. Leo (Tamil) vs Leo (Animation))
        if (yearHint && l.includes(yearHint)) {
            score += 200; // huge boost for correct year
        }
        if (originalTitleHint) {
            const cleanOrg = originalTitleHint.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (cleanOrg && cleanOrg.length > 2 && l.replace(/[^a-z0-9]/g, '').includes(cleanOrg)) {
                score += 300; // massive boost for matching original title
            }
        }

        // 1. Check if URL slug contains Malayalam`;

code = code.replace(target4, replace4);

fs.writeFileSync('src/services/movies4uService.ts', code);
