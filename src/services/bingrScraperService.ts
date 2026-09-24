import https from 'https';
import http from 'http';
import { URL } from 'url';
import axios from 'axios';
import { scrapePeakStream } from './peakStreamService';
import { scrapeMovies4uCluster } from './movies4uService';
import { scrapeAnimeEpisode, resolveMalIdFromTitle, fetchAniSkipTimes } from './animeScraperService';
import { SubtitleService } from './subtitleService';

export interface BingrServerCluster {
    id: string;
    name: string;
    cc: string;
    priority: number;
}

export const BINGR_SERVERS: BingrServerCluster[] = [
    { id: 's40', name: 'Aphelion (DarkMatter / Fast 1080p Direct)', cc: 'GL', priority: 1 },
    { id: 's62', name: 'Bastion (Multi-Audio HLS / KNOCW / NXOCW)', cc: 'IN', priority: 2 },
    { id: 'm4u', name: 'Movie 4U (Movies4u / Acek CDN)', cc: 'IN', priority: 3 },
    { id: 's61', name: 'Corvus (Multi-Source Hub)', cc: 'US', priority: 4 },
    { id: 'animesalt', name: 'AnimeSalt (Special Anime Scraper / Multi-Audio HLS)', cc: 'JP', priority: 5 },
    { id: 's3',  name: 'Edmunds (Filmu Proxy)', cc: 'US', priority: 6 },
    { id: 's70', name: 'Polaris (Multi-Language Dubs / HLS v7)', cc: 'US', priority: 7 },
    { id: 's31', name: 'Orion (Filmu Workers)', cc: 'US', priority: 8 },
    { id: 's30', name: 'Nova (VidRock CDN)', cc: 'US', priority: 9 },
    { id: 's4k', name: 'PeakStream 4K', cc: 'GL', priority: 10 },
    { id: 's60', name: 'Vertex', cc: 'US', priority: 11 }
];

// In-memory stream and details cache for sub-millisecond instant re-resolution
const STREAM_CACHE = new Map<string, { timestamp: number; result: BingrScrapeResult }>();
const DETAILS_CACHE = new Map<string, { timestamp: number; data: BingrMediaDetails }>();
const CACHE_TTL_STREAM = 10 * 60 * 1000; // 10 minutes
const CACHE_TTL_DETAILS = 60 * 60 * 1000; // 1 hour

/**
 * Deep check to detect if a manifest is actually just storyboard thumbnail scrub tiles (.png / tiles.m3u8) instead of a playable video stream
 */
