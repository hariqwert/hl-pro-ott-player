import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { Request, Response } from 'express';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Storage directories matching AnimeStream Scraper Architecture
const STORAGE_ROOT = path.resolve(process.cwd(), 'storage');
const STORAGE_PATHS = {
    metadata: path.join(STORAGE_ROOT, 'metadata'),
    playlists: path.join(STORAGE_ROOT, 'playlists'),
    cache: path.join(STORAGE_ROOT, 'cache'),
    logs: path.join(STORAGE_ROOT, 'logs'),
    catalog: path.join(STORAGE_ROOT, 'catalog.json')
};

// Ensure directories exist
try {
    [STORAGE_ROOT, STORAGE_PATHS.metadata, STORAGE_PATHS.playlists, STORAGE_PATHS.cache, STORAGE_PATHS.logs].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
    if (!fs.existsSync(STORAGE_PATHS.catalog)) {
        fs.writeFileSync(STORAGE_PATHS.catalog, JSON.stringify({ series: {}, stats: { totalSeries: 0, totalEpisodes: 0 } }, null, 2), 'utf8');
    }
} catch (e) {
    console.warn('[AnimeScraper] Error initializing storage directories:', e);
}

export interface AnimeSearchResult {
    title: string;
    url: string;
    isSeries: boolean;
    isEpisode: boolean;
    poster?: string;
}

export interface AnimeEpisode {
    url: string;
    slug: string;
    episodeNumber: number | null;
    seasonNumber?: number;
    englishTitle: string;
    title: string;
    streamUrl?: string;
    proxiedStreamUrl?: string;
    poster?: string;
    subtitles?: Array<{ file: string; label: string; language: string }>;
}

export interface AnimeSeriesDiscovery {
    animeTitle: string;
    animeSlug: string;
    seasonSlug: string;
    seasonTitle: string;
    episodes: AnimeEpisode[];
    postId?: string;
    seasons?: Array<{ season: number; label: string; post: string }>;
}

export interface AnimeAudioTrack {
    language: string;
    name: string;
    uri: string | null;
}

export interface AnimeQualityStream {
    resolution: string;
    name: string;
    bandwidth?: number;
    uri: string;
}

export interface AnimeStreamData {
    videoId: string;
    iframeUrl: string;
    masterM3u8: string;
    proxiedM3u8: string;
    poster: string;
    audioTracks: AnimeAudioTrack[];
    qualities: AnimeQualityStream[];
    subtitles: Array<{ file: string; label: string; language: string }>;
    resolvedAt: string;
}

export interface AnimeScrapeResult {
    success: boolean;
    animeTitle: string;
    episodeTitle: string;
    season: number;
    episode: number;
    primaryM3u8: string;
    directM3u8: string;
    poster: string;
    audioTracks: AnimeAudioTrack[];
    qualities: AnimeQualityStream[];
    subtitles: Array<{ lang: string; url: string; label?: string }>;
    sources: Array<{ url: string; quality: string; type: string; label: string; name?: string }>;
    resolvedAt: string;
    cacheHit?: boolean;
}

// In-memory memory cache for sub-millisecond query responses
const MEMORY_CACHE = new Map<string, { timestamp: number; data: any; ttl: number }>();

function sanitizeSlug(str: string): string {
    return (str || 'unknown')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Checks if a direct CDN stream URL with ?expires= timestamp is expired.
 */
export function isStreamExpired(streamUrl: string): boolean {
    if (!streamUrl) return true;
    try {
        const parsed = new URL(streamUrl);
        const expires = parsed.searchParams.get('expires');
        if (!expires) return false;
        const expirySeconds = parseInt(expires, 10);
        const currentSeconds = Math.floor(Date.now() / 1000);
        return currentSeconds >= (expirySeconds - 60); // 60s grace buffer
    } catch {
        return true;
    }
}

/**
 * Parses audio tracks and qualities from a master M3U8 string.
 */
export function parseMasterPlaylist(masterContent: string, baseUrl: string): { audioTracks: AnimeAudioTrack[]; qualities: AnimeQualityStream[] } {
    const audioTracks: AnimeAudioTrack[] = [];
    const qualities: AnimeQualityStream[] = [];

    // Audio tracks: #EXT-X-MEDIA:TYPE=AUDIO...NAME="...",LANGUAGE="..."
    const audioRegex = /#EXT-X-MEDIA:TYPE=AUDIO[^,\n]*,LANGUAGE=["']([^"']+)["'][^,\n]*,NAME=["']([^"']+)["'][^,\n]*(?:,URI=["']([^"']+)["'])?/gi;
    let match: RegExpExecArray | null;
    while ((match = audioRegex.exec(masterContent)) !== null) {
        audioTracks.push({
            language: match[1],
            name: match[2],
            uri: match[3] ? (match[3].startsWith('http') ? match[3] : new URL(match[3], baseUrl).toString()) : null
        });
    }

    // Video streams: #EXT-X-STREAM-INF...RESOLUTION=...,NAME="..."
    const streamRegex = /#EXT-X-STREAM-INF:[^\n]*?(?:RESOLUTION=(\d+x\d+))?[^\n]*?(?:NAME=["']([^"']+)["'])?[^\n]*\n([^\n#]+)/gi;
    while ((match = streamRegex.exec(masterContent)) !== null) {
        const streamUri = match[3].trim();
        qualities.push({
            resolution: match[1] || 'Auto',
            name: match[2] || 'Default',
            uri: streamUri.startsWith('http') ? streamUri : new URL(streamUri, baseUrl).toString()
        });
    }

    return { audioTracks, qualities };
}

/**
 * Search AnimeSalt for series or episodes.
 */
export async function searchAnimeSalt(query: string): Promise<AnimeSearchResult[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const cacheKey = `search:${cleanQuery.toLowerCase()}`;
    const cached = MEMORY_CACHE.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
        return cached.data;
    }

    const searchUrl = `https://animesalt.cx/?s=${encodeURIComponent(cleanQuery)}`;
    try {
        const res = await axios.get(searchUrl, {
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': 'https://animesalt.cx/'
            },
            timeout: 6000
        });

        const html = res.data || '';
        const results: AnimeSearchResult[] = [];
        const articles = html.split('<article').slice(1);

        for (const art of articles) {
            const urlM = art.match(/href="([^"]+)"/);
            const titleM = art.match(/alt="([^"]+)"/) || art.match(/<h2[^>]*>([^<]+)<\/h2>/i);
            const imgM = art.match(/data-src="([^"]+)"/) || art.match(/src="([^"]+)"/);

            if (urlM && urlM[1].includes('animesalt.cx')) {
                const targetUrl = urlM[1].replace(/\/+$/, '') + '/';
                const isSeries = targetUrl.includes('/series/');
                const isEpisode = targetUrl.includes('/episode/');
                let title = titleM ? titleM[1].replace(/^Image\s*/i, '').trim() : 'Anime';
                title = title.replace(/&amp;/g, '&').replace(/&#0*39;|&apos;|`/g, "'").replace(/&quot;/g, '"');

                results.push({
                    url: targetUrl,
                    title,
                    isSeries,
                    isEpisode,
                    poster: imgM ? imgM[1] : undefined
                });
            }
        }

        MEMORY_CACHE.set(cacheKey, { timestamp: Date.now(), data: results, ttl: 15 * 60 * 1000 });
        return results;
    } catch (err: any) {
        console.warn('[AnimeScraper] AnimeSalt search error:', err?.message);
        return [];
    }
}

