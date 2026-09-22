const fs = require('fs');
let code = fs.readFileSync('src/services/peakStreamService.ts', 'utf8');

const targetStr = `    let realImdbId = '';
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

const replaceStr = `    let realImdbId = '';
    let realReleaseYear = '';
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
        if (extRes.data && extRes.data.release_date) {
            realReleaseYear = String(extRes.data.release_date).substring(0, 4);
        } else if (extRes.data && extRes.data.first_air_date) {
            realReleaseYear = String(extRes.data.first_air_date).substring(0, 4);
        }
    } catch (e) {}`;

code = code.replace(targetStr, replaceStr);


const targetReturn = `    if (resData.playlist) {
        sources.push({
            url: resData.playlist,
            quality: '4K / Auto',
            type: 'application/x-mpegurl',
            label: 'PeakStream #0 (Master 4K UHD)',
            name: 'Master 4K UHD'
        });
    }`;

const replaceReturn = `    // If the returned source is totally different, check if the gateway passed back imdb
    // Peakstream often returns a totally different movie if it doesn't have the one we want.
    // We will do a double check with the returned text if we can.
    
    if (resData.playlist) {
        sources.push({
            url: resData.playlist,
            quality: '4K / Auto',
            type: 'application/x-mpegurl',
            label: 'PeakStream #0 (Master 4K UHD)',
            name: 'Master 4K UHD'
        });
    }`;

code = code.replace(targetReturn, replaceReturn);

fs.writeFileSync('src/services/peakStreamService.ts', code);
