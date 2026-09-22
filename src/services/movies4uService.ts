import axios from 'axios';
import { URL } from 'url';

// Dynamic Movies4u Mirror Registry & Auto-Discovery Engine
export const MOVIES4U_PRIMARY_INDEX_URL = 'https://movies4u.tube/';
export const MOVIES4U_COMPANION_INDEXES = ['https://movies4u.review', 'https://movies4u.ist'];

export let movies4uActiveMirrors: string[] = [
    'https://new6.movies4u.clinic',
    'https://new7.movies4u.clinic',
    'https://new8.movies4u.clinic',
    'https://new5.movies4u.clinic'
];

export let lastMirrorDiscoveryTime = 0;
let isDiscoveringMirrors = false;

export interface Movies4uLookupHit {
    id?: string;
    post_title: string;
    permalink: string;
    post_thumbnail?: string;
    movie_quality?: string;
}

/**
 * Autonomous Mirror Discovery & Primary Promotion Function
 */
export async function discoverAndPromoteMovies4uMirrors(force = false): Promise<{ primary: string; mirrors: string[]; fromCache: boolean }> {
    const now = Date.now();
    // Cache discovery for 15 minutes unless forced
    if (!force && movies4uActiveMirrors.length > 0 && (now - lastMirrorDiscoveryTime) < 15 * 60 * 1000) {
        return { primary: movies4uActiveMirrors[0], mirrors: movies4uActiveMirrors, fromCache: true };
    }

    if (isDiscoveringMirrors) {
        return { primary: movies4uActiveMirrors[0] || 'https://new6.movies4u.clinic', mirrors: movies4uActiveMirrors, fromCache: true };
    }

    isDiscoveringMirrors = true;
    const discoveredCandidates = new Set<string>();

    try {
        console.log(`[Movies4u Mirror Engine] Checking primary index ${MOVIES4U_PRIMARY_INDEX_URL} for active mirrors...`);
        
        // 1. Primary check: https://movies4u.tube/
        try {
            const tubeRes = await axios.get(MOVIES4U_PRIMARY_INDEX_URL, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                },
                timeout: 3000
            });
            const tubeHtml = String(tubeRes.data || '');
            const tubeUrls = tubeHtml.match(/https?:\/\/[^\s"'<>,]+/gi) || [];
            for (const u of tubeUrls) {
                if (u.includes('movies4u') && !u.includes('facebook') && !u.includes('twitter') && !u.includes('reddit') && !u.includes('t.me') && !u.includes('schema.org')) {
                    try {
                        const origin = new URL(u).origin;
                        discoveredCandidates.add(origin);
                    } catch(err) {}
                }
            }
        } catch (tubeErr: any) {
            console.warn(`[Movies4u Mirror Engine] movies4u.tube check warning:`, tubeErr?.message);
        }

        // 2. Companion indexes check (movies4u.review, movies4u.ist)
        for (const indexUrl of MOVIES4U_COMPANION_INDEXES) {
            try {
                const companionRes = await axios.get(indexUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    timeout: 2500
                });
                const companionHtml = String(companionRes.data || '');
                const companionUrls = companionHtml.match(/https?:\/\/[^\s"'<>,]+/gi) || [];
                for (const u of companionUrls) {
                    if (u.includes('movies4u') && !u.includes('facebook') && !u.includes('twitter') && !u.includes('reddit') && !u.includes('t.me') && !u.includes('schema.org')) {
                        try {
                            const origin = new URL(u).origin;
                            discoveredCandidates.add(origin);
                        } catch(err) {}
                    }
                }
            } catch (err) {}
        }

        // 3. Predictive candidate pool (covers new1..new10 .clinic, .vip, .run, .tube)
        for (let i = 1; i <= 10; i++) {
            discoveredCandidates.add(`https://new${i}.movies4u.clinic`);
        }
        discoveredCandidates.add('https://new6.movies4u.clinic');
        discoveredCandidates.add('https://movies4u.vip');
        discoveredCandidates.add('https://movies4u.run');
        discoveredCandidates.add('https://movies4u.review');
        discoveredCandidates.add('https://movies4u.tube');

        // 4. Concurrent Health Check & Latency Benchmark using /lookup.php
        const verifiedMirrors: { origin: string; latency: number; hasCatalog: boolean }[] = [];
        const benchmarkQuery = 'Inception';

        const probePromises = Array.from(discoveredCandidates).map(async (origin) => {
            const startTime = Date.now();
            try {
                const probeUrl = `${origin}/lookup.php?q=${encodeURIComponent(benchmarkQuery)}&page=1&per_page=5`;
                const res = await axios.get(probeUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                        'Referer': `${origin}/?s=${encodeURIComponent(benchmarkQuery)}`,
                        'Accept': 'application/json, text/javascript, */*; q=0.01',
                        'Sec-Fetch-Site': 'same-origin',
                        'Sec-Fetch-Mode': 'cors'
                    },
                    timeout: 2500
                });

                const latency = Date.now() - startTime;
                const hasHits = res.status === 200 && res.data && (Array.isArray(res.data.hits) || res.data.ok === true);

                if (hasHits) {
                    verifiedMirrors.push({ origin, latency, hasCatalog: true });
                } else if (res.status === 200) {
                    const html = String(res.data || '');
                    if (html.length > 3000 && (html.includes('full-movie') || html.includes('m4uplay') || html.includes('wp-content/themes'))) {
                        verifiedMirrors.push({ origin, latency, hasCatalog: true });
                    }
                }
            } catch (probeErr) {
                // Offline or unreachable mirror - skip silently
            }
        });

        await Promise.allSettled(probePromises);

        // Sort by fastest latency
        verifiedMirrors.sort((a, b) => a.latency - b.latency);

        if (verifiedMirrors.length > 0) {
            movies4uActiveMirrors = verifiedMirrors.map(v => v.origin);
            lastMirrorDiscoveryTime = Date.now();
            console.log(`[Movies4u Mirror Engine] ⭐ Auto-promoted PRIMARY mirror: ${movies4uActiveMirrors[0]} (Latency: ${verifiedMirrors[0].latency}ms, ${verifiedMirrors.length} healthy mirrors total)`);
        } else {
            console.warn('[Movies4u Mirror Engine] No responsive mirrors verified in benchmark, retaining fallback list.');
            if (!movies4uActiveMirrors.includes('https://new6.movies4u.clinic')) {
                movies4uActiveMirrors.unshift('https://new6.movies4u.clinic');
            }
        }
    } catch (err: any) {
        console.error('[Movies4u Mirror Engine] Error during mirror discovery:', err?.message || err);
    } finally {
        isDiscoveringMirrors = false;
    }

    return {
        primary: movies4uActiveMirrors[0] || 'https://new6.movies4u.clinic',
        mirrors: movies4uActiveMirrors,
        fromCache: false
    };
}

