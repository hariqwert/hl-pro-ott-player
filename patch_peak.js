const fs = require('fs');
let code = fs.readFileSync('src/services/peakStreamService.ts', 'utf8');

const target1 = `    if (!title || !year) {
        try {
            const details = type === 'tv' ? await getTvDetails(tmdbId) : await getMovieDetails(tmdbId);
            if (!title) title = details.title;
            if (!year && details.year) year = String(details.year);
        } catch {}
    }`;

const replace1 = `    let realImdbId = '';
    try {
        const details = type === 'tv' ? await getTvDetails(tmdbId) : await getMovieDetails(tmdbId);
        if (!title) title = details.title;
        if (!year && details.year) year = String(details.year);
        // Sometimes details contains imdb_id (but BingrMediaDetails might not have it unless we fetch external_ids)
        // Let's just try to fetch it directly from TMDB if possible
        const apiKey = process.env.TMDB_API_KEY || 'a07e22bc18f5cb106bfe4cc1f83ad8ed';
        const axios = require('axios');
        const extRes = await axios.get(\`https://api.themoviedb.org/3/\${type === 'tv' ? 'tv' : 'movie'}/\${tmdbId}?api_key=\${apiKey}\`, { timeout: 3000 });
        if (extRes.data && extRes.data.imdb_id) {
            realImdbId = extRes.data.imdb_id;
        }
    } catch (e) {}`;

code = code.replace(target1, replace1);

const target2 = `    let url = \`https://api.speedracelight.com/cdn/sources-with-title?title=\${encTitle}&mediaType=\${type}&year=\${year}&tmdbId=\${tmdbId}&imdbId=tt\${String(tmdbId).padStart(7, '0')}&enc=2&seed=\${seed}\`;`;
const replace2 = `    // If realImdbId is not found, don't send a fake one which confuses the upstream CDN
    const finalImdbId = realImdbId ? realImdbId : '';
    let url = \`https://api.speedracelight.com/cdn/sources-with-title?title=\${encTitle}&mediaType=\${type}&year=\${year}&tmdbId=\${tmdbId}&imdbId=\${finalImdbId}&enc=2&seed=\${seed}\`;`;

code = code.replace(target2, replace2);

fs.writeFileSync('src/services/peakStreamService.ts', code);
