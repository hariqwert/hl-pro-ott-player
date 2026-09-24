import { Router, Request, Response } from 'express';
import axios from 'axios';
import {
    searchBingr,
    getMovieDetails,
    getTvDetails,
    getTvEpisodes,
    findTmdbMatch,
    scrapeBingrStream,
    buildBingrM3u,
    BINGR_SERVERS
} from '../services/bingrScraperService';
import { resolveMalIdFromTitle, fetchAniSkipTimes } from '../services/animeScraperService';

const router = Router();

const TMDB_KEYS = [
    "844dba0bfd8f3a231a957b6e07a10be8",
    "9d83476d2e27f56748167514c69cd2b4",
    "15d2ea6d0dc1d476efbca3eba2b9bbfb"
];
let tmdbKeyIdx = 0;

/**
 * Root & Health Check Endpoint
 */
router.get(['/', '/health'], (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        name: 'Bingr M3U8 Stream Scraper API',
        endpoints: [
            'GET  /search?q={query_or_tmdb_id}',
            'GET  /movie/:tmdbId',
            'GET  /movie/:tmdbId/stream?srv={optional_server}',
            'GET  /tv/:tmdbId',
            'GET  /tv/:tmdbId/season/:seasonNumber',
            'GET  /tv/:tmdbId/season/:seasonNumber/episode/:episodeNumber/stream?srv={optional_server}',
            'GET  /tmdb-proxy?endpoint=...',
            'GET  /servers',
            'POST /scrape',
            'POST /stream',
            'GET  /play?type=...&id=...',
            'GET  /m3u?type=...&id=...'
        ]
    });
});

interface TmdbCacheEntry {
    data: any;
    timestamp: number;
    ttl: number;
}

const tmdbProxyCache = new Map<string, TmdbCacheEntry>();
const MAX_CACHE_ENTRIES = 2000;

setInterval(() => {
    const now = Date.now();
    for (const [k, v] of tmdbProxyCache.entries()) {
        if (now - v.timestamp > v.ttl * 2) {
            tmdbProxyCache.delete(k);
        }
    }
}, 10 * 60 * 1000);

/**
 * Secure High-Speed TMDB Proxy endpoint with in-memory caching and stale-while-revalidate
 */
router.get('/tmdb-proxy', async (req: Request, res: Response) => {
    const endpoint = req.query.endpoint as string;
    if (!endpoint) return res.status(400).json({ error: 'Endpoint is required' });

    // Build normalized cache key excluding api_key
    const params = new URLSearchParams();
    const sortedKeys = Object.keys(req.query).filter(k => k !== 'endpoint' && k !== 'api_key').sort();
    for (const key of sortedKeys) {
        params.append(key, String(req.query[key]));
    }
    const cacheKey = `${endpoint}?${params.toString()}`;

    // Determine TTL: 1 hour for item details/credits, 30 min for searches/trending
    const isDetail = endpoint.includes('/') && !endpoint.startsWith('search/');
    const ttlMs = isDetail ? 60 * 60 * 1000 : 30 * 60 * 1000;

    // Cache hit - sub-1ms response
    const cached = tmdbProxyCache.get(cacheKey);
    const now = Date.now();
    if (cached && (now - cached.timestamp < cached.ttl)) {
        res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
        res.setHeader('X-Cache', 'HIT-MEMORY');
        return res.json(cached.data);
    }

    let currentIdx = tmdbKeyIdx;
    for (let attempts = 0; attempts < TMDB_KEYS.length; attempts++) {
        const apiKey = TMDB_KEYS[currentIdx];
        params.set('api_key', apiKey);
        
        try {
            const tmdbRes = await axios.get(`https://api.themoviedb.org/3/${endpoint}?${params.toString()}`, {
                timeout: 6000
            });
            if (tmdbRes.status === 200 && tmdbRes.data) {
                tmdbKeyIdx = currentIdx;

                if (tmdbProxyCache.size >= MAX_CACHE_ENTRIES) {
                    const firstKey = tmdbProxyCache.keys().next().value;
                    if (firstKey) tmdbProxyCache.delete(firstKey);
                }
                tmdbProxyCache.set(cacheKey, {
                    data: tmdbRes.data,
                    timestamp: now,
                    ttl: ttlMs
                });

                res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
                res.setHeader('X-Cache', 'MISS-FETCHED');
                return res.json(tmdbRes.data);
            }
        } catch (e: any) {
            if (e.response?.status === 404) {
                return res.status(404).json({ error: 'Not found' });
            }
        }
        currentIdx = (currentIdx + 1) % TMDB_KEYS.length;
    }

    // Fallback: If network failed but we have stale cache, serve stale data gracefully
    if (cached) {
        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
        res.setHeader('X-Cache', 'STALE-FALLBACK');
        return res.json(cached.data);
    }
    
    return res.status(500).json({ error: 'TMDB request failed' });
});