// Initial background startup discovery
const initDiscoveryTimeout = setTimeout(() => {
    discoverAndPromoteMovies4uMirrors(true).catch(() => {});
}, 1000);
if (initDiscoveryTimeout && typeof initDiscoveryTimeout.unref === 'function') {
    initDiscoveryTimeout.unref();
}

// Periodic 30-minute background mirror health check
const mirrorInterval = setInterval(() => {
    discoverAndPromoteMovies4uMirrors(false).catch(() => {});
}, 30 * 60 * 1000);
if (mirrorInterval && typeof mirrorInterval.unref === 'function') {
    mirrorInterval.unref();
}

/**
 * Dean Edwards M3U8 Unpacker helper supporting VidHide, Morencius, M4UPlay, and Acek CDN
 */
export async function getDirectM3u8FromMorenciusId(fileIdOrUrl: string, mirrorOrigin?: string) {
    try {
        const isFullUrl = fileIdOrUrl.startsWith('http://') || fileIdOrUrl.startsWith('https://');
        const rawId = isFullUrl ? (fileIdOrUrl.split('/').pop() || '') : fileIdOrUrl;
        const refererUrl = mirrorOrigin || movies4uActiveMirrors[0] || 'https://new6.movies4u.clinic/';
        
        const candidateEmbedUrls: string[] = isFullUrl
            ? [fileIdOrUrl]
            : [
                `https://vidhidepre.com/file/${rawId}`,
                `https://m4uplay.store/file/${rawId}`,
                `https://morencius.com/embed/${rawId}`,
                `https://vidhide.com/file/${rawId}`
            ];

        for (const embedUrl of candidateEmbedUrls) {
            try {
                const res = await axios.get(embedUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                        'Referer': refererUrl.endsWith('/') ? refererUrl : `${refererUrl}/`
                    },
                    timeout: 7000
                });
                const html = String(res.data || '');
                let m3u8Url = null;
                let links: any = {};

                const scripts = html.match(/<script[\s\S]*?<\/script>/gi) || [];
                const evalScript = scripts.find(s => s.includes('eval(function(p,a,c,k,e,d)'));
                if (evalScript) {
                    try {
                        const code = evalScript.replace(/<script.*?>/, '').replace(/<\/script>/, '');
                        // eslint-disable-next-line no-eval
                        const unpacked = eval(code.replace('eval(', '('));
                        
                        const linksMatch = unpacked.match(/var links=(\{.*?\});/) || unpacked.match(/var n=(\{.*?\});/);
                        if (linksMatch) {
                            try {
                                links = JSON.parse(linksMatch[1]);
                            } catch(e) {}
                        }

                        // Match m3u8 or stream urls in unpacked string
                        const streamMatches = unpacked.match(/https?:\/\/[^\s"'<>]+\.(?:m3u8|mp4)[^\s"'<>]*/gi)
                            || unpacked.match(/https?:\/\/[^\s"'<>]+\/hls2?\/[^\s"'<>]*/gi);

                        if (streamMatches && streamMatches.length > 0) {
                            m3u8Url = streamMatches[0];
                        }
                    } catch (e: any) {}
                }

                if (!m3u8Url) {
                    const directMatches = html.match(/https?:\/\/[^\s"'<>]+\.(?:m3u8|mp4)[^\s"'<>]*/gi);
                    if (directMatches && directMatches.length > 0) {
                        m3u8Url = directMatches[0];
                    }
                }

                if (m3u8Url || res.status === 200) {
                    return {
                        ok: true,
                        m4uId: rawId,
                        m3u8Url,
                        embedUrl,
                        morenciusUrl: embedUrl,
                        links
                    };
                }
            } catch (_) {}
        }

        return {
            ok: true,
            m4uId: rawId,
            m3u8Url: null,
            embedUrl: candidateEmbedUrls[0],
            morenciusUrl: candidateEmbedUrls[0],
            links: {}
        };
    } catch(err: any) {
        return { ok: false, error: err?.message || err };
    }
}

/**
 * Movies4u Lookup.php Hits Match Selection Helper
 */
export function selectBestMovies4uHit(
    hits: Movies4uLookupHit[],
    query: string,
    yearHint?: string,
    originalTitleHint?: string,
    season?: number,
    episode?: number
): string {
    if (!hits || hits.length === 0) return '';
    const qNorm = query.toLowerCase().trim();
    const queryWords = qNorm.split(/\s+/).filter(w => w.length > 1);

    const scored = hits.map(hit => {
        let score = 0;
        const titleLower = (hit.post_title || '').toLowerCase();
        const permalinkLower = (hit.permalink || '').toLowerCase();

        // 1. Query words matching
        for (const w of queryWords) {
            const regex = new RegExp(`(?:^|[\\/\\-\\s_])${w}(?:[\\/\\-\\s_]|$)`, 'i');
            if (regex.test(permalinkLower) || regex.test(titleLower)) {
                score += 100;
            } else if (permalinkLower.includes(w) || titleLower.includes(w)) {
                score += 40;
            }
        }

        // 2. Year matching
        if (yearHint) {
            if (titleLower.includes(yearHint) || permalinkLower.includes(yearHint)) {
                score += 200;
            }
        }

        // 3. Original Title matching
        if (originalTitleHint) {
            const cleanOrg = originalTitleHint.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (cleanOrg && cleanOrg.length > 2) {
                if (titleLower.replace(/[^a-z0-9]/g, '').includes(cleanOrg) || permalinkLower.replace(/[^a-z0-9]/g, '').includes(cleanOrg)) {
                    score += 250;
                }
            }
        }

        // 4. Season matching for TV
        if (season) {
            if (titleLower.includes(`season ${season}`) || titleLower.includes(`s${season}`) || permalinkLower.includes(`season-${season}`)) {
                score += 250;
            }
        }

        // 5. Quality and Audio preferences
        if (titleLower.includes('dual audio') || titleLower.includes('multi audio')) score += 30;
        if (titleLower.includes('bluray') || titleLower.includes('web-dl')) score += 20;

        return { permalink: hit.permalink, score };
    });

    scored.sort((a, b) => b.score - a.score);
    if (scored.length > 0 && scored[0].score >= 40) {
        return scored[0].permalink;
    }
    return hits[0].permalink;
}

/**
 * Movies4u Post URL Match Selection Helper with Malayalam Preference
 */
export function selectBestMovies4uPostUrl(postLinks: string[], searchHtml: string, query: string, yearHint?: string, originalTitleHint?: string): string {
    if (!postLinks || postLinks.length === 0) return '';
    const validUrls: { url: string; score: number }[] = [];
    const qNorm = query.toLowerCase().trim();
    const queryWords = qNorm.split(/\s+/).filter(w => w.length > 2);

    for (const linkStr of postLinks) {
        const url = linkStr.replace(/^href=["']/, '').replace(/["']$/, '');
        const l = url.toLowerCase();
        if (l.includes('/feed/') || l.includes('/comments/') || l.includes('/search/') ||
            l.includes('/category/') || l.includes('/tag/') || l.includes('/genre/') ||
            l.includes('/year/') || l.includes('wp-content') || l.includes('wp-json') ||
            l.includes('/dmca/') || l.includes('/disclaimer/') || l.includes('/contact-us/') ||
            l.includes('/how-to-download/') || l.includes('/movie-request-page/') || l.includes('/find-movie/')) {
            continue;
        }

        if (validUrls.some(v => v.url === url)) continue;

        let score = 0;

        // Query words matching in slug (strict boundary check)
        for (const w of queryWords) {
            const regex = new RegExp(`(?:^|[\\/-])${w}(?:[\\/-]|$)`);
            if (regex.test(l)) {
                score += 100; // Explicit word match in slug
            } else if (l.includes(w)) {
                score += 10; // Partial match (e.g., 'leo' in 'napoleon')
            }
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

        // 1. Check if URL slug contains Malayalam
        if (l.includes('malayalam') || l.includes('-mal-') || l.includes('/mal-') || l.includes('malayalam-audio') || l.includes('malayalam-sub')) {
            score += 100;
        }

        // 2. Check surrounding HTML in search results for Malayalam keywords
        const idx = searchHtml.indexOf(url);
        if (idx !== -1) {
            const contextSnippet = searchHtml.substring(Math.max(0, idx - 300), Math.min(searchHtml.length, idx + 300)).toLowerCase();
            if (contextSnippet.includes('malayalam') || contextSnippet.includes('malayalam-audio') || contextSnippet.includes('[malayalam')) {
                score += 150;
            }
            for (const w of queryWords) {
                if (contextSnippet.includes(w)) score += 20;
            }
        }

        // 3. Chapter matching
        if (/\b1\b/.test(qNorm) && l.includes('chapter-1')) score += 50;
        if (/\b2\b/.test(qNorm) && l.includes('chapter-2')) score += 50;
        if (/\b3\b/.test(qNorm) && l.includes('chapter-3')) score += 50;

        validUrls.push({ url, score });
    }

    if (validUrls.length === 0) return '';
    validUrls.sort((a, b) => b.score - a.score);
    
    // Strict Guard: If the best match has a very low score (e.g. only partial substring matches), reject it
    if (validUrls[0].score < 50) {
        console.warn('[Movies4u] Rejecting low-confidence match:', validUrls[0].url, 'Score:', validUrls[0].score);
        return '';
    }
    
    return validUrls[0].url;
}

export function selectBestMovies4uEmbed(embedMatches: string[], pageHtml: string, episode?: number, season?: number): string {
    if (!embedMatches || embedMatches.length === 0) return '';
    const scored = embedMatches.map((rawEmbed, matchIndex) => {
        let score = 0;
        const idx = pageHtml.indexOf(rawEmbed);
        if (idx !== -1) {
            const snippet = pageHtml.substring(Math.max(0, idx - 200), Math.min(pageHtml.length, idx + 200)).toLowerCase();
            if (snippet.includes('malayalam')) score += 100;
            if (snippet.includes('multi audio') || snippet.includes('dual audio')) score += 50;

            if (episode !== undefined) {
                // If it's a TV show, look for episode markers near the embed
                const epStr1 = `ep ${episode}`;
                const epStr2 = `episode ${episode}`;
                const epStr3 = `e${episode}`;
                const epStr4 = `ep-${episode}`;
                const epStr5 = `ep${episode}`;
                const epStr6 = `${episode}. `;
                
                if (snippet.includes(epStr1) || snippet.includes(epStr2) || snippet.includes(epStr3) || snippet.includes(epStr4) || snippet.includes(epStr5) || snippet.includes(epStr6)) {
                    score += 200;
                }
                
                // Secondary check for previous/next tags to infer order
                // Or if it's the Nth match on the page, and it's episode N
                // Often episodes are just listed top to bottom.
                if (matchIndex + 1 === episode) {
                    score += 150;
                }
            }
        }
        return { rawEmbed, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0].rawEmbed;
}

/**
 * Multi-Provider Universal Movie & TV Show HLS Stream Resolver Engine
 */
export async function resolveMovieHlsStream(params: {
    id?: string;
    query?: string;
    type?: string;
    season?: number;
    episode?: number;
}) {
    const rawId = (params.id || '').trim();
    const query = (params.query || '').trim();
    const mediaType = params.type === 'tv' ? 'tv' : 'movie';
    const season = params.season ? Number(params.season) : 1;
    const episode = params.episode ? Number(params.episode) : 1;

    let targetTitle = query;
    let tmdbId = rawId;
    let releaseYear = '';
    let imdbId = '';
    let originalTitle = '';

    // 1. Always fetch TMDB metadata if ID is numeric or starts with tt, to get year and original title for accurate double-checking
    if (/^\d+$/.test(rawId) || rawId.startsWith('tt')) {
        try {
            const apiKey = process.env.TMDB_API_KEY || 'a07e22bc18f5cb106bfe4cc1f83ad8ed';
            const tmdbIdToFetch = rawId.startsWith('tt') ? rawId : String(rawId);
            const tmdbRes = await axios.get(`https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbIdToFetch}?api_key=${apiKey}`, { timeout: 3000 });
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
    }

    if (!targetTitle && !tmdbId && !rawId) {
        return { ok: false, error: 'Missing movie ID or query title' };
    }

    let cleanBaseTitle = targetTitle
        .replace(/\s*S\d+\s*E\d+/gi, '')
        .replace(/\s*Season\s*\d+\s*Episode\s*\d+/gi, '')
        .replace(/\s*EP\s*\d+/gi, '')
        .trim();
    if (!cleanBaseTitle) cleanBaseTitle = targetTitle;

    const queryWithEp = (mediaType === 'tv' && cleanBaseTitle) ? `${cleanBaseTitle} S${season} E${episode}` : (cleanBaseTitle || targetTitle);

    // --- TIER 1: Morencius / Movies4u Direct M3U8 / Embed Resolution ---
    if (rawId && !/^\d+$/.test(rawId) && !rawId.startsWith('tt')) {
        try {
            const m3u8Data = await getDirectM3u8FromMorenciusId(rawId);
            if (m3u8Data.ok) {
                const playUrl = m3u8Data.m3u8Url
                    ? `/play.php?url=${encodeURIComponent(m3u8Data.m3u8Url)}&name=${encodeURIComponent(queryWithEp || rawId)}&source=consumet.html`
                    : `/play_consumet.php?id=${encodeURIComponent(rawId)}&name=${encodeURIComponent(queryWithEp || rawId)}&type=${mediaType}&s=${season}&e=${episode}&source=consumet.html`;
                return {
                    ok: true,
                    query: queryWithEp || rawId,
                    m4uId: rawId,
                    embedUrl: m3u8Data.morenciusUrl || `https://m4uplay.store/file/${rawId}`,
                    m3u8Url: m3u8Data.m3u8Url || null,
                    playUrl,
                    source: 'movies4u_direct'
                };
            }
        } catch(e) {}
    }

    if (queryWithEp) {
        // Query active mirrors dynamically
        async function attemptMirrorScrape(mirrors: string[]) {
            const mirrorPromises = mirrors.map(async (mirrorBase) => {
                const cleanBase = mirrorBase.endsWith('/') ? mirrorBase.slice(0, -1) : mirrorBase;
                const searchQuery = cleanBaseTitle || targetTitle || queryWithEp;
                try {
                    let targetPageUrl = '';

                    // 1. Primary approach: Query new6 AJAX lookup.php endpoint
                    try {
                        const lookupUrl = `${cleanBase}/lookup.php?q=${encodeURIComponent(searchQuery)}&page=1&per_page=15`;
                        const lookupRes = await axios.get(lookupUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                                'Referer': `${cleanBase}/?s=${encodeURIComponent(searchQuery)}`,
                                'Accept': 'application/json, text/javascript, */*; q=0.01',
                                'Sec-Fetch-Site': 'same-origin',
                                'Sec-Fetch-Mode': 'cors'
                            },
                            timeout: 4000
                        });

                        const hits = lookupRes.data?.hits;
                        if (Array.isArray(hits) && hits.length > 0) {
                            const bestPermalink = selectBestMovies4uHit(
                                hits,
                                searchQuery,
                                releaseYear,
                                originalTitle,
                                mediaType === 'tv' ? season : undefined,
                                mediaType === 'tv' ? episode : undefined
                            );
                            if (bestPermalink) {
                                targetPageUrl = bestPermalink.startsWith('http')
                                    ? bestPermalink
                                    : `${cleanBase}${bestPermalink.startsWith('/') ? '' : '/'}${bestPermalink}`;
                            }
                        }
                    } catch (lookupErr) {
                        // Lookup failed, fall back to legacy HTML search below
                    }

                    // 2. Fallback approach: Standard HTML search page
                    if (!targetPageUrl) {
                        const searchUrl = `${cleanBase}/?s=${encodeURIComponent(queryWithEp)}`;
                        const searchRes = await axios.get(searchUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                                'Accept': 'text/html,application/xhtml+xml'
                            },
                            timeout: 3500
                        });
                        const searchHtml = String(searchRes.data || '');
                        const postLinks = searchHtml.match(/href=["'](https?:\/\/[^"']*(?:movies4u|new\d+\.movies4u)[^"']*\/[a-zA-Z0-9-]+-(?:full-movie|movie|web-series|season|series)[^"']*)["']/gi)
                            || searchHtml.match(/href=["'](https?:\/\/[^"']*movies4u[^"']*\/[a-zA-Z0-9-]+-full-movie\/)["']/gi)
                            || searchHtml.match(/href=["'](https?:\/\/[^"']+\/[^\/"']+\/)["']/gi) || [];

                        targetPageUrl = selectBestMovies4uPostUrl(postLinks, searchHtml, queryWithEp, releaseYear, originalTitle);
                    }

                    if (targetPageUrl) {
                        const pageRes = await axios.get(targetPageUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                                'Referer': `${cleanBase}/?s=${encodeURIComponent(searchQuery)}`
                            },
                            timeout: 4500
                        });
                        const pageHtml = String(pageRes.data || '');

                        // Extract m4uplay / morencius / vidhide player links
                        const embedMatches: string[] = [];
                        const embedRegex = /href=["'](https?:\/\/(?:[a-zA-Z0-9-]+\.)*(?:vidhide[a-zA-Z0-9]*|streamhide|filelions|m4uplay\.store|morencius\.com|acek-cdn)\/(?:file|embed|e|v)\/([a-zA-Z0-9_-]+))["']/gi;
                        let match: RegExpExecArray | null;
                        while ((match = embedRegex.exec(pageHtml)) !== null) {
                            embedMatches.push(match[1]);
                        }

                        if (embedMatches.length === 0) {
                            const fallbackMatches = pageHtml.match(/https?:\/\/(?:[a-zA-Z0-9-]+\.)*(?:vidhide[a-zA-Z0-9]*|streamhide|filelions|m4uplay\.store|morencius\.com|acek-cdn)\/(?:file|embed|e|v)\/([a-zA-Z0-9_-]+)/gi) || [];
                            embedMatches.push(...fallbackMatches);
                        }

                        if (embedMatches.length > 0) {
                            const rawEmbed = selectBestMovies4uEmbed(embedMatches, pageHtml, mediaType === 'tv' ? episode : undefined, mediaType === 'tv' ? season : undefined);
                            const m3u8Data = await getDirectM3u8FromMorenciusId(rawEmbed, cleanBase);
                            const m4uId = m3u8Data.m4uId || rawEmbed.split('/').pop() || '';
                            const embedUrl = m3u8Data.embedUrl || rawEmbed;
                            const playUrl = m3u8Data.m3u8Url
                                ? `/play.php?url=${encodeURIComponent(m3u8Data.m3u8Url)}&name=${encodeURIComponent(queryWithEp)}&source=consumet.html`
                                : `/play_consumet.php?id=${encodeURIComponent(m4uId)}&name=${encodeURIComponent(queryWithEp)}&type=${mediaType}&s=${season}&e=${episode}&source=consumet.html`;
                            return {
                                ok: true,
                                query: queryWithEp,
                                m4uId,
                                embedUrl,
                                m3u8Url: m3u8Data.m3u8Url || null,
                                playUrl,
                                source: 'movies4u_search'
                            };
                        }
                    }
                } catch(e) {}
                return null;
            });

            const results = await Promise.allSettled(mirrorPromises);
            for (const r of results) {
                if (r.status === 'fulfilled' && r.value && r.value.ok) {
                    return r.value;
                }
            }
            return null;
        }

        // 1st Attempt: with currently active mirror list
        try {
            const firstResult = await attemptMirrorScrape(movies4uActiveMirrors);
            if (firstResult && firstResult.ok) {
                return firstResult;
            }
        } catch(e) {}

        // Fallback / Auto-discovery trigger: Check movies4u.tube first to discover and promote new active mirrors
        try {
            console.log(`[Movies4u Resolver] Current mirrors failed for "${queryWithEp}". Checking ${MOVIES4U_PRIMARY_INDEX_URL} for updated mirrors...`);
            const discovery = await discoverAndPromoteMovies4uMirrors(true);
            if (discovery.mirrors && discovery.mirrors.length > 0) {
                const refreshedResult = await attemptMirrorScrape(discovery.mirrors);
                if (refreshedResult && refreshedResult.ok) {
                    return refreshedResult;
                }
            }
        } catch(e) {}
    }

    // --- TIER 2: High-Availability Multi-Embed Stream Resolution ---
    const idToUse = tmdbId || rawId || '550';
    const fallbackEmbed = mediaType === 'tv'
        ? `https://vidlink.pro/tv/${idToUse}/${season}/${episode}?autoplay=true`
        : `https://vidlink.pro/movie/${idToUse}?autoplay=true`;

    const streamOptions = {
        vidlink: mediaType === 'tv' ? `https://vidlink.pro/tv/${idToUse}/${season}/${episode}?autoplay=true` : `https://vidlink.pro/movie/${idToUse}?autoplay=true`,
        vidrift: mediaType === 'tv' ? `https://embed.vidrift.in/embed/tv/${idToUse}/${season}/${episode}` : `https://embed.vidrift.in/embed/movie/${idToUse}`,
        vidsrc_pm: mediaType === 'tv' ? `https://vidsrc.pm/embed/tv/${idToUse}/${season}/${episode}` : `https://vidsrc.pm/embed/movie/${idToUse}`,
        vidsrc_to: mediaType === 'tv' ? `https://vidsrc.to/embed/tv/${idToUse}/${season}/${episode}` : `https://vidsrc.to/embed/movie/${idToUse}`,
        smashystream: mediaType === 'tv' ? `https://embed.smashystream.com/playere.php?tmdb=${idToUse}&season=${season}&episode=${episode}` : `https://embed.smashystream.com/playere.php?tmdb=${idToUse}`,
        filmu: mediaType === 'tv' ? `https://embed.filmu.in/tv/${idToUse}/${season}/${episode}` : `https://embed.filmu.in/movie/${idToUse}`,
        cinezo: mediaType === 'tv' ? `https://player.cinezo.live/embed/tv/${idToUse}/${season}/${episode}` : `https://player.cinezo.live/embed/movie/${idToUse}`,
        twoembed: mediaType === 'tv' ? `https://www.2embed.cc/embedtv/${idToUse}?s=${season}&e=${episode}` : `https://www.2embed.cc/embed/${idToUse}`,
        vidsrc_in: mediaType === 'tv' ? `https://vidsrc.in/embed/tv/${idToUse}/${season}/${episode}` : `https://vidsrc.in/embed/movie/${idToUse}`
    };

    const playUrl = `/play_consumet.php?id=${encodeURIComponent(idToUse)}&name=${encodeURIComponent(queryWithEp || targetTitle || 'Movie')}&type=${mediaType}&s=${season}&e=${episode}&source=consumet.html`;

    return {
        ok: true,
        query: queryWithEp || targetTitle || 'Movie',
        tmdbId: idToUse,
        m3u8Url: null,
        embedUrl: fallbackEmbed,
        streamOptions,
        playUrl,
        source: 'embed_cluster_master'
    };
}

/**
 * High-Level Scraper function for Movie4U cluster in Bingr Scraper Engine
 */
export async function scrapeMovies4uCluster(params: {
    type?: 'movie' | 'tv';
    id?: number | string;
    title?: string;
    year?: string | number;
    season?: number | string;
    episode?: number | string;
}): Promise<{
    success: boolean;
    serverId: string;
    serverName: string;
    scraperName: string;
    primaryM3u8?: string;
    quality?: string;
    sources: Array<{ url: string; quality: string; type: string; label: string; name: string }>;
    subtitles: Array<{ lang: string; url: string; label?: string }>;
    error?: string;
}> {
    const rawId = params.id ? String(params.id) : '';
    const title = params.title || '';
    const type = params.type || 'movie';
    const season = params.season ? Number(params.season) : 1;
    const episode = params.episode ? Number(params.episode) : 1;

    console.log(`[Movie 4U Cluster] Resolving stream for "${title || rawId}" (${type})...`);

    const res = await resolveMovieHlsStream({
        id: rawId,
        query: title,
        type,
        season,
        episode
    });

    if (res && res.ok) {
        if (res.m3u8Url) {
            const proxiedM3u8 = res.m3u8Url.startsWith('http')
                ? `/live.php?url=${encodeURIComponent(res.m3u8Url)}`
                : res.m3u8Url;

            const sources: Array<{ url: string; quality: string; type: string; label: string; name: string }> = [
                {
                    url: proxiedM3u8,
                    quality: '1080p',
                    type: 'application/x-mpegurl',
                    label: 'Movie 4U (Acek CDN Master)',
                    name: 'Movie 4U 1080p'
                }
            ];

            return {
                success: true,
                serverId: 'm4u',
                serverName: 'Movie 4U (Movies4u / Acek CDN)',
                scraperName: 'Movie 4U',
                primaryM3u8: proxiedM3u8,
                quality: '1080p',
                sources,
                subtitles: []
            };
        } else if (res.embedUrl) {
            return {
                success: true,
                serverId: 'm4u',
                serverName: 'Movie 4U (Movies4u Embed)',
                scraperName: 'Movie 4U',
                primaryM3u8: undefined,
                quality: 'HD',
                sources: [],
                subtitles: []
            };
        }
    }

    throw new Error(`Movie 4U returned no stream for "${title || rawId}"`);
}