/**
 * Resolves official English and canonical titles via Kitsu API for Romaji input.
 */
export async function resolveKitsuEnglishTitle(query: string): Promise<string | null> {
    const clean = query.replace(/\(.*?\)/g, '').replace(/Season\s*\d+/i, '').trim();
    if (!clean) return null;

    const cacheKey = `kitsu:${clean.toLowerCase()}`;
    const cached = MEMORY_CACHE.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
        return cached.data;
    }

    try {
        const kitsuUrl = `https://kitsu.io/api/edge/anime?filter%5Btext%5D=${encodeURIComponent(clean)}&page%5Blimit%5D=1`;
        const res = await axios.get(kitsuUrl, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 5000
        });

        const data = res.data?.data?.[0]?.attributes;
        if (data) {
            const enTitle = data.titles?.en || data.canonicalTitle || data.titles?.en_jp;
            if (enTitle) {
                MEMORY_CACHE.set(cacheKey, { timestamp: Date.now(), data: enTitle, ttl: 60 * 60 * 1000 });
                return enTitle;
            }
        }
    } catch (e: any) {
        // Non-fatal
    }
    return null;
}

/**
 * Searches MyAnimeList with integrated Kitsu English title mapping.
 */
export async function searchMalWithKitsu(query: string) {
    if (!query) return { results: [] };

    try {
        const malUrl = `https://myanimelist.net/search/prefix.json?type=anime&keyword=${encodeURIComponent(query)}&v=1`;
        const kitsuUrl = `https://kitsu.io/api/edge/anime?filter%5Btext%5D=${encodeURIComponent(query)}&page%5Blimit%5D=12`;

        const [malRes, kitsuRes] = await Promise.allSettled([
            axios.get(malUrl, { headers: { 'User-Agent': USER_AGENT }, timeout: 5000 }),
            axios.get(kitsuUrl, { headers: { 'User-Agent': USER_AGENT }, timeout: 5000 })
        ]);

        const kitsuMap = new Map<string, string>();
        const cleanKey = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        if (kitsuRes.status === 'fulfilled' && kitsuRes.value.data?.data) {
            for (const k of kitsuRes.value.data.data) {
                const attr = k.attributes || {};
                const eng = attr.titles?.en || attr.canonicalTitle || attr.titles?.en_jp;
                if (eng) {
                    if (attr.canonicalTitle) kitsuMap.set(cleanKey(attr.canonicalTitle), eng);
                    if (attr.titles?.en_jp) kitsuMap.set(cleanKey(attr.titles.en_jp), eng);
                    if (attr.titles?.en) kitsuMap.set(cleanKey(attr.titles.en), eng);
                }
            }
        }

        let results: any[] = [];
        if (malRes.status === 'fulfilled' && malRes.value.data?.categories) {
            const items = malRes.value.data.categories[0]?.items || [];
            results = items.map((item: any) => {
                const key = cleanKey(item.name);
                let englishTitle = kitsuMap.get(key);
                if (!englishTitle) {
                    for (const [k, v] of kitsuMap.entries()) {
                        if (k && (key.includes(k) || k.includes(key))) {
                            englishTitle = v;
                            break;
                        }
                    }
                }
                const resolvedEnglish = englishTitle || item.name;
                return {
                    id: item.id,
                    name: item.name,
                    english_name: resolvedEnglish,
                    display_name: resolvedEnglish !== item.name ? `${resolvedEnglish} (${item.name})` : item.name,
                    url: item.url,
                    image: item.image_url,
                    score: item.payload?.score ?? null,
                    status: item.payload?.status || '',
                    media_type: item.payload?.media_type || '',
                    year: item.payload?.start_year ?? null,
                    aired: item.payload?.aired || ''
                };
            });
        }

        return { query, results };
    } catch (err: any) {
        return { query, results: [], error: err?.message };
    }
}