/**
 * GET /api/bingr/servers
 * Return list of active scraper clusters
 */
router.get('/servers', (req: Request, res: Response) => {
    res.json({ status: 'success', servers: BINGR_SERVERS });
});

/**
 * GET /api/bingr/movie/:tmdbId/stream
 * Direct movie stream scraping endpoint with optional ?srv= cluster param
 */
router.get('/movie/:tmdbId/stream', async (req: Request, res: Response) => {
    try {
        const tmdbId = String(req.params.tmdbId || '');
        const srv = (req.query.srv as string) || undefined;
        const result = await scrapeBingrStream({
            type: 'movie',
            id: tmdbId,
            srv
        });
        return res.status(result.success ? 200 : 404).json(result);
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err?.message || 'Movie stream scraping failed' });
    }
});

/**
 * GET /api/bingr/movie/:tmdbId
 * Direct movie metadata endpoint
 */
router.get('/movie/:tmdbId', async (req: Request, res: Response) => {
    try {
        const tmdbId = String(req.params.tmdbId || '');
        const details = await getMovieDetails(tmdbId);
        res.json(details);
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err?.message || 'Movie fetch failed' });
    }
});

/**
 * GET /api/bingr/tv/:tmdbId/season/:season/episode/:episode/stream
 * Direct TV episode stream scraping endpoint with optional ?srv= cluster param
 */
router.get('/tv/:tmdbId/season/:season/episode/:episode/stream', async (req: Request, res: Response) => {
    try {
        const tmdbId = String(req.params.tmdbId || '');
        const season = String(req.params.season || '1');
        const episode = String(req.params.episode || '1');
        const srv = (req.query.srv as string) || undefined;
        const result = await scrapeBingrStream({
            type: 'tv',
            id: tmdbId,
            season: Number(season),
            episode: Number(episode),
            srv
        });
        return res.status(result.success ? 200 : 404).json(result);
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err?.message || 'TV stream scraping failed' });
    }
});

/**
 * GET /api/bingr/tv/:tmdbId/season/:season
 * Direct TV Season episodes endpoint
 */
router.get('/tv/:tmdbId/season/:season', async (req: Request, res: Response) => {
    try {
        const tmdbId = String(req.params.tmdbId || '');
        const season = String(req.params.season || '1');
        const episodes = await getTvEpisodes(tmdbId, season);
        res.json({ tmdbId: Number(tmdbId), season: Number(season), episodes });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err?.message || 'TV season fetch failed' });
    }
});

/**
 * GET /api/bingr/tv/:tmdbId
 * Direct TV Show metadata endpoint
 */
router.get('/tv/:tmdbId', async (req: Request, res: Response) => {
    try {
        const tmdbId = String(req.params.tmdbId || '');
        const details = await getTvDetails(tmdbId);
        res.json(details);
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err?.message || 'TV show fetch failed' });
    }
});

/**
 * GET /api/bingr/search?q=...
 */