export async function isStoryboardStream(url: string): Promise<boolean> {
    if (!url) return false;
    const lower = url.toLowerCase();
    if (lower.includes('tiles.m3u8') || lower.includes('storyboard') || lower.includes('sprites.m3u8')) return true;
    try {
        const res = await axios.get(url, {
            timeout: 3000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Accept': '*/*'
            }
        });
        const content = typeof res.data === 'string' ? res.data : '';
        if (content.includes('#EXT-X-STREAM-INF')) {
            const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
            const isAllTiles = lines.length > 0 && lines.every(l => {
                const ll = l.toLowerCase();
                return ll.includes('tiles') || ll.includes('storyboard') || ll.includes('sprite');
            });
            if (isAllTiles) return true;
        } else if (content.includes('#EXTINF:')) {
            if (content.includes('tiles/') || content.includes('/tiles') || content.includes('sprites/')) {
                return true;
            }
        }
    } catch (_) {}
    return false;
}

/**
 * Fast stream probe to verify upstream does not return HTTP 404/502/error or expired 403 sub-playlists
 */
export async function verifyStreamReachable(url: string, timeoutMs: number = 2500): Promise<boolean> {
    if (!url) return false;
    if (url.startsWith('/api/') || url.startsWith('/')) return true;
    if (!url.startsWith('http')) return false;

    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('tiles.m3u8') || lowerUrl.includes('storyboard') || lowerUrl.includes('sprites.m3u8')) {
        return false;
    }

    // Fast-path instant bypass for known ultra-reliable CDN & Cloudflare Worker edge domains
    if (
        lowerUrl.includes('workers.dev') ||
        lowerUrl.includes('knocw.com') ||
        lowerUrl.includes('nxocw.com') ||
        lowerUrl.includes('flocw.com') ||
        lowerUrl.includes('dramiyos') ||
        lowerUrl.includes('acek-cdn') ||
        lowerUrl.includes('as-cdn') ||
        lowerUrl.includes('animesalt') ||
        lowerUrl.includes('vidhide') ||
        lowerUrl.includes('hoxcv.com') ||
        lowerUrl.includes('vdrk.site')
    ) {
        return true;
    }

    return new Promise((resolve) => {
        try {
            const u = new URL(url);
            const isHttps = u.protocol === 'https:';
            const client = isHttps ? https : http;
            const req = client.request({
                hostname: u.hostname,
                port: u.port || (isHttps ? 443 : 80),
                path: u.pathname + u.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    ...(!url.includes('peakstorm.top') ? {
                        'Referer': `${u.protocol}//${u.hostname}/`,
                        'Origin': `${u.protocol}//${u.hostname}`
                    } : {}),
                    'Range': 'bytes=0-1024',
                    'Accept': '*/*'
                },
                timeout: timeoutMs
            }, (res: any) => {
                const code = res.statusCode || 0;
                res.destroy();
                resolve(code >= 200 && code < 400);
            });
            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
            req.end();
        } catch {
            resolve(false);
        }
    });
}

export interface BingrCastMember {
    id?: number;
    name: string;
    character: string;
    photo?: string;
}

export interface BingrMediaDetails {
    id: number;
    type: 'movie' | 'tv';
    title: string;
    year?: string;
    poster?: string;
    backdrop?: string;
    backdrop_original?: string;
    rating?: number;
    overview?: string;
    runtime?: number;
    genres?: Array<{ id: number; name: string } | string>;
    certification?: string;
    director?: string;
    directors?: string[];
    cast?: BingrCastMember[];
    seasons?: Array<{ season: number; episodes: number }>;
    release_date?: string;
    status?: string;
    trailer?: string;
}

export interface BingrEpisode {
    episode: number;
    title: string;
    overview?: string;
    still?: string;
    air_date?: string;
    rating?: number;
}

export interface BingrStreamSource {
    url: string;
    quality: string;
    type: string;
    label?: string;
    name?: string;
    language?: string;
}

export interface BingrScrapeResult {
    success: boolean;
    type: 'movie' | 'tv';
    tmdbId: number;
    title?: string;
    year?: string;
    season?: number;
    episode?: number;
    serverId?: string;
    serverName?: string;
    scraperName?: string;
    primaryM3u8?: string;
    quality?: string;
    sources: BingrStreamSource[];
    subtitles?: Array<{ lang: string; url: string; label?: string }>;
    attempts?: Array<{ serverId: string; serverName: string; status: string; latencyMs: number; error?: string }>;
    fallbackEmbeds?: string[];
    error?: string;
    expectedDurationMinutes?: number;
    streamDurationMinutes?: number;
    streamDurationSec?: number;
    duration?: number;
}

const BINGR_API_BASE = 'https://api.bingr.one/api';

/**
 * Universal HTTPS request with Bingr anti-bot and Origin/Referer bypass headers
 */
export function bingrRequest<T = any>(pathname: string, options: {
    method?: string;
    body?: any;
    referer?: string;
    origin?: string;
    timeout?: number;
} = {}): Promise<{ status: number; data: T }> {
    return new Promise((resolve, reject) => {
        const fullUrl = pathname.startsWith('http') ? pathname : `${BINGR_API_BASE}${pathname}`;
        const u = new URL(fullUrl);
        const postData = options.body ? JSON.stringify(options.body) : null;
        
        const defaultOrigin = options.referer ? new URL(options.referer).origin : 'https://bingr.one';
        const req = https.request({
            hostname: u.hostname,
            port: 443,
            path: u.pathname + u.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': options.referer || 'https://bingr.one/',
                'Origin': options.origin || defaultOrigin,
                'Accept': 'application/json, text/plain, */*',
                ...(postData ? {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                } : {})
            },
            timeout: options.timeout || 12000
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    resolve({ status: res.statusCode || 200, data: json });
                } catch {
                    resolve({ status: res.statusCode || 200, data: body as any });
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request timed out to ${u.pathname}`));
        });

        if (postData) req.write(postData);
        req.end();
    });
}

export const ROTATING_TMDB_KEYS = [
    "9d83476d2e27f56748167514c69cd2b4",
    "15d2ea6d0dc1d476efbca3eba2b9bbfb",
    "a07e22bc18f5cb106bfe4cc1f83ad8ed"
];
let rotatingTmdbKeyIdx = 0;

export function getRotatingTmdbKey(): string {
    const key = process.env.TMDB_API_KEY || ROTATING_TMDB_KEYS[rotatingTmdbKeyIdx % ROTATING_TMDB_KEYS.length];
    rotatingTmdbKeyIdx++;
    return key;
}

/**
 * Search Movies & TV Shows via Bingr / TMDB Gateway
 */
export async function searchBingr(query: string): Promise<any> {
    if (!query || !query.trim()) return { results: [] };
    const clean = query.trim();

    // Direct numeric TMDB ID check
    if (/^\d+$/.test(clean)) {
        try {
            const movie = await getMovieDetails(clean);
            if (movie && movie.id) return { results: [movie], isDirectTmdb: true };
        } catch {}
        try {
            const tv = await getTvDetails(clean);
            if (tv && tv.id) return { results: [tv], isDirectTmdb: true };
        } catch {}
    }

    let results: any[] = [];
    try {
        const res = await bingrRequest(`/search?q=${encodeURIComponent(clean)}`);
        const data = res.data || { results: [] };
        if (Array.isArray(data.results)) {
            results = data.results;
        }
    } catch (_) {}

    // Fallback: If Bingr gateway returned 0 results, query TMDB multi-search directly using working keys
    if (results.length === 0) {
        for (let attempt = 0; attempt < ROTATING_TMDB_KEYS.length; attempt++) {
            const apiKey = getRotatingTmdbKey();
            try {
                const tmdbRes = await axios.get(`https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(clean)}&include_adult=false`, { timeout: 3500 });
                if (tmdbRes.data?.results && Array.isArray(tmdbRes.data.results) && tmdbRes.data.results.length > 0) {
                    for (const r of tmdbRes.data.results) {
                        if (r.media_type === 'person') continue;
                        results.push({
                            id: r.id,
                            title: r.title || r.name || 'Untitled',
                            name: r.name || r.title,
                            type: r.media_type || (r.title ? 'movie' : 'tv'),
                            year: (r.release_date || r.first_air_date || '').slice(0, 4),
                            poster: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : undefined,
                            backdrop: r.backdrop_path ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}` : undefined,
                            overview: r.overview,
                            rating: r.vote_average,
                            vote_count: r.vote_count
                        });
                    }
                    break;
                }
            } catch (_) {}
        }
    }

    // Ensure the legendary 1999 One Piece Anime (TMDB 37854) is always present when searching One Piece
    if (/one\s*piece/i.test(clean)) {
        const isLiveActionSpecific = /\b(live action|live-action|netflix|2023)\b/i.test(clean);
        const hasAnime = results.some((r: any) => r.id === 37854);
        if (!hasAnime) {
            try {
                const animeDetails = await getTvDetails(37854);
                if (animeDetails && animeDetails.id) {
                    const animeItem = {
                        id: 37854,
                        title: 'One Piece (Anime)',
                        year: '1999',
                        type: 'tv',
                        poster: animeDetails.poster || 'https://image.tmdb.org/t/p/w500/cMD9Ygz11yj5GvEi4O269vDp8um.jpg',
                        overview: animeDetails.overview || 'Years ago, the fearsome Pirate King Gol D. Roger was executed leaving behind the famed "One Piece" treasure.',
                        rating: animeDetails.rating || 8.7
                    };
                    if (isLiveActionSpecific) {
                        results.push(animeItem);
                    } else {
                        results.unshift(animeItem);
                    }
                }
            } catch {}
        }
    }

    return { results };
}

/**
 * Get Movie Details and full Cast/Character list
 */
export async function getMovieDetails(tmdbId: number | string): Promise<BingrMediaDetails> {
    const cacheKey = `movie:${tmdbId}`;
    const cached = DETAILS_CACHE.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_DETAILS)) {
        return cached.data;
    }
    const res = await bingrRequest<BingrMediaDetails>(`/details/movie/${tmdbId}`);
    if (res.status !== 200 || !res.data) {
        throw new Error(`Movie not found for TMDB ID: ${tmdbId}`);
    }
    DETAILS_CACHE.set(cacheKey, { timestamp: Date.now(), data: res.data });
    return res.data;
}

/**
 * Get TV Series Details and full Cast/Character list
 */