function findBestSeriesMatch(items: AnimeSearchResult[], targetTitle: string): AnimeSearchResult | null {
    const seriesOnly = items.filter(m => m.isSeries);
    if (seriesOnly.length === 0) return null;

    const lowerTarget = targetTitle.toLowerCase().trim();
    const slugTarget = sanitizeSlug(targetTitle);

    // 1. Exact title or slug match
    const exact = seriesOnly.find(m => 
        m.title.toLowerCase().trim() === lowerTarget ||
        sanitizeSlug(m.title) === slugTarget ||
        m.url.replace(/\/+$/, '').endsWith(`/${slugTarget}`)
    );
    if (exact) return exact;

    // 2. Exact word match (e.g. "Naruto" matches "Naruto" rather than "Boruto: Naruto...")
    const wordMatch = seriesOnly.find(m => {
        const cleaned = m.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        return cleaned === lowerTarget;
    });
    if (wordMatch) return wordMatch;

    // 3. Title starts with target
    const startsWith = seriesOnly.find(m => m.title.toLowerCase().startsWith(lowerTarget));
    if (startsWith) return startsWith;

    // 4. Fallback to first series
    return seriesOnly[0];
}

/**
 * Maps an anime title to a direct AnimeSalt series URL.
 * Automatically translates Romaji to English via Kitsu if direct match fails.
 */