router.get('/search', async (req: Request, res: Response) => {
    try {
        const query = (req.query.q as string) || '';
        if (!query.trim()) {
            return res.json({ status: 'success', results: [] });
        }
        const data = await searchBingr(query);
        res.json({ status: 'success', ...data });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err?.message || 'Search failed' });
    }
});

/**
 * GET /api/bingr/details/:type/:id
 * Retrieve rich movie/show details including full Cast and Characters with profile photos
 */
router.get('/details/:type/:id', async (req: Request, res: Response) => {
    try {
        const type = String(req.params.type || 'movie');
        const id = String(req.params.id || '');
        const mediaType = type === 'tv' ? 'tv' : 'movie';
        const details = mediaType === 'tv' ? await getTvDetails(id) : await getMovieDetails(id);
        res.json({ status: 'success', details });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err?.message || 'Details fetch failed' });
    }
});

/**
 * GET /api/bingr/episodes/:id/:season
 * Retrieve episode listing for a specific TV Season
 */
router.get('/episodes/:id/:season', async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id || '');
        const season = String(req.params.season || '1');
        const episodes = await getTvEpisodes(id, season);
        res.json({ status: 'success', episodes });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err?.message || 'Episodes fetch failed' });
    }
});

/**
 * GET /api/bingr/srt2vtt
 * Proxies and converts an SRT subtitle file to WebVTT format for native HTML5 video <track> support.
 */
router.get('/srt2vtt', async (req: Request, res: Response) => {
    try {
        const url = req.query.url as string;
        if (!url || !url.startsWith('http')) {
            return res.status(400).send('Invalid URL');
        }
        
        const response = await axios.get(url, { responseType: 'text' });
        const srtContent = response.data.replace(/^\uFEFF/, '');
        
        // Convert SRT to VTT (Change comma to dot in timestamps and add WEBVTT header)
        const vttContent = "WEBVTT\n\n" + srtContent.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
        
        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(vttContent);
    } catch (e: any) {
        console.error('SRT to VTT conversion error:', e.message);
        res.status(500).send('WEBVTT\n\n'); // Return empty valid VTT on error
    }
});

/**
 * ALL /api/bingr/stream and ALL /api/bingr/scrape
 * Scrape direct M3U8 live stream using multi-cluster auto cascade (Bastion -> DarkMatter -> Polaris -> Edmunds)
 * Fully compatible with microservice payload: { srv, t, id, query: { title, year, season, episode } }
 */
router.all(['/stream', '/scrape'], async (req: Request, res: Response) => {
    try {
        const queryParams = req.query || {};
        const bodyParams = req.body || {};
        const body = { ...queryParams, ...bodyParams };
        const type = (body.type || body.t || 'movie') as 'movie' | 'tv';
        const id = body.id;
        const title = body.title || body.query?.title;
        const year = body.year || body.query?.year;
        const season = body.season ? Number(body.season) : (body.query?.season ? Number(body.query.season) : undefined);
        const episode = body.episode ? Number(body.episode) : (body.query?.episode ? Number(body.query.episode) : undefined);
        const srv = body.srv || body.server;
        const strictSrv = body.strictSrv === true || body.strict === true || body.strictSrv === 'true' || body.strict === 'true';

        const result = await scrapeBingrStream({
            type,
            id,
            title,
            year,
            season,
            episode,
            srv,
            strictSrv
        });

        if (result.success) {
            return res.json({ status: 'success', ...result });
        } else {
            return res.status(404).json({ status: 'error', ...result });
        }
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err?.message || 'Stream scraping failed' });
    }
});

/**
 * GET /api/bingr/play
 * Dynamic playback resolver. Resolves stream on-the-fly and redirects to the active M3U8
 * Ideal for external IPTV players (VLC, Kodi, Tivimate) and in-app players.
 */