export async function getTvDetails(tmdbId: number | string): Promise<BingrMediaDetails> {
    const cacheKey = `tv:${tmdbId}`;
    const cached = DETAILS_CACHE.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_DETAILS)) {
        return cached.data;
    }
    const res = await bingrRequest<BingrMediaDetails>(`/details/tv/${tmdbId}`);
    if (res.status !== 200 || !res.data) {
        throw new Error(`TV Show not found for TMDB ID: ${tmdbId}`);
    }
    DETAILS_CACHE.set(cacheKey, { timestamp: Date.now(), data: res.data });
    return res.data;
}

/**
 * Get Season Episodes
 */
export async function getTvEpisodes(tmdbId: number | string, seasonNumber: number | string): Promise<BingrEpisode[]> {
    const res = await bingrRequest<{ episodes: BingrEpisode[] }>(`/episodes/${tmdbId}/${seasonNumber}`);
    if (res.status !== 200 || !res.data?.episodes) {
        throw new Error(`Episodes not found for TMDB ID ${tmdbId} Season ${seasonNumber}`);
    }
    return res.data.episodes;
}

/**
 * Smart TMDB Matcher: Given an arbitrary title/name from Stalker or M3U, find the best TMDB match
 */
export async function findTmdbMatch(
    rawTitle: string,
    expectedType: 'movie' | 'tv' = 'movie',
    yearHint?: string | number
): Promise<{ id: number; title: string; year?: string; details?: BingrMediaDetails } | null> {
    if (!rawTitle) return null;

    // Check if rawTitle contains a direct numeric ID
    if (/^\d+$/.test(rawTitle.trim())) {
        const numId = parseInt(rawTitle.trim(), 10);
        try {
            const details = expectedType === 'tv' ? await getTvDetails(numId) : await getMovieDetails(numId);
            return { id: details.id, title: details.title, year: details.year, details };
        } catch {}
    }

    // 1. Check for explicit bracketed or parenthesized year, e.g. "Fight Club (1999)" or "[2021]"
    let extractedYear: string | undefined = yearHint ? String(yearHint).trim() : undefined;
    const parenYearMatch = rawTitle.match(/\((?:19\d{2}|20[0-2]\d)\)|\[(?:19\d{2}|20[0-2]\d)\]/);
    if (!extractedYear && parenYearMatch) {
        extractedYear = parenYearMatch[0].replace(/[\[\]\(\)]/g, '');
    }

    // 2. Known titles where a 4-digit number is intrinsically part of the title, NEVER treat as a release year
    const isTitleWithNumber = /\b(2001|2010|2012|2049|2077|1917|1984|300|2000|1941|1942|1408)\b/i.test(rawTitle);

    // 3. If year not yet found and not an intrinsic numbered title, check for trailing or standalone release year
    if (!extractedYear && !isTitleWithNumber) {
        const trailingYearMatch = rawTitle.match(/\b(19\d{2}|20[0-2]\d)\b/);
        if (trailingYearMatch) {
            extractedYear = trailingYearMatch[1];
        }
    }

    // 4. Clean up title: remove bracketed text, release tags, qualities, languages, etc.
    let clean = rawTitle
        .replace(/\[.*?\]|\(.*?\)/g, '')
        .replace(/\b(https?:\/\/\S+|www\.\S+)\b/gi, '')
        // Strip season and episode codes
        .replace(/\bS\d{1,2}(?:\s*E\d{1,2})?\b/gi, '')
        .replace(/\b(?:Season|Series|Episode|Ep)\s*\d+\b/gi, '')
        .replace(/\bE\d{1,3}\b/gi, '')
        // Strip audio/video formats & resolutions
        .replace(/\b(4K|UHD|FHD|HD|1080p?|720p?|480p?|2160p?|WEB-?DL|WEBRip|Blu-?Ray|BRRip|BDRip|HDTV|DVDRip|REMUX|PROPER|REPACK|HDR\d*|HEVC|x264|x265|H\.?264|H\.?265|10bit|AV1)\b/gi, '')
        // Strip audio channels and codecs
        .replace(/\b(AAC\d*|AC3|DDP\d*(\.\d*)?|Dolby|Atmos|TrueHD|5\.1|7\.1|Dual\s*Audio|Multi\s*Audio)\b/gi, '')
        // Strip languages & dubs
        .replace(/\b(Hindi|English|Tamil|Telugu|Kannada|Malayalam|Bengali|Marathi|Punjabi|Gujarati|Dubbed|Org|Subbed|Eng\s*Sub)\b/gi, '')
        .replace(/[._-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // If we extracted a verified release year AND it is not an intrinsic numbered title, strip it from clean search title
    if (extractedYear && !isTitleWithNumber) {
        clean = clean.replace(new RegExp(`\\b${extractedYear}\\b`, 'g'), '').trim();
    }

    if (!clean) clean = rawTitle.replace(/[._-]/g, ' ').replace(/\s+/g, ' ').trim();

    try {
        let searchRes = await searchBingr(clean);
        let results: any[] = searchRes?.results || [];

        // Fallback 1: If 0 results and clean differs from rawTitle, try searching rawTitle without punctuation
        if (results.length === 0 && clean.toLowerCase() !== rawTitle.toLowerCase()) {
            const rawSimple = rawTitle.replace(/[\[\]\(\)._-]/g, ' ').replace(/\s+/g, ' ').trim();
            const fallbackRes = await searchBingr(rawSimple);
            results = fallbackRes?.results || [];
        }

        // Fallback 2: If still 0 results and we have an extractedYear, try searching clean without year constraint
        if (results.length === 0 && extractedYear) {
            const unconstrainedRes = await searchBingr(clean);
            results = unconstrainedRes?.results || [];
        }

        if (results.length === 0) return null;

        // Score results
        let bestMatch: any = null;
        let bestScore = -999;

        const isAnimeQuery = /\b(anime|animated|animation|japanese|straw hat|luffy|wano|egghead|marineford)\b/i.test(rawTitle) || /\b(anime|animated|animation|japanese|straw hat|luffy|wano|egghead|marineford)\b/i.test(clean);
        const isLiveActionQuery = /\b(live action|live-action|netflix|2023)\b/i.test(rawTitle) || /\b(live action|live-action|netflix|2023)\b/i.test(clean);

        // Fast priority check for One Piece: unless live action is explicitly requested or year is 2023, return the legendary 1999 anime
        if (/one\s*piece/i.test(clean)) {
            if (!isLiveActionQuery && (!extractedYear || extractedYear !== '2023')) {
                try {
                    const animeDetails = await getTvDetails(37854);
                    if (animeDetails && animeDetails.id) {
                        return {
                            id: 37854,
                            title: 'One Piece (Anime)',
                            year: '1999',
                            details: animeDetails
                        };
                    }
                } catch {}
            }
        }

        const cleanLower = clean.toLowerCase();

        for (const item of results) {
            let score = 0;
            const itemType = item.type || (item.name ? 'tv' : 'movie');

            // Strictly separate Movies and TV Shows
            if (itemType === expectedType) {
                score += 50;
            } else {
                score -= 150; // Severe penalty for mismatched media type
            }

            const itemTitle = (item.title || item.name || '').toLowerCase();

            // Exact title matching
            if (itemTitle === cleanLower) {
                score += 100;
            } else if (itemTitle.startsWith(cleanLower) || cleanLower.startsWith(itemTitle)) {
                score += 60;
            } else if (itemTitle.includes(cleanLower) || cleanLower.includes(itemTitle)) {
                score += 40;
            }

            // Intrinsic number match (e.g. 2049 in "Blade Runner 2049", 2077 in "Cyberpunk 2077")
            if (isTitleWithNumber) {
                const numMatch = rawTitle.match(/\b(2001|2010|2012|2049|2077|1917|1984|300|2000)\b/);
                if (numMatch && itemTitle.includes(numMatch[1])) {
                    score += 120; // Massive boost for matching the intrinsic title number
                }
            }

            // Year scoring
            const itemYearStr = item.year ? String(item.year).slice(0, 4) : '';
            if (extractedYear && itemYearStr) {
                if (itemYearStr === String(extractedYear)) {
                    score += 60;
                } else {
                    const diff = Math.abs(parseInt(itemYearStr, 10) - parseInt(String(extractedYear), 10));
                    if (diff <= 1) {
                        score += 30; // 1-year tolerance
                    } else {
                        score -= 50; // Penalize wrong release year
                    }
                }
            }

            // Popularity / vote count tie-breaker (boost real blockbusters over zero-vote home videos)
            const votes = Number(item.vote_count || item.rating || 0);
            if (votes > 0) {
                score += Math.min(25, Math.log10(votes + 1) * 8);
            }

            // One Piece differentiation
            if (item.id === 37854 || itemTitle.includes('one piece')) {
                if (item.id === 37854) {
                    if (isAnimeQuery || (!isLiveActionQuery && (!extractedYear || extractedYear === '1999'))) {
                        score += 90;
                    }
                } else if (item.id === 111110) {
                    if (isLiveActionQuery || extractedYear === '2023') {
                        score += 90;
                    } else {
                        score -= 60;
                    }
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestMatch = item;
            }
        }

        if (bestMatch && bestMatch.id && bestScore > 0) {
            return {
                id: bestMatch.id,
                title: bestMatch.title || bestMatch.name,
                year: bestMatch.year,
                details: bestMatch
            };
        }
    } catch (e) {
        console.warn(`[BingrMatcher] Failed search for "${clean}":`, e);
    }

    return null;
}

/**
 * Get Subtitles from Direct VTT CDN / Subtitle Engine
 */
export async function getSubtitles(type: 'movie' | 'tv', tmdbId: number | string, season?: number | string, episode?: number | string): Promise<Array<{ lang: string; url: string; label?: string; source?: string }>> {
    const list: Array<{ lang: string; url: string; label?: string; source?: string }> = [];
    if (!tmdbId) return list;

    try {
        // 1. Direct vdrk.site CDN probe (instant and reliable for TMDB IDs)
        const vdrkEn = `https://cache.vdrk.site/v1/vtt/${type}/${tmdbId}/English.vtt`;
        try {
            const check = await axios.head(vdrkEn, { timeout: 1200 });
            if (check.status === 200) {
                list.push({
                    lang: 'en',
                    label: 'English',
                    url: vdrkEn,
                    source: 'vdrk'
                });
            }
        } catch {}

        // 2. SubtitleService search fallback with fast timeout
        if (list.length === 0) {
            const subs = await SubtitleService.searchSubtitles(tmdbId, undefined, 'en');
            for (const s of subs) {
                list.push({
                    lang: s.language || 'en',
                    label: s.label || 'English',
                    url: s.url,
                    source: 'subtitles'
                });
            }
        }
    } catch {}

    return list;
}


/**
 * Universal Stream Scraper with Server Cascade (s4k -> s70 -> s62 -> s40 -> s3 -> s30...)
 */


const TMDB_RUNTIME_CACHE = new Map<string, { runtime: number; timestamp: number }>();
const TMDB_RUNTIME_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Retrieves expected runtime from TMDB with caching and key rotation
 */
export async function getExpectedRuntime(type: 'movie' | 'tv', tmdbId: number, season?: number, episode?: number): Promise<number> {
    const cacheKey = `${type}_${tmdbId}_${season || 0}_${episode || 0}`;
    const cached = TMDB_RUNTIME_CACHE.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < TMDB_RUNTIME_CACHE_TTL)) {
        return cached.runtime;
    }

    let expectedRuntime = 0;
    for (let attempt = 0; attempt < ROTATING_TMDB_KEYS.length; attempt++) {
        const apiKey = getRotatingTmdbKey();
        try {
            if (type === 'movie') {
                const tmdbRes = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}`, { timeout: 5000 });
                expectedRuntime = tmdbRes.data?.runtime || 0;
            } else {
                if (season && episode) {
                    try {
                        const epRes = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}/episode/${episode}?api_key=${apiKey}`, { timeout: 5000 });
                        expectedRuntime = epRes.data?.runtime || 0;
                    } catch (_) {}
                }
                if (!expectedRuntime) {
                    const showRes = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${apiKey}`, { timeout: 5000 });
                    if (showRes.data?.episode_run_time && showRes.data.episode_run_time.length > 0) {
                        expectedRuntime = showRes.data.episode_run_time[0];
                    } else if (showRes.data?.runtime) {
                        expectedRuntime = showRes.data.runtime;
                    }
                }
            }
            if (expectedRuntime > 0) {
                break;
            }
        } catch (_) {
            // Try next key if available
        }
    }

    if (expectedRuntime > 0) {
        TMDB_RUNTIME_CACHE.set(cacheKey, { runtime: expectedRuntime, timestamp: Date.now() });
    }
    return expectedRuntime;
}

/**
 * Validates the duration of the M3U8 stream against TMDB expected runtime.
 * Prevents fake/trailer/short loop videos from polluting search and playback.
 */
export async function verifyStreamDuration(
    url: string,
    type: 'movie' | 'tv',
    tmdbId: number,
    season?: number,
    episode?: number,
    isStrict?: boolean
): Promise<{ isValid: boolean; expected?: number; actual?: number; reason?: string }> {
    try {
        if (!url || !url.startsWith('http')) return { isValid: true };

        const expectedRuntime = await getExpectedRuntime(type, tmdbId, season, episode);
        if (expectedRuntime <= 0) {
            // If TMDB runtime is unavailable, allow stream
            return { isValid: true };
        }

        const actualRuntime = await getM3u8Duration(url);
        if (actualRuntime === null) {
            // When upstream CDN protects master playlist with token or live manifest, don't drop legitimate streams
            return { isValid: true, expected: expectedRuntime };
        }

        // If user strictly requested this specific server, always allow it
        if (isStrict) {
            return { isValid: true, expected: expectedRuntime, actual: actualRuntime };
        }

        const diff = Math.abs(actualRuntime - expectedRuntime);

        // Feature Film / Movie Scraping (Strict +/- 15 minutes tolerance or 15%)
        if (type === 'movie') {
            // Reject fake 1-12 minute trailer clips pretending to be a full feature
            if (actualRuntime < 12 && expectedRuntime >= 20) {
                return {
                    isValid: false,
                    expected: expectedRuntime,
                    actual: actualRuntime,
                    reason: `Trailer or sample clip rejected: stream is only ${Math.round(actualRuntime)}m, expected feature film of ~${expectedRuntime}m`
                };
            }
            // Movie tolerance: +/- 15 minutes or 15%
            const tolerance = Math.max(15, Math.round(expectedRuntime * 0.15));
            if (diff > tolerance) {
                return {
                    isValid: false,
                    expected: expectedRuntime,
                    actual: actualRuntime,
                    reason: `Duration mismatch: expected ~${expectedRuntime}m, stream is ${Math.round(actualRuntime)}m (Movie tolerance: +/-${tolerance}m, diff was ${Math.round(diff)}m)`
                };
            }
        } else {
            // TV episode / Anime / Sitcom
            if (actualRuntime < 4) {
                return {
                    isValid: false,
                    expected: expectedRuntime,
                    actual: actualRuntime,
                    reason: `Teaser clip rejected: stream is only ${Math.round(actualRuntime)}m, expected episode of ~${expectedRuntime}m`
                };
            }
            // Prevent serving a 2-hour full movie when a short episode was requested
            if (expectedRuntime < 40 && actualRuntime > 115) {
                return {
                    isValid: false,
                    expected: expectedRuntime,
                    actual: actualRuntime,
                    reason: `Wrong media: stream is ${Math.round(actualRuntime)}m, expected short episode of ~${expectedRuntime}m`
                };
            }
            // Strict tolerance capped at 10 minutes for TV episodes as well
            const tolerance = Math.min(10, Math.max(5, expectedRuntime * 0.25));
            if (diff > tolerance) {
                return {
                    isValid: false,
                    expected: expectedRuntime,
                    actual: actualRuntime,
                    reason: `Duration mismatch: expected ~${expectedRuntime}m, stream is ${Math.round(actualRuntime)}m (Strict tolerance: +/-${Math.round(tolerance)}m, diff was ${Math.round(diff)}m)`
                };
            }
        }

        return { isValid: true, expected: expectedRuntime, actual: actualRuntime };
    } catch (e: any) {
        return { isValid: true };
    }
}

/**
 * Deep M3U8 duration parser with full anti-bot headers and Master Playlist traversal
 */
export async function getM3u8Duration(url: string, depth = 0): Promise<number | null> {
    if (!url || depth > 3) return null;
    const lower = url.toLowerCase();
    if (lower.includes('tiles.m3u8') || lower.includes('storyboard') || lower.includes('sprites.m3u8')) {
        return null; // Reject storyboard URLs immediately
    }

    try {
        let fetchUrl = url;
        if (fetchUrl.startsWith('/')) {
            fetchUrl = `http://127.0.0.1:3000${fetchUrl}`;
        }

        let parsedOrigin = 'https://bingr.one';
        try {
            const parsed = new URL(fetchUrl);
            parsedOrigin = parsed.origin;
        } catch (_) {}

        const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Accept': '*/*'
        };
        if (fetchUrl.includes('bingr.one') || fetchUrl.includes('api.bingr')) {
            headers['Referer'] = 'https://bingr.one/';
            headers['Origin'] = 'https://bingr.one';
        }

        const res = await axios.get(fetchUrl, {
            timeout: 6000,
            headers
        });
        const content = res.data;
        if (typeof content !== 'string') return null;

        // 1. Is it a master playlist? (#EXT-X-STREAM-INF)
        if (content.includes('#EXT-X-STREAM-INF')) {
            const lines = content.split(/\r?\n/);
            let hasValidVariant = false;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith('#EXT-X-STREAM-INF')) {
                    // Forward scan for the next non-comment URI line
                    for (let j = i + 1; j < lines.length; j++) {
                        const candidate = lines[j].trim();
                        if (!candidate) continue;
                        if (candidate.startsWith('#')) continue;
                        const cLower = candidate.toLowerCase();
                        if (cLower.includes('tiles') || cLower.includes('storyboard') || cLower.includes('sprite')) {
                            // Storyboard scrubbing track in master playlist, skip it!
                            break;
                        }
                        hasValidVariant = true;
                        const mediaUrl = candidate.startsWith('http') ? candidate : new URL(candidate, fetchUrl).toString();
                        const dur = await getM3u8Duration(mediaUrl, depth + 1);
                        if (dur !== null && dur > 0) return dur;
                        break;
                    }
                }
            }
            if (!hasValidVariant) {
                // If master playlist only contained tiles.m3u8, it is a pure storyboard manifest
                return null;
            }
            // Fallback: search for any child .m3u8 path that is NOT storyboard
            for (const line of lines) {
                const trimmed = line.trim();
                const trLower = trimmed.toLowerCase();
                if (!trimmed.startsWith('#') && (trimmed.includes('.m3u8') || trimmed.includes('/hls/')) && !trLower.includes('tiles') && !trLower.includes('storyboard')) {
                    const mediaUrl = trimmed.startsWith('http') ? trimmed : new URL(trimmed, fetchUrl).toString();
                    const dur = await getM3u8Duration(mediaUrl, depth + 1);
                    if (dur !== null && dur > 0) return dur;
                }
            }
            return null;
        }

        // 2. Media playlist: check if this is pure image tiles (e.g. tiles/00000.png)
        if (content.includes('tiles/') || content.includes('/tiles') || content.includes('sprites/')) {
            // Pure storyboard tiles playlist! Reject it!
            return null;
        }

        // Sum #EXTINF segments
        const extinfRegex = /#EXTINF:\s*([0-9]+(?:\.[0-9]+)?)/gi;
        let match: RegExpExecArray | null;
        let totalSeconds = 0;
        let segmentCount = 0;
        while ((match = extinfRegex.exec(content)) !== null) {
            const sec = parseFloat(match[1]);
            if (!isNaN(sec) && sec > 0) {
                totalSeconds += sec;
                segmentCount++;
            }
        }

        // 3. Fallback: Target duration approximation if segments exist but explicit durations are omitted
        if (totalSeconds <= 0 && segmentCount > 0) {
            const targetDurMatch = content.match(/#EXT-X-TARGETDURATION:\s*([0-9]+)/i);
            if (targetDurMatch) {
                const targetSec = parseFloat(targetDurMatch[1]);
                if (!isNaN(targetSec) && targetSec > 0) {
                    totalSeconds = targetSec * segmentCount;
                }
            }
        }

        if (totalSeconds > 0) {
            return totalSeconds / 60; // Minutes
        }
        return null;
    } catch (err: any) {
        return null;
    }
}

export async function scrapeBingrStream(params: {
    type?: 'movie' | 'tv';
    id?: number | string;
    title?: string;
    year?: string | number;
    season?: number;
    episode?: number;
    srv?: string;
    strictSrv?: boolean;
}): Promise<BingrScrapeResult> {
    const isTv = params.type === 'tv' || params.season !== undefined || params.episode !== undefined;
    const type: 'movie' | 'tv' = isTv ? 'tv' : (params.type || 'movie');
    const strictSrv = !!params.strictSrv;
    let tmdbId = params.id ? Number(params.id) : 0;
    let mediaTitle = params.title || '';
    let mediaYear = params.year ? String(params.year) : undefined;

    // If tmdbId is missing, resolve it via search
    if (!tmdbId && mediaTitle) {
        const match = await findTmdbMatch(mediaTitle, type, mediaYear);
        if (match) {
            tmdbId = match.id;
            mediaTitle = match.title;
            if (!mediaYear && match.year) mediaYear = match.year;
        }
    }

    if (!tmdbId) {
        return {
            success: false,
            type,
            tmdbId: 0,
            title: mediaTitle,
            error: 'Could not resolve TMDB ID for title: ' + mediaTitle,
            sources: []
        };
    }

    // Auto-resolve title and year if missing
    if (!mediaTitle || !mediaYear) {
        try {
            const details = type === 'tv' ? await getTvDetails(tmdbId) : await getMovieDetails(tmdbId);
            if (!mediaTitle) mediaTitle = details.title;
            if (!mediaYear && details.year) mediaYear = details.year;
        } catch {}
    }

    // Check in-memory stream cache for sub-millisecond instant resolution
    const s = type === 'tv' ? (params.season !== undefined ? Number(params.season) : 1) : 1;
    const e = type === 'tv' ? (params.episode !== undefined ? Number(params.episode) : 1) : 1;
    const cacheKey = `${type}:${tmdbId}:${s}:${e}:${params.srv || 'default'}`;
    const cachedStream = STREAM_CACHE.get(cacheKey);
    if (cachedStream && (Date.now() - cachedStream.timestamp < CACHE_TTL_STREAM)) {
        return { ...cachedStream.result };
    }

    const query: Record<string, any> = {
        title: mediaTitle || '',
        year: mediaYear ? String(mediaYear) : undefined
    };

    if (type === 'tv') {
        query.season = s;
        query.episode = e;
    }

    const attempts: Array<{ serverId: string; serverName: string; status: string; latencyMs: number; error?: string }> = [];

    // Helper: Resolve a single server cluster at maximum speed
    async function tryServer(serverId: string): Promise<BingrScrapeResult | null> {
        const serverMeta = BINGR_SERVERS.find(srv => srv.id === serverId) || { id: serverId, name: serverId };
        const startTime = Date.now();

        try {
            let scraperName = serverMeta.name;
            let sources: BingrStreamSource[] = [];
            let subtitles: Array<{ lang: string; url: string; label?: string }> = [];

            if (serverId === 'animesalt' || serverId === 'anime') {
                const animeRes = await scrapeAnimeEpisode(mediaTitle, s, e);
                scraperName = 'AnimeSalt (Special Anime Scraper)';
                sources = (animeRes.sources || []).map(src => ({
                    url: src.url,
                    quality: src.quality || '1080p',
                    type: src.type || 'application/x-mpegurl',
                    label: src.label,
                    name: src.name
                }));
                subtitles = (animeRes.subtitles || []).map(sub => ({
                    lang: sub.lang,
                    url: sub.url,
                    label: sub.label
                }));
            } else if (serverId === 's4k') {
                const peakRes = await scrapePeakStream({
                    type: type as any,
                    id: tmdbId,
                    title: mediaTitle,
                    year: mediaYear,
                    season: s,
                    episode: e
                });
                scraperName = peakRes.scraperName || serverMeta.name;
                sources = peakRes.sources || [];
                subtitles = peakRes.subtitles || [];
            } else if (serverId === 'm4u' || serverId === 'movies4u') {
                const m4uRes = await scrapeMovies4uCluster({
                    type: type as any,
                    id: tmdbId,
                    title: mediaTitle,
                    year: mediaYear,
                    season: s,
                    episode: e
                });
                scraperName = m4uRes.scraperName || serverMeta.name;
                sources = m4uRes.sources || [];
                subtitles = m4uRes.subtitles || [];
            } else if (serverId === 's40' && type === 'tv' && s && e) {
                // Bingr Aphelion TV endpoint with fallback to /stream
                try {
                    const tvRes = await bingrRequest<{
                        sources?: BingrStreamSource[];
                        subtitles?: Array<{ lang: string; url: string; label?: string }>;
                    }>(`/stream/aphelion-tv/${tmdbId}/${s}/${e}`, {
                        method: 'GET',
                        referer: `https://bingr.one/watch/tv/${tmdbId}/${s}/${e}`,
                        timeout: 3500
                    });
                    if (tvRes.status === 200 && tvRes.data?.sources && tvRes.data.sources.length > 0) {
                        scraperName = 'Aphelion';
                        sources = tvRes.data.sources;
                        subtitles = tvRes.data.subtitles || [];
                    }
                } catch (_) {}

                if (!sources || sources.length === 0) {
                    const payload = {
                        srv: 's40',
                        t: type,
                        id: Number(tmdbId),
                        query
                    };
                    const res = await bingrRequest<{
                        scraperName?: string;
                        sources?: BingrStreamSource[];
                        subtitles?: Array<{ lang: string; url: string; label?: string }>;
                    }>('/stream', {
                        method: 'POST',
                        body: payload,
                        referer: `https://bingr.one/watch/tv/${tmdbId}/${s}/${e}`,
                        timeout: 3500
                    });
                    if (res.status === 200) {
                        scraperName = res.data?.scraperName || 'Aphelion';
                        sources = res.data?.sources || [];
                        subtitles = res.data?.subtitles || [];
                    }
                }
            } else {
                const payload = {
                    srv: serverId,
                    t: type,
                    id: Number(tmdbId),
                    query
                };
                const referer = type === 'tv'
                    ? `https://bingr.one/watch/tv/${tmdbId}/${s}/${e}`
                    : `https://bingr.one/watch/movie/${tmdbId}`;

                const res = await bingrRequest<{
                    scraperName?: string;
                    sources?: BingrStreamSource[];
                    subtitles?: Array<{ lang: string; url: string; label?: string }>;
                }>('/stream', {
                    method: 'POST',
                    body: payload,
                    referer,
                    timeout: 3500
                });

                if (res.status !== 200) throw new Error(`Upstream returned status ${res.status}`);
                scraperName = res.data?.scraperName || serverMeta.name;
                sources = res.data?.sources || [];
                subtitles = res.data?.subtitles || [];
            }

            const latencyMs = Date.now() - startTime;

            if (sources && sources.length > 0) {
                // Always prioritize highest resolution quality: 4K / 2160p > 1080p > 720p > 480p
                sources.sort((a, b) => {
                    const qScore = (q: string = '') => {
                        const l = q.toLowerCase();
                        if (l.includes('4k') || l.includes('2160')) return 4000;
                        if (l.includes('1080') || l.includes('fhd')) return 1080;
                        if (l.includes('720') || l.includes('hd')) return 720;
                        if (l.includes('480')) return 480;
                        return 500;
                    };
                    return qScore(b.quality) - qScore(a.quality);
                });

                const candidateUrl = sources[0].url;

                // Ultra-fast reachability check
                const isReachable = await verifyStreamReachable(candidateUrl, 2500);
                if (!isReachable) {
                    attempts.push({
                        serverId,
                        serverName: serverMeta.name,
                        status: '404_unreachable',
                        latencyMs,
                        error: `Upstream returned HTTP 404/dead link for ${candidateUrl}`
                    });
                    return null;
                }

                // Storyboard Scrubbing Thumbnail Detection (rejects thumbnail sprites / tiles.m3u8)
                const isStoryboard = await isStoryboardStream(candidateUrl);
                if (isStoryboard) {
                    attempts.push({
                        serverId,
                        serverName: serverMeta.name,
                        status: 'storyboard_rejected',
                        latencyMs,
                        error: `Storyboard thumbnail scrub playlist rejected (no genuine video stream): ${candidateUrl}`
                    });
                    return null;
                }
                
                // Strict Duration Verification
                const durCheck = await verifyStreamDuration(candidateUrl, type, Number(tmdbId), s ? Number(s) : undefined, e ? Number(e) : undefined, strictSrv);
                if (!durCheck.isValid) {
                    attempts.push({
                        serverId,
                        serverName: serverMeta.name,
                        status: 'duration_mismatch',
                        latencyMs,
                        error: durCheck.reason
                    });
                    return null; // Skip this stream because duration doesn't match
                }

                if (subtitles.length <= 1) {
                    try {
                        const vdrkSubs = await getSubtitles(type, tmdbId, s, e);
                        if (vdrkSubs && vdrkSubs.length > subtitles.length) {
                            subtitles = vdrkSubs;
                        }
                    } catch {}
                }

                const result: BingrScrapeResult = {
                    success: true,
                    type,
                    tmdbId: Number(tmdbId),
                    title: mediaTitle,
                    year: mediaYear,
                    ...(type === 'tv' ? { season: s, episode: e } : {}),
                    serverId,
                    serverName: serverMeta.name,
                    scraperName: scraperName,
                    primaryM3u8: candidateUrl,
                    quality: sources[0].quality || '1080p',
                    sources: sources,
                    subtitles: subtitles,
                    expectedDurationMinutes: durCheck.expected,
                    streamDurationMinutes: durCheck.actual,
                    streamDurationSec: durCheck.actual ? Math.round(durCheck.actual * 60) : (durCheck.expected ? Math.round(durCheck.expected * 60) : undefined),
                    duration: durCheck.actual || durCheck.expected
                };

                attempts.push({
                    serverId,
                    serverName: serverMeta.name,
                    status: 'success',
                    latencyMs
                });
                return result;
            } else {
                attempts.push({
                    serverId,
                    serverName: serverMeta.name,
                    status: 'empty_sources',
                    latencyMs
                });
                return null;
            }
        } catch (err: any) {
            attempts.push({
                serverId,
                serverName: serverMeta.name,
                status: 'error',
                latencyMs: Date.now() - startTime,
                error: err?.message || 'Network error'
            });
            return null;
        }
    }

    // LIGHT-SPEED 3: Prioritized Concurrency Cascade
    let successResult: BingrScrapeResult | null = null;

    if (params.srv) {
        // Direct requested server priority
        const directId = (params.srv === 'movies4u') ? 'm4u' : (params.srv === 'anime' ? 'animesalt' : params.srv);
        successResult = await tryServer(directId);
        if (params.strictSrv) {
            if (successResult) return successResult;
            return {
                success: false,
                type,
                tmdbId: Number(tmdbId) || 0,
                title: mediaTitle,
                serverId: directId,
                serverName: BINGR_SERVERS.find(s => s.id === directId)?.name || directId,
                error: `No stream available on ${BINGR_SERVERS.find(s => s.id === directId)?.name || directId}`,
                sources: [],
                attempts
            };
        }
    }

    let isAnimeConfirmed = false;
    let malId: number | null = null;
    let hasSkipTimes = false;

    // Check for MAL ID and intro skip timing for series before scraping
    if (type === 'tv' && mediaTitle) {
        try {
            malId = await resolveMalIdFromTitle(mediaTitle);
            if (malId) {
                const epNum = params.episode || 1;
                const skipData = await fetchAniSkipTimes(malId, epNum).catch(() => null);
                if (skipData && skipData.found && skipData.results && skipData.results.length > 0) {
                    hasSkipTimes = true;
                }
                isAnimeConfirmed = true;
                console.log(`[BingrScraper] Series "${mediaTitle}" confirmed as Anime (MAL #${malId}, Intro Skip: ${hasSkipTimes ? 'Yes' : 'Pending'}). AnimeSalt set as 1st priority.`);
            }
        } catch (e: any) {
            // Non-blocking lookup fallback
        }
    }

    const isAnimeLikely = isAnimeConfirmed || Boolean(
        mediaTitle && mediaTitle.match(/naruto|titan|dragon ball|one piece|jujutsu|bleach|hero academia|slayer|hunter|clover|alchemist|evangelion|death note|sword art|ghoul|tokyo|chainsaw|frieren|dandadan|solo leveling|kaiju|boruto|inuyasha|haikyu|basket|detective conan|gintama|steins|dr\.?\s*stone|code geass|fairy tail|vinland|berserk|monster|cowboy bebop|mob psycho|rezero|re:zero|overlord|slime|danmachi|fate|konosuba|blue lock|spy x family|baki/i)
    );

    // If confirmed as anime, try AnimeSalt first
    if (!successResult && isAnimeConfirmed) {
        successResult = await tryServer('animesalt');
    }

    // PRIORITY #1: Aphelion (s40) - Fast Direct 1080p Stream (~350ms resolution).
    // Try s40 FIRST and return immediately if resolved!
    if (!successResult && !isAnimeLikely) {
        successResult = await tryServer('s40');
    }

    if (!successResult) {
        // TIER 1: High-Speed Multi-Audio Race (s62 Bastion, s61 Corvus; plus animesalt/s40 if not yet tried)
        const tier1Servers = isAnimeLikely ? ['animesalt', 's40', 's62'] : ['s62', 's61'];
        const tier1Promises = tier1Servers.map(srv => tryServer(srv));
        const tier1Results = await Promise.allSettled(tier1Promises);
        for (const res of tier1Results) {
            if (res.status === 'fulfilled' && res.value) {
                successResult = res.value;
                break;
            }
        }
    }

    if (!successResult) {
        // TIER 2: Extended Fallback Clusters (Movie4U, Edmunds s3, Polaris s70, Nova s30, Orion s31, PeakStream s4k, Vertex s60)
        const tier2Servers = ['m4u', 's3', 's70', 's30', 's31', 's4k', 's60', 'animesalt'];
        const tier2Promises = tier2Servers.map(srv => tryServer(srv));
        const tier2Results = await Promise.allSettled(tier2Promises);
        for (const res of tier2Results) {
            if (res.status === 'fulfilled' && res.value) {
                successResult = res.value;
                break;
            }
        }
    }

    if (successResult) {
        STREAM_CACHE.set(cacheKey, { timestamp: Date.now(), result: { ...successResult, attempts } });
        return { ...successResult, attempts };
    }

    const season = params.season || 1;
    const episode = params.episode || 1;

    return {
        success: false,
        type,
        tmdbId: Number(tmdbId),
        title: mediaTitle,
        year: mediaYear,
        ...(type === 'tv' ? { season, episode } : {}),
        error: 'No working stream found across active scraper clusters',
        attempts,
        sources: [],
        fallbackEmbeds: [
            `https://embed.filmu.in/${type}/${tmdbId}${type === 'tv' ? `/${season}/${episode}` : ''}`,
            `https://player.videasy.net/${type}/${tmdbId}${type === 'tv' ? `/${season}/${episode}` : ''}`,
            `https://vidbolt.xyz/${type}/${tmdbId}${type === 'tv' ? `/${season}/${episode}` : ''}`,
            `https://embed.bingr.one/embed/${type}/${tmdbId}${type === 'tv' ? `/${season}/${episode}` : ''}`
        ]
    };
}

/**
 * Generate standard IPTV M3U playlist format from scraped Bingr streams
 */
export function buildBingrM3u(options: {
    title: string;
    type: 'movie' | 'tv';
    tmdbId?: number;
    logo?: string;
    groupTitle?: string;
    items: Array<{
        name: string;
        url: string;
        quality?: string;
        logo?: string;
        season?: number;
        episode?: number;
        tmdbId?: number;
    }>;
}): string {
    const lines: string[] = ['#EXTM3U'];
    const defaultGroup = options.groupTitle || (options.type === 'movie' ? 'Bingr Movies' : 'Bingr TV Series');

    for (const item of options.items) {
        const logo = item.logo || options.logo || '';
        const id = item.tmdbId || options.tmdbId || '';
        const qualityTag = item.quality ? ` [${item.quality}]` : '';
        const displayName = `${item.name}${qualityTag}`;
        
        let extraTags = `tvg-id="${id}" tvg-name="${displayName}" group-title="${defaultGroup}"`;
        if (logo) extraTags += ` tvg-logo="${logo}"`;
        if (item.season && item.episode) {
            extraTags += ` tvg-season="${item.season}" tvg-episode="${item.episode}"`;
        }

        lines.push(`#EXTINF:-1 ${extraTags},${displayName}`);
        lines.push(item.url);
    }

    return lines.join('\\n');
}

/**
 * Scrape a Movie stream by TMDB ID (Node.js SDK pattern)
 */
export async function scrapeMovie(tmdbId: number | string, options?: { srv?: string; title?: string; year?: string | number }): Promise<BingrScrapeResult> {
    return scrapeBingrStream({
        type: 'movie',
        id: tmdbId,
        title: options?.title,
        year: options?.year,
        srv: options?.srv
    });
}

/**
 * Scrape a TV Series episode stream by TMDB ID, Season, and Episode (Node.js SDK pattern)
 */
export async function scrapeTvEpisode(
    tmdbId: number | string,
    season: number | string,
    episode: number | string,
    options?: { srv?: string; title?: string; year?: string | number }
): Promise<BingrScrapeResult> {
    return scrapeBingrStream({
        type: 'tv',
        id: tmdbId,
        season: Number(season),
        episode: Number(episode),
        title: options?.title,
        year: options?.year,
        srv: options?.srv
    });
}