export async function matchAnimeSeries(title: string): Promise<{ matchedUrl: string | null; cleanTitle: string; englishTitle?: string }> {
    const cleanTitle = title
        .replace(/\b(TV|Movie|OVA|ONA|Special)\b/gi, '')
        .replace(/\b(Season\s*\d+|S\d+)\b/gi, '')
        .replace(/\(.*?\)/g, '')
        .replace(/[-_:]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // 1. Direct search on AnimeSalt
    let matches = await searchAnimeSalt(cleanTitle);
    let seriesMatch = findBestSeriesMatch(matches, cleanTitle);
    if (seriesMatch) {
        return { matchedUrl: seriesMatch.url, cleanTitle };
    }

    // 2. Kitsu translation fallback
    const kitsuEnglish = await resolveKitsuEnglishTitle(cleanTitle);
    if (kitsuEnglish && kitsuEnglish.toLowerCase() !== cleanTitle.toLowerCase()) {
        const cleanEnglish = kitsuEnglish.replace(/\(.*?\)/g, '').replace(/Season\s*\d+/i, '').trim();
        matches = await searchAnimeSalt(cleanEnglish);
        seriesMatch = findBestSeriesMatch(matches, cleanEnglish);
        if (seriesMatch) {
            return { matchedUrl: seriesMatch.url, cleanTitle, englishTitle: cleanEnglish };
        }
    }

    // 3. Check if any episode matched that can provide the series link
    const epMatch = matches.find(m => m.isEpisode);
    if (epMatch) {
        // Extract series slug from episode url, e.g. /episode/naruto-1x1/ -> /series/naruto/
        const slugMatch = epMatch.url.match(/\/episode\/([a-z0-9-]+?)(?:-\d+x\d+|-\d+)\//i);
        if (slugMatch) {
            const seriesCandidate = `https://animesalt.cx/series/${slugMatch[1]}/`;
            return { matchedUrl: seriesCandidate, cleanTitle };
        }
    }

    return { matchedUrl: null, cleanTitle };
}

/**
 * Discovers available episodes and seasons from AnimeSalt series URL.
 * Uses admin-ajax.php to fetch non-season-1 episodes when requested.
 */
export async function discoverAnimeEpisodes(targetUrl: string, targetSeason: number = 1): Promise<AnimeSeriesDiscovery> {
    const res = await axios.get(targetUrl, {
        headers: {
            'User-Agent': USER_AGENT,
            'Referer': 'https://animesalt.cx/'
        },
        timeout: 8000
    });

    const html = res.data || '';

    // Title Extraction
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    let rawTitle = titleMatch
        ? titleMatch[1]
            .replace(/\s*-\s*Anime Salt.*/i, '')
            .replace(/\s*-\s*Watch Now.*/i, '')
            .replace(/&amp;/g, '&')
            .replace(/&#0*39;|&apos;|`/g, "'")
            .replace(/&quot;/g, '"')
            .trim()
        : 'Anime';

    let animeTitle = rawTitle;
    let seasonSlug = `season-${targetSeason}`;
    let seasonTitle = `Season ${targetSeason}`;
    const animeSlug = sanitizeSlug(animeTitle);

    // Extract available season buttons: data-post="332" data-season="1"
    const seasonsList: Array<{ season: number; label: string; post: string }> = [];
    let postId: string | undefined;

    const seasonBtnRegex = /class="season-btn[^"]*"[^>]*data-post="([^"]+)"[^>]*data-season="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
    let sMatch: RegExpExecArray | null;
    while ((sMatch = seasonBtnRegex.exec(html)) !== null) {
        const post = sMatch[1];
        const sNum = parseInt(sMatch[2], 10);
        const label = sMatch[3].trim();
        postId = post;
        seasonsList.push({ season: sNum, label, post });
    }

    let articlesHtml = html;

    // If targetSeason > 1 and we have postId, query WordPress AJAX action_select_season
    if (targetSeason > 1 && postId) {
        try {
            const ajaxRes = await axios.post('https://animesalt.cx/wp-admin/admin-ajax.php', 
                `action=action_select_season&season=${targetSeason}&post=${postId}`, 
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': USER_AGENT,
                        'Referer': targetUrl
                    },
                    timeout: 6000
                }
            );
            if (ajaxRes.data && typeof ajaxRes.data === 'string' && ajaxRes.data.includes('<article')) {
                articlesHtml = ajaxRes.data;
            }
        } catch (ajaxErr: any) {
            console.warn(`[AnimeScraper] Season ${targetSeason} AJAX fetch error:`, ajaxErr?.message);
        }
    }

    // Parse Episodes
    const episodeMap = new Map<string, AnimeEpisode>();
    const articles = articlesHtml.split('<article').slice(1);

    for (const art of articles) {
        const urlM = art.match(/href="([^"]*\/episode\/[^"]*)"/);
        const numM = art.match(/class="num-epi">([^<]+)<\/span>/);
        const titleM = art.match(/class="entry-title">([^<]+)<\/h2>/);
        const imgM = art.match(/data-src="([^"]+)"/) || art.match(/src="([^"]+)"/);

        if (urlM) {
            const epUrl = urlM[1].replace(/\/+$/, '') + '/';
            const epSlugMatch = epUrl.match(/\/episode\/([^\/]+)\//);
            const epSlug = epSlugMatch ? epSlugMatch[1] : sanitizeSlug(epUrl);
            const epNum = numM ? parseInt(numM[1].trim(), 10) : null;
            const rawEngTitle = titleM ? titleM[1].trim()
                .replace(/&#0*39;|&apos;|`/g, "'")
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"') : '';

            const displayTitle = epNum
                ? (rawEngTitle ? `${animeTitle} - Episode ${epNum}: ${rawEngTitle}` : `${animeTitle} - Episode ${epNum}`)
                : (rawEngTitle || epSlug.replace(/[-_]/g, ' '));

            episodeMap.set(epUrl, {
                url: epUrl,
                slug: epSlug,
                episodeNumber: epNum,
                seasonNumber: targetSeason,
                englishTitle: rawEngTitle,
                title: displayTitle,
                poster: imgM ? imgM[1] : undefined
            });
        }
    }

    // Fallback regex matching
    if (episodeMap.size === 0) {
        const regex = /href=["'](https:\/\/animesalt\.cx\/episode\/([^"']+))["']/gi;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(articlesHtml)) !== null) {
            const epUrl = match[1].replace(/\/+$/, '') + '/';
            const epSlug = match[2].replace(/\/+$/, '');
            if (!episodeMap.has(epUrl)) {
                const epNumMatch = epSlug.match(/(?:x|ep(?:isode)?[-_]?)(\d+)/i) || epSlug.match(/(\d+)$/);
                const epNum = epNumMatch ? parseInt(epNumMatch[1], 10) : null;
                const displayTitle = epNum ? `${animeTitle} - Episode ${epNum}` : epSlug.replace(/[-_]/g, ' ');
                episodeMap.set(epUrl, {
                    url: epUrl,
                    slug: epSlug,
                    episodeNumber: epNum,
                    seasonNumber: targetSeason,
                    englishTitle: '',
                    title: displayTitle
                });
            }
        }
    }

    const episodes = Array.from(episodeMap.values());
    episodes.sort((a, b) => {
        if (a.episodeNumber && b.episodeNumber) return a.episodeNumber - b.episodeNumber;
        return a.slug.localeCompare(b.slug);
    });

    return {
        animeTitle,
        animeSlug,
        seasonSlug,
        seasonTitle,
        episodes,
        postId,
        seasons: seasonsList
    };
}

/**
 * Resolves player iframe and calls CDN getVideo endpoint to extract master M3U8,
 * subtitles, audio tracks, and qualities.
 */
export async function resolveAnimeEpisodeStream(episodeUrl: string, options: { deepParse?: boolean } = {}): Promise<AnimeStreamData> {
    const cacheKey = `stream:${episodeUrl}`;
    const cached = MEMORY_CACHE.get(cacheKey);
    if (cached && !isStreamExpired(cached.data?.masterM3u8) && (Date.now() - cached.timestamp) < cached.ttl) {
        return cached.data;
    }

    // 1. Fetch Episode HTML
    const epRes = await axios.get(episodeUrl, {
        headers: {
            'User-Agent': USER_AGENT,
            'Referer': 'https://animesalt.cx/'
        },
        timeout: 8000
    });
    const html = epRes.data || '';

    // 2. Extract player iframe: src="https://as-cdn26.top/video/..." or data-src
    const iframeMatch = html.match(/(?:src|data-src)=["'](https?:\/\/[^"']+\/video\/([a-f0-9]+))["']/i);
    if (!iframeMatch) {
        // Fallback: Check if there's any player iframe (such as megaplay.buzz or multi-lang-plyr)
        const generalIframe = html.match(/<iframe[^>]+(?:src|data-src)=["']([^"']+)["']/i);
        if (generalIframe) {
            const rawIframeSrc = generalIframe[1];
            return {
                videoId: 'embed',
                iframeUrl: rawIframeSrc,
                masterM3u8: rawIframeSrc,
                proxiedM3u8: rawIframeSrc,
                poster: '',
                audioTracks: [],
                qualities: [{ resolution: 'Auto', name: 'Web Stream', uri: rawIframeSrc }],
                subtitles: [],
                resolvedAt: new Date().toISOString()
            };
        }
        throw new Error('No player iframe found in episode page');
    }

    const iframeUrl = iframeMatch[1];
    const videoId = iframeMatch[2];
    const cdnHost = new URL(iframeUrl).origin;

    // 3. Call CDN getVideo API
    const apiUrl = `${cdnHost}/player/index.php?data=${videoId}&do=getVideo`;
    const postBody = new URLSearchParams({
        hash: videoId,
        r: 'https://animesalt.cx/'
    }).toString();

    const apiRes = await axios.post(apiUrl, postBody, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Referer': iframeUrl,
            'Origin': cdnHost,
            'User-Agent': USER_AGENT,
            'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 8000
    });

    const data = apiRes.data;
    if (!data || !data.videoSource) {
        throw new Error('Video source not returned by resolver API');
    }

    const masterM3u8: string = data.videoSource;
    const poster: string = data.videoImage || '';
    const proxiedM3u8 = `/api/anime/proxy?url=${encodeURIComponent(masterM3u8)}`;

    let audioTracks: AnimeAudioTrack[] = [];
    let qualities: AnimeQualityStream[] = [];
    const subtitles: Array<{ file: string; label: string; language: string }> = [];

    // 4. Extract subtitle tracks from iframe HTML
    try {
        const iframeRes = await axios.get(iframeUrl, {
            headers: { 'Referer': 'https://animesalt.cx/', 'User-Agent': USER_AGENT },
            timeout: 5000
        });
        let iframeHtml = iframeRes.data || '';

        // Unpack packed javascript if present
        const pMatch = iframeHtml.match(/eval\((function\(p,a,c,k,e,[rd]\)[\s\S]*?)\)\s*;?\s*<\/script>/);
        if (pMatch) {
            try {
                iframeHtml = Function(`return (${pMatch[1]})`)() || iframeHtml;
            } catch {}
        }

        const captionRegex = /"kind"\s*:\s*"captions"[^}]*?"file"\s*:\s*"([^"]+)"[^}]*?"label"\s*:\s*"([^"]+)"/g;
        let cMatch: RegExpExecArray | null;
        while ((cMatch = captionRegex.exec(iframeHtml)) !== null) {
            const cleanFile = cMatch[1].replace(/\\\//g, '/').replace(/\\/g, '');
            subtitles.push({
                file: cleanFile.startsWith('http') ? cleanFile : `${cdnHost}${cleanFile}`,
                label: cMatch[2] || 'English',
                language: 'eng'
            });
        }
    } catch {}

    // 5. Parse master playlist for audio tracks & video resolutions
    try {
        const masterRes = await axios.get(masterM3u8, {
            headers: { 'Referer': `${cdnHost}/`, 'User-Agent': USER_AGENT },
            timeout: 6000
        });
        const parsed = parseMasterPlaylist(masterRes.data || '', masterM3u8);
        audioTracks = parsed.audioTracks;
        qualities = parsed.qualities;
    } catch {}

    const result: AnimeStreamData = {
        videoId,
        iframeUrl,
        masterM3u8,
        proxiedM3u8,
        poster,
        audioTracks,
        qualities,
        subtitles,
        resolvedAt: new Date().toISOString()
    };

    MEMORY_CACHE.set(cacheKey, { timestamp: Date.now(), data: result, ttl: 30 * 60 * 1000 });
    return result;
}

/**
 * Unified high-level episode scraper.
 * Takes anime title + season + episode, finds matching series and episode, and resolves stream.
 */
export async function scrapeAnimeEpisode(title: string, season: number = 1, episode: number = 1): Promise<AnimeScrapeResult> {
    const sNum = Number(season) || 1;
    const epNum = Number(episode) || 1;
    const cacheKey = `anime_ep:${sanitizeSlug(title)}:s${sNum}e${epNum}`;

    const cached = MEMORY_CACHE.get(cacheKey);
    if (cached && !isStreamExpired(cached.data?.directM3u8) && (Date.now() - cached.timestamp) < cached.ttl) {
        return { ...cached.data, cacheHit: true };
    }

    // 1. Match series on AnimeSalt
    const match = await matchAnimeSeries(title);
    if (!match.matchedUrl) {
        throw new Error(`Anime series matching failed for "${title}" on AnimeSalt`);
    }

    // 2. Discover episodes for the requested season
    const discovery = await discoverAnimeEpisodes(match.matchedUrl, sNum);
    if (!discovery.episodes || discovery.episodes.length === 0) {
        throw new Error(`No episodes found for "${discovery.animeTitle}" Season ${sNum}`);
    }

    // 3. Locate target episode by number or slug
    let targetEp = discovery.episodes.find(e => e.episodeNumber === epNum);
    if (!targetEp) {
        // Try slug search like "-1x1" or "-5x220" or episode number in slug
        const targetSlugPart = `${sNum}x${epNum}`;
        targetEp = discovery.episodes.find(e => e.slug.includes(targetSlugPart) || e.slug.endsWith(`-${epNum}`));
    }
    if (!targetEp && epNum <= discovery.episodes.length) {
        // Index-based fallback
        targetEp = discovery.episodes[epNum - 1];
    }
    if (!targetEp) {
        throw new Error(`Episode ${epNum} not found in ${discovery.animeTitle} Season ${sNum} (total ${discovery.episodes.length} episodes)`);
    }

    // 4. Resolve stream
    const streamData = await resolveAnimeEpisodeStream(targetEp.url);

    // 5. Construct multi-quality sources
    const sources: Array<{ url: string; quality: string; type: string; label: string; name?: string }> = [
        {
            url: streamData.proxiedM3u8,
            quality: '1080p',
            type: 'application/x-mpegurl',
            label: 'AnimeSalt Multi-Audio HLS (Proxied)',
            name: 'AnimeSalt HLS'
        },
        {
            url: streamData.masterM3u8,
            quality: '1080p',
            type: 'application/x-mpegurl',
            label: 'AnimeSalt Direct Master HLS',
            name: 'AnimeSalt Direct'
        }
    ];

    // Add audio-specific or quality-specific sources if present
    for (const q of streamData.qualities) {
        if (q.uri) {
            sources.push({
                url: `/api/anime/proxy?url=${encodeURIComponent(q.uri)}`,
                quality: q.resolution || 'Auto',
                type: 'application/x-mpegurl',
                label: `AnimeSalt ${q.resolution || q.name}`,
                name: q.name
            });
        }
    }

    const subtitles = (streamData.subtitles || []).map(sub => ({
        lang: sub.language || 'English',
        url: `/api/anime/subtitle?url=${encodeURIComponent(sub.file)}`,
        label: sub.label || 'English'
    }));

    const result: AnimeScrapeResult = {
        success: true,
        animeTitle: discovery.animeTitle,
        episodeTitle: targetEp.title,
        season: sNum,
        episode: epNum,
        primaryM3u8: streamData.proxiedM3u8,
        directM3u8: streamData.masterM3u8,
        poster: streamData.poster,
        audioTracks: streamData.audioTracks,
        qualities: streamData.qualities,
        subtitles,
        sources,
        resolvedAt: streamData.resolvedAt
    };

    MEMORY_CACHE.set(cacheKey, { timestamp: Date.now(), data: result, ttl: 30 * 60 * 1000 });
    return result;
}

/**
 * Transparent CORS Streaming Proxy for Anime HLS playlists and TS segments.
 * Rewrites relative and internal playlist paths to flow back through this proxy.
 */
export async function handleAnimeHlsProxy(req: Request, res: Response, targetUrl: string) {
    if (!targetUrl) {
        return res.status(400).send('Missing target URL');
    }

    try {
        const parsedTarget = new URL(targetUrl);
        const origin = parsedTarget.origin;

        const upstreamRes = await axios.get(targetUrl, {
            headers: {
                'Referer': `${origin}/`,
                'User-Agent': USER_AGENT
            },
            responseType: 'arraybuffer',
            timeout: 12000
        });

        const contentType = (upstreamRes.headers['content-type'] as string) || '';
        const isPlaylist = targetUrl.includes('.m3u8') || targetUrl.includes('/hls/') || contentType.includes('mpegurl');

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');

        if (isPlaylist) {
            const playlistText = Buffer.from(upstreamRes.data).toString('utf8');

            // Rewrite playlist lines to route sub-playlists and segments back through this proxy
            const rewrittenLines = playlistText.split('\n').map(line => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) {
                    // Check for URI="..." in tags like #EXT-X-MEDIA:TYPE=AUDIO
                    if (trimmed.includes('URI="')) {
                        return trimmed.replace(/URI="([^"]+)"/g, (_, u) => {
                            const absUrl = u.startsWith('http') ? u : new URL(u, targetUrl).toString();
                            return `URI="/api/anime/proxy?url=${encodeURIComponent(absUrl)}"`;
                        });
                    }
                    return line;
                }

                // Media or sub-playlist URI
                const absUrl = trimmed.startsWith('http') ? trimmed : new URL(trimmed, targetUrl).toString();
                return `/api/anime/proxy?url=${encodeURIComponent(absUrl)}`;
            });

            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            return res.send(rewrittenLines.join('\n'));
        } else {
            // Video / Audio segment chunk (.ts, .js, .css, .woff disguised segments)
            res.setHeader('Content-Type', contentType || 'video/MP2T');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.send(Buffer.from(upstreamRes.data));
        }
    } catch (err: any) {
        console.warn('[AnimeProxy] Error fetching upstream URL:', targetUrl, err?.message);
        return res.status(502).send(`Anime proxy error: ${err?.message}`);
    }
}