router.get('/play', async (req: Request, res: Response) => {
    try {
        const type = (req.query.type as string) === 'tv' ? 'tv' : 'movie';
        const id = req.query.id as string;
        const title = (req.query.title as string) || '';
        const year = req.query.year as string;
        const season = req.query.season ? Number(req.query.season) : undefined;
        const episode = req.query.episode ? Number(req.query.episode) : undefined;
        const srv = req.query.srv as string;
        const mode = (req.query.mode as string) || 'redirect'; // 'redirect' | 'player'

        const result = await scrapeBingrStream({
            type,
            id,
            title,
            year,
            season,
            episode,
            srv
        });

        if (result.success && result.primaryM3u8) {
            if (mode === 'player') {
                const safeTitle = encodeURIComponent(result.title || title || 'Bingr Stream');
                const sParam = season !== undefined ? `&season=${season}&s=${season}` : '';
                const eParam = episode !== undefined ? `&episode=${episode}&e=${episode}` : '';
                const idParam = result.tmdbId ? `&id=${result.tmdbId}&tmdbId=${result.tmdbId}` : (id ? `&id=${id}&tmdbId=${id}` : '');
                const srvParam = result.serverId ? `&srv=${result.serverId}` : (srv ? `&srv=${srv}` : '');
                const yearParam = result.year ? `&year=${encodeURIComponent(result.year)}` : '';
                return res.redirect(`/play_bingr.php?url=${encodeURIComponent(result.primaryM3u8)}&name=${safeTitle}&title=${safeTitle}&type=${type}&media_type=${type}${idParam}${sParam}${eParam}${srvParam}${yearParam}&source=index.php`);
            }
            return res.redirect(result.primaryM3u8);
        }

        if (result.fallbackEmbeds && result.fallbackEmbeds.length > 0) {
            return res.redirect(result.fallbackEmbeds[0]);
        }

        res.status(404).send('Stream not available across active Bingr clusters');
    } catch (err: any) {
        res.status(500).send('Playback resolution error: ' + (err?.message || 'Unknown error'));
    }
});

/**
 * GET /api/bingr/m3u
 * Export and generate M3U playlists with scraped M3U8 video streams
 */
router.get('/m3u', async (req: Request, res: Response) => {
    try {
        const type = (req.query.type as string) === 'tv' ? 'tv' : 'movie';
        let id = req.query.id ? Number(req.query.id) : 0;
        let title = (req.query.title as string) || '';
        let year = req.query.year as string;
        const season = req.query.season ? Number(req.query.season) : 1;
        const direct = req.query.direct === '1' || req.query.direct === 'true';

        // Auto-match TMDB ID if not provided
        if (!id && title) {
            const match = await findTmdbMatch(title, type, year);
            if (match) {
                id = match.id;
                title = match.title;
                if (!year && match.year) year = match.year;
            }
        }

        if (!id && !title) {
            return res.status(400).send('TMDB ID or Media Title is required');
        }

        const host = req.get('host') || 'localhost:3000';
        const protocol = req.protocol || 'http';
        const baseUrl = `${protocol}://${host}`;

        let m3uContent = '';

        if (type === 'movie') {
            let details: any = null;
            if (id) {
                try { details = await getMovieDetails(id); } catch {}
            }
            const movieTitle = details?.title || title || 'Movie';
            const movieYear = details?.year || year || '';
            const logo = details?.poster || '';

            if (direct && id) {
                // Scrape direct active M3U8
                const scrapeRes = await scrapeBingrStream({ type: 'movie', id, title: movieTitle, year: movieYear });
                const streamUrl = scrapeRes.primaryM3u8 || `${baseUrl}/api/bingr/play?type=movie&id=${id}`;
                m3uContent = buildBingrM3u({
                    title: movieTitle,
                    type: 'movie',
                    tmdbId: id,
                    logo,
                    items: [
                        {
                            name: `${movieTitle}${movieYear ? ` (${movieYear})` : ''}`,
                            url: streamUrl,
                            quality: scrapeRes.quality || 'Auto',
                            logo,
                            tmdbId: id
                        }
                    ]
                });
            } else {
                // Dynamic resilient link that never expires
                const streamUrl = `${baseUrl}/api/bingr/play?type=movie&id=${id || ''}&title=${encodeURIComponent(movieTitle)}${movieYear ? `&year=${movieYear}` : ''}`;
                m3uContent = buildBingrM3u({
                    title: movieTitle,
                    type: 'movie',
                    tmdbId: id,
                    logo,
                    items: [
                        {
                            name: `${movieTitle}${movieYear ? ` (${movieYear})` : ''}`,
                            url: streamUrl,
                            quality: 'HD Live',
                            logo,
                            tmdbId: id
                        }
                    ]
                });
            }

            const cleanFileName = movieTitle.replace(/[^a-zA-Z0-9]/g, '_');
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${cleanFileName}_bingr.m3u"`);
            return res.send(m3uContent);
        } else {
            // TV Series
            let details: any = null;
            if (id) {
                try { details = await getTvDetails(id); } catch {}
            }
            const tvTitle = details?.title || title || 'TV Series';
            const logo = details?.poster || '';

            // Before series M3U scraping, check if MAL ID and intro skip timing exist -> classify as Anime
            let isAnime = false;
            let detectedMalId: number | null = null;
            let hasSkipTimes = false;
            try {
                detectedMalId = await resolveMalIdFromTitle(tvTitle);
                if (detectedMalId) {
                    const skipData = await fetchAniSkipTimes(detectedMalId, 1).catch(() => null);
                    if (skipData && skipData.found && skipData.results && skipData.results.length > 0) {
                        hasSkipTimes = true;
                    }
                    isAnime = true;
                    console.log(`[Bingr M3U] Series "${tvTitle}" verified as Anime (MAL ID #${detectedMalId}, Skip: ${hasSkipTimes ? 'Yes' : 'Pending'}). Prioritizing AnimeSalt.`);
                }
            } catch (e: any) {
                // Ignore lookup error
            }

            let episodesList: any[] = [];
            if (id) {
                try {
                    episodesList = await getTvEpisodes(id, season);
                } catch {}
            }

            // If no episodes found via API, create standard episodes list
            if (episodesList.length === 0) {
                episodesList = Array.from({ length: 12 }, (_, i) => ({
                    episode: i + 1,
                    title: `Episode ${i + 1}`
                }));
            }

            const items: any[] = [];
            for (const ep of episodesList) {
                const epNum = ep.episode;
                const epTitle = ep.title || `Episode ${epNum}`;
                const streamUrl = direct && id
                    ? (await (async () => {
                        try {
                            const sc = await scrapeBingrStream({
                                type: 'tv',
                                id,
                                title: tvTitle,
                                season,
                                episode: epNum,
                                srv: isAnime ? 'animesalt' : undefined
                            });
                            return sc.primaryM3u8;
                        } catch { return null; }
                    })()) || `${baseUrl}/api/bingr/play?type=tv&id=${id}&season=${season}&episode=${epNum}${isAnime ? '&srv=animesalt' : ''}`
                    : `${baseUrl}/api/bingr/play?type=tv&id=${id || ''}&title=${encodeURIComponent(tvTitle)}&season=${season}&episode=${epNum}${isAnime ? '&srv=animesalt' : ''}`;

                items.push({
                    name: `${tvTitle} S${String(season).padStart(2, '0')}E${String(epNum).padStart(2, '0')} - ${epTitle}`,
                    url: streamUrl,
                    quality: 'HD Live',
                    logo: ep.still || logo,
                    season,
                    episode: epNum,
                    tmdbId: id
                });
            }

            m3uContent = buildBingrM3u({
                title: `${tvTitle} Season ${season}`,
                type: 'tv',
                tmdbId: id,
                logo,
                items
            });

            const cleanFileName = `${tvTitle.replace(/[^a-zA-Z0-9]/g, '_')}_S${season}`;
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${cleanFileName}_bingr.m3u"`);
            return res.send(m3uContent);
        }
    } catch (err: any) {
        res.status(500).send('M3U Generation Error: ' + (err?.message || 'Unknown error'));
    }
});

export default router;