/**
 * Subtitle Proxy and WebVTT converter.
 */
export async function handleAnimeSubtitleProxy(req: Request, res: Response, subUrl: string) {
    if (!subUrl) {
        return res.status(400).send('Missing subtitle URL');
    }

    try {
        const subRes = await axios.get(subUrl, {
            headers: {
                'Referer': 'https://as-cdn26.top/',
                'User-Agent': USER_AGENT
            },
            timeout: 6000
        });

        let vttText = typeof subRes.data === 'string' ? subRes.data : String(subRes.data);
        if (!vttText.startsWith('WEBVTT')) {
            vttText = 'WEBVTT\n\n' + vttText.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(vttText);
    } catch (err: any) {
        return res.status(502).send(`Subtitle fetch error: ${err?.message}`);
    }
}

/**
 * Compiles standardized #EXTM3U playlist.
 */
export function buildAnimeM3u(episodes: AnimeEpisode[], groupTitle: string = 'Anime'): string {
    let content = '#EXTM3U\n';
    for (const ep of episodes) {
        const stream = ep.proxiedStreamUrl || ep.streamUrl;
        if (!stream) continue;
        const logoAttr = ep.poster ? ` tvg-logo="${ep.poster}"` : '';
        const idAttr = ep.slug ? ` tvg-id="${ep.slug}"` : '';
        const nameAttr = ep.title ? ` tvg-name="${ep.title.replace(/"/g, "'")}"` : '';
        const groupAttr = groupTitle ? ` group-title="${groupTitle.replace(/"/g, "'")}"` : '';
        const displayTitle = ep.title || ep.slug || 'Episode';
        content += `#EXTINF:-1${idAttr}${nameAttr}${logoAttr}${groupAttr}, ${displayTitle}\n`;
        content += `${stream}\n`;
    }
    return content;
}

/**
 * Interface definitions for AniSkip crowdsourced anime opening and ending skip times.
 */
export interface AniSkipInterval {
    startTime: number;
    endTime: number;
}

export interface AniSkipResultItem {
    interval: AniSkipInterval;
    skipType: 'op' | 'ed' | 'mixed-op' | 'mixed-ed' | 'recap';
    skipId: string;
    episodeLength: number;
}

export interface AniSkipResponse {
    found: boolean;
    malId: number;
    episode: number;
    results: AniSkipResultItem[];
    message?: string;
}

// 24-hour in-memory cache for AniSkip API queries to optimize latency
const aniskipCache = new Map<string, { data: AniSkipResponse; timestamp: number }>();
const malIdCache = new Map<string, number>();

/**
 * Resolves MyAnimeList (MAL) ID from an anime title using AniList GraphQL and Kitsu fallbacks.
 */
export async function resolveMalIdFromTitle(title: string): Promise<number | null> {
    if (!title || !title.trim()) return null;
    const cleanTitle = title.replace(/\s*-\s*Episode\s*\d+/i, '').replace(/\s*Season\s*\d+/i, '').trim().toLowerCase();
    if (malIdCache.has(cleanTitle)) {
        return malIdCache.get(cleanTitle) || null;
    }

    // 1. Try AniList GraphQL (very fast, reliable, returns idMal directly)
    try {
        const query = `
            query ($search: String) {
                Media(search: $search, type: ANIME) {
                    id
                    idMal
                    title { romaji english }
                }
            }
        `;
        const res = await axios.post('https://graphql.anilist.co', {
            query,
            variables: { search: cleanTitle }
        }, {
            headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
            timeout: 5000
        });

        const idMal = res.data?.data?.Media?.idMal;
        if (idMal && typeof idMal === 'number') {
            malIdCache.set(cleanTitle, idMal);
            return idMal;
        }
    } catch (e: any) {
        console.warn(`[AniSkip] AniList lookup for "${cleanTitle}" failed:`, e?.message);
    }

    // 2. Try Jikan API fallback
    try {
        const jikanRes = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(cleanTitle)}&limit=1`, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 4000
        });
        const malId = jikanRes.data?.data?.[0]?.mal_id;
        if (malId && typeof malId === 'number') {
            malIdCache.set(cleanTitle, malId);
            return malId;
        }
    } catch (e: any) {
        // Ignore fallback error
    }

    return null;
}

/**
 * Fetches skip times from AniSkip API v2 given a MAL ID, episode, and optional episode length.
 * AniSkip endpoint: https://api.aniskip.com/v2/skip-times/{malId}/{episodeNumber}?types=op&types=ed&episodeLength=0
 */
export async function fetchAniSkipTimes(
    malId: number | string,
    episode: number | string = 1,
    episodeLength: number = 0,
    types: string[] = ['op', 'ed']
): Promise<AniSkipResponse> {
    const numMalId = Number(malId);
    const numEp = Number(episode) || 1;
    const len = Number(episodeLength) >= 0 ? Number(episodeLength) : 0;

    if (!numMalId || isNaN(numMalId)) {
        return {
            found: false,
            malId: 0,
            episode: numEp,
            results: [],
            message: 'Valid MAL ID is required'
        };
    }

    const cacheKey = `${numMalId}_${numEp}`;
    const cached = aniskipCache.get(cacheKey);
    const now = Date.now();
    if (cached && (now - cached.timestamp < 24 * 60 * 60 * 1000)) {
        return cached.data;
    }

    try {
        // Strictly request only pure intro ('op') and outro ('ed') - NEVER mixed opening/ending
        const rawTypes = (types && types.length > 0) ? types : ['op', 'ed'];
        const allowedTypes = rawTypes.filter(t => t === 'op' || t === 'ed');
        const queryTypes = allowedTypes.length > 0 ? allowedTypes : ['op', 'ed'];
        const typeParams = queryTypes.map(t => `types=${encodeURIComponent(t)}`).join('&');
        const apiUrl = `https://api.aniskip.com/v2/skip-times/${numMalId}/${numEp}?${typeParams}&episodeLength=${len}`;

        const res = await axios.get(apiUrl, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'application/json'
            },
            timeout: 6000,
            validateStatus: (status) => status === 200 || status === 404
        });

        if (res.status === 200 && res.data && res.data.found) {
            // Filter strictly for pure intro ('op') and outro ('ed'), excluding mixed-op, mixed-ed, etc.
            const parsedResults: AniSkipResultItem[] = (res.data.results || [])
                .filter((item: any) => {
                    const sType = (item.skipType || '').toLowerCase().trim();
                    return sType === 'op' || sType === 'ed';
                })
                .map((item: any) => {
                    const sType = item.skipType.toLowerCase().trim();
                    return {
                        interval: {
                            startTime: Math.max(0, Number(item.interval?.startTime || 0)),
                            endTime: Number(item.interval?.endTime || 0)
                        },
                        skipType: sType,
                        skipId: item.skipId || String(Math.random()),
                        episodeLength: Number(item.episodeLength || len)
                    };
                });

            const result: AniSkipResponse = {
                found: parsedResults.length > 0,
                malId: numMalId,
                episode: numEp,
                results: parsedResults,
                message: parsedResults.length > 0 ? (res.data.message || 'Successfully found skip times') : 'No pure intro/outro skip times found'
            };

            aniskipCache.set(cacheKey, { data: result, timestamp: now });
            return result;
        }

        const notFoundResult: AniSkipResponse = {
            found: false,
            malId: numMalId,
            episode: numEp,
            results: [],
            message: res.data?.message || 'No skip times registered for this anime episode'
        };
        // Cache negative result for 1 hour to prevent API flooding
        aniskipCache.set(cacheKey, { data: notFoundResult, timestamp: now - 23 * 60 * 60 * 1000 });
        return notFoundResult;
    } catch (err: any) {
        console.warn(`[AniSkip] Error querying AniSkip for MAL #${numMalId} Ep ${numEp}:`, err?.message);
        return {
            found: false,
            malId: numMalId,
            episode: numEp,
            results: [],
            message: `AniSkip API error: ${err?.message}`
        };
    }
}

export interface AniListEpisodeItem {
    episodeNumber: number;
    title: string;
    name: string;
    thumbnail: string;
    url?: string;
    site?: string;
    seasonNumber: number;
}

export interface AniListAnimeDetails {
    id: number;
    idMal?: number;
    title: {
        english?: string;
        romaji?: string;
        native?: string;
        userPreferred?: string;
    };
    displayTitle: string;
    coverImage: string;
    bannerImage?: string;
    description: string;
    genres: string[];
    averageScore?: number;
    status?: string;
    seasonYear?: number;
    episodesCount: number;
    duration?: number;
    nextAiringEpisode?: {
        episode: number;
        airingAt: number;
        timeUntilAiring: number;
    };
    episodes: AniListEpisodeItem[];
}

const anilistMediaCache = new Map<string, { data: AniListAnimeDetails; timestamp: number }>();

/**
 * Fetches rich episode-wise details from AniList GraphQL with exact episode titles, thumbnails,
 * streaming references, and comprehensive metadata.
 */
export async function fetchAniListEpisodes(options: { id?: number | string; malId?: number | string; title?: string }): Promise<AniListAnimeDetails | null> {
    const rawId = options.id ? Number(options.id) : undefined;
    const rawMalId = options.malId ? Number(options.malId) : undefined;
    const title = (options.title || '').trim();

    if (!rawId && !rawMalId && !title) return null;

    const cacheKey = `ani_${rawId || ''}_${rawMalId || ''}_${title.toLowerCase()}`;
    const cached = anilistMediaCache.get(cacheKey);
    const now = Date.now();
    if (cached && (now - cached.timestamp < 30 * 60 * 1000)) {
        return cached.data;
    }

    try {
        let mediaData: any = null;

        if (rawId && !isNaN(rawId)) {
            const queryById = `
                query ($id: Int) {
                    Media(id: $id, type: ANIME) {
                        id
                        idMal
                        title { english romaji native userPreferred }
                        episodes
                        status
                        seasonYear
                        duration
                        averageScore
                        genres
                        description(asHtml: false)
                        bannerImage
                        coverImage { extraLarge large medium color }
                        nextAiringEpisode { episode airingAt timeUntilAiring }
                        streamingEpisodes { title thumbnail url site }
                    }
                }
            `;
            const res = await axios.post('https://graphql.anilist.co', {
                query: queryById,
                variables: { id: rawId }
            }, {
                headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
                timeout: 7000
            });
            mediaData = res.data?.data?.Media;
        } else if (rawMalId && !isNaN(rawMalId)) {
            const queryByMal = `
                query ($idMal: Int) {
                    Media(idMal: $idMal, type: ANIME) {
                        id
                        idMal
                        title { english romaji native userPreferred }
                        episodes
                        status
                        seasonYear
                        duration
                        averageScore
                        genres
                        description(asHtml: false)
                        bannerImage
                        coverImage { extraLarge large medium color }
                        nextAiringEpisode { episode airingAt timeUntilAiring }
                        streamingEpisodes { title thumbnail url site }
                    }
                }
            `;
            const res = await axios.post('https://graphql.anilist.co', {
                query: queryByMal,
                variables: { idMal: rawMalId }
            }, {
                headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
                timeout: 7000
            });
            mediaData = res.data?.data?.Media;
        }

        // Search by title if ID lookup did not return or wasn't provided
        if (!mediaData && title) {
            const cleanTitle = title
                .replace(/\s*-\s*Episode\s*\d+/i, '')
                .replace(/\s*Season\s*\d+/i, '')
                .replace(/\(.*?\)/g, '')
                .trim();

            const queryBySearch = `
                query ($search: String) {
                    Page(page: 1, perPage: 5) {
                        media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
                            id
                            idMal
                            title { english romaji native userPreferred }
                            episodes
                            status
                            seasonYear
                            duration
                            averageScore
                            genres
                            description(asHtml: false)
                            bannerImage
                            coverImage { extraLarge large medium color }
                            nextAiringEpisode { episode airingAt timeUntilAiring }
                            streamingEpisodes { title thumbnail url site }
                        }
                    }
                }
            `;
            const res = await axios.post('https://graphql.anilist.co', {
                query: queryBySearch,
                variables: { search: cleanTitle }
            }, {
                headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
                timeout: 7000
            });
            const list = res.data?.data?.Page?.media || [];
            if (list.length > 0) {
                mediaData = list[0];
            }
        }

        if (!mediaData) return null;

        const displayTitle = mediaData.title?.english || mediaData.title?.romaji || mediaData.title?.userPreferred || title || 'Anime Series';
        const cover = mediaData.coverImage?.extraLarge || mediaData.coverImage?.large || mediaData.coverImage?.medium || '';
        const banner = mediaData.bannerImage || cover;
        const totalEps = mediaData.episodes || (mediaData.streamingEpisodes && mediaData.streamingEpisodes.length > 0 ? mediaData.streamingEpisodes.length : 12);

        // Process episode map from streaming episodes
        const epMap = new Map<number, AniListEpisodeItem>();
        const streaming = mediaData.streamingEpisodes || [];

        for (let i = 0; i < streaming.length; i++) {
            const item = streaming[i];
            const rawEpTitle = item.title || `Episode ${i + 1}`;
            // Extract episode number from string like "Episode 12 - Name" or "12. Name"
            const numMatch = rawEpTitle.match(/(?:Episode|EP|Ep\.)\s*(\d+)/i) || rawEpTitle.match(/^(\d+)[\.\s:-]/);
            const epNum = numMatch ? parseInt(numMatch[1], 10) : (i + 1);

            let cleanEpName = rawEpTitle
                .replace(/^(?:Episode|EP|Ep\.)\s*\d+\s*[-:–—]?\s*/i, '')
                .replace(/^\d+[\.\s:-]\s*/, '')
                .trim();

            if (!cleanEpName) cleanEpName = `Episode ${epNum}`;

            epMap.set(epNum, {
                episodeNumber: epNum,
                title: `${displayTitle} - Episode ${epNum}: ${cleanEpName}`,
                name: cleanEpName,
                thumbnail: item.thumbnail || banner || cover,
                url: item.url,
                site: item.site,
                seasonNumber: 1
            });
        }

        // Fill in any gaps from 1 to totalEps
        const maxEpNum = Math.max(totalEps, epMap.size > 0 ? Math.max(...Array.from(epMap.keys())) : 1);
        const finalEpisodes: AniListEpisodeItem[] = [];

        for (let ep = 1; ep <= maxEpNum; ep++) {
            if (epMap.has(ep)) {
                finalEpisodes.push(epMap.get(ep)!);
            } else {
                finalEpisodes.push({
                    episodeNumber: ep,
                    title: `${displayTitle} - Episode ${ep}`,
                    name: `Episode ${ep}`,
                    thumbnail: banner || cover,
                    seasonNumber: 1
                });
            }
        }

        // Sort sequentially
        finalEpisodes.sort((a, b) => a.episodeNumber - b.episodeNumber);

        const result: AniListAnimeDetails = {
            id: mediaData.id,
            idMal: mediaData.idMal,
            title: mediaData.title || {},
            displayTitle,
            coverImage: cover,
            bannerImage: banner,
            description: mediaData.description || 'No overview available.',
            genres: Array.isArray(mediaData.genres) ? mediaData.genres : ['Anime'],
            averageScore: mediaData.averageScore ? (mediaData.averageScore / 10) : undefined,
            status: mediaData.status,
            seasonYear: mediaData.seasonYear,
            episodesCount: finalEpisodes.length,
            duration: mediaData.duration,
            nextAiringEpisode: mediaData.nextAiringEpisode,
            episodes: finalEpisodes
        };

        anilistMediaCache.set(cacheKey, { data: result, timestamp: now });
        return result;
    } catch (err: any) {
        console.warn('[AniList] Error fetching episodes from AniList:', err?.message);
        return null;
    }
}


