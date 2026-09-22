import axios from 'axios';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const agent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    maxSockets: Infinity,
    maxFreeSockets: 50,
    timeout: 0,
    keepAliveMsecs: 10000
});

export interface TimChannelStream {
    name: string;
    url: string;
    vip?: boolean;
}

export interface TimChannel {
    url: string;
    name: string;
    logo?: string;
    genre?: number;
    flag?: string;
    vip?: boolean;
    viewers?: number;
    streams?: TimChannelStream[];
}

export interface TimLiveEventStream {
    name: string;
    url?: string;
    embedSlug?: string;
    vip?: boolean;
}

export interface TimLiveEvent {
    url: string;
    name: string;
    logo?: string;
    genre?: number;
    sub_genre?: number;
    time?: string | number;
    isevent?: boolean;
    vip?: boolean;
    featured?: boolean;
    viewers?: number;
    category?: string;
    streams: TimLiveEventStream[];
}

export interface TimStreamsCategory {
    category: string;
    events: any[];
}

// In-memory cache for TimStreams channels list (TTL: 5 minutes)
let channelsCache: TimChannel[] = [];
let channelsCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

// In-memory cache for TimStreams live events list (TTL: 2 minutes)
let liveEventsCache: TimLiveEvent[] = [];
let liveEventsCacheTime = 0;
const EVENTS_CACHE_TTL_MS = 2 * 60 * 1000;

// In-memory cache for all streams categories
let allCategoriesCache: TimStreamsCategory[] = [];
let allCategoriesCacheTime = 0;

// Load static fallback if memory cache is empty
function loadFallbackChannels(): TimChannel[] {
    try {
        const fallbackPath = path.join(process.cwd(), 'assets', 'tim_channels.json');
        if (fs.existsSync(fallbackPath)) {
            const data = fs.readFileSync(fallbackPath, 'utf8');
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch (e) {}
    return [];
}

// Load static fallback for live events
function loadFallbackLiveEvents(): TimLiveEvent[] {
    try {
        const fallbackPath = path.join(process.cwd(), 'assets', 'tim_live_events.json');
        if (fs.existsSync(fallbackPath)) {
            const data = fs.readFileSync(fallbackPath, 'utf8');
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                const evCat = parsed.find((c: any) => c.category === 'Events' || c.category === 'Live');
                if (evCat && Array.isArray(evCat.events)) {
                    return evCat.events.map((ev: any) => mapRawTimEvent(ev));
                }
            }
        }
    } catch (e) {}
    return [];
}

export function getSportCategoryName(genre?: number, subGenre?: number, titleOrName?: string): string {
    const text = (titleOrName || '').toLowerCase();

    // 1. Text-based detection from Channel Name / Match Title (Highest Accuracy)
    if (text.includes('cricket') || text.includes('willow') || text.includes('ipl') || text.includes('t20') || text.includes('bcci') || text.includes('astro cricket') || text.includes('star sports 1') || text.includes('star sports hindi')) {
        return 'Cricket';
    }
    if (text.includes('football') || text.includes('soccer') || text.includes('premier league') || text.includes('laliga') || text.includes('serie a') || text.includes('bundesliga') || text.includes('uefa') || text.includes('champions league') || text.includes('chelsea') || text.includes('arsenal') || text.includes('liverpool') || text.includes('madrid') || text.includes('barca') || text.includes('sportdigital') || text.includes('sky sports premier') || text.includes('sky sports football')) {
        return 'Football / Soccer';
    }
    if (text.includes('f1') || text.includes('formula 1') || text.includes('motogp') || text.includes('nascar') || text.includes('indycar') || text.includes('rally') || text.includes('dazn f1') || text.includes('sky sports f1')) {
        return 'Motorsport / F1';
    }
    if (text.includes('tennis') || text.includes('wimbledon') || text.includes('atp') || text.includes('wta') || text.includes('us open') || text.includes('roland garros') || text.includes('tennis channel')) {
        return 'Tennis';
    }
    if (text.includes('ufc') || text.includes('wwe') || text.includes('boxing') || text.includes('mma') || text.includes('smackdown') || text.includes('raw') || text.includes('nxt') || text.includes('fight pass') || text.includes('fight network')) {
        return 'Combat Sports / UFC';
    }
    if (text.includes('nba') || text.includes('basketball') || text.includes('euroleague')) {
        return 'Basketball / NBA';
    }
    if (text.includes('nfl') || text.includes('american football') || text.includes('super bowl') || text.includes('redzone')) {
        return 'American Football / NFL';
    }
    if (text.includes('mlb') || text.includes('baseball')) {
        return 'Baseball / MLB';
    }
    if (text.includes('golf') || text.includes('pga')) {
        return 'Golf / PGA Tour';
    }
    if (text.includes('nhl') || text.includes('ice hockey')) {
        return 'Ice Hockey / NHL';
    }

    // 2. Fallback to API genre IDs
    switch (genre) {
        case 1:
            if (subGenre === 1) return 'Football / Premier League';
            if (subGenre === 3) return 'Football / Bundesliga';
            if (subGenre === 5) return 'Football / Serie A';
            return 'Football / Soccer';
        case 2: return 'Motorsport / F1';
        case 3: return 'Basketball / NBA';
        case 4: return 'Combat Sports / UFC';
        case 5: return 'Tennis';
        case 6: return 'Cricket';
        case 7: return 'Rugby';
        case 8: return 'American Football / NFL';
        case 9: return 'Baseball / MLB';
        case 11: return 'Ice Hockey / NHL';
        default: return 'Live Sports';
    }
}

function mapRawTimEvent(ev: any): TimLiveEvent {
    const streams: TimLiveEventStream[] = (ev.streams || []).map((s: any) => {
        let embedSlug = '';
        if (s.url) {
            const m = s.url.match(/exmxbxe\.cfd\/([a-zA-Z0-9_-]+)/);
            if (m) embedSlug = m[1];
            else embedSlug = s.url.replace(/^https?:\/\/[^\/]+\//, '');
        }
        return {
            name: s.name || 'Stream',
            url: s.url,
            embedSlug: embedSlug || undefined,
            vip: !!s.vip
        };
    });
    const eventName = (ev.name || 'Live Event').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
    return {
        url: ev.url || '',
        name: eventName,
        logo: ev.logo || '',
        genre: ev.genre,
        sub_genre: ev.sub_genre,
        time: ev.time,
        isevent: true,
        vip: !!ev.vip,
        featured: !!ev.featured,
        viewers: ev.viewers || 0,
        category: getSportCategoryName(ev.genre, ev.sub_genre, eventName),
        streams
    };
}

/**
 * Fetch all categories (Events, Replays, 24/7) from https://timst.cfd/api/streams
 */
export async function getAllTimStreams(forceRefresh = false): Promise<TimStreamsCategory[]> {
    const now = Date.now();
    if (!forceRefresh && allCategoriesCache.length > 0 && (now - allCategoriesCacheTime < EVENTS_CACHE_TTL_MS)) {
        return allCategoriesCache;
    }

    try {
        // Optional handshake
        await axios.get('https://timst.cfd/', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
            httpsAgent: agent,
            timeout: 5000
        }).catch(() => {});

        const res = await axios.get('https://timst.cfd/api/streams', {
            headers: {
                'Referer': 'https://timst.cfd/',
                'Origin': 'https://timst.cfd',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            },
            httpsAgent: agent,
            timeout: 9000
        });

        if (Array.isArray(res.data) && res.data.length > 0) {
            allCategoriesCache = res.data;
            allCategoriesCacheTime = now;
            // Also write out cache
            try {
                fs.writeFileSync(path.join(process.cwd(), 'assets', 'tim_live_events.json'), JSON.stringify(res.data, null, 2), 'utf8');
            } catch (e) {}
            return res.data;
        }
    } catch (e: any) {
        console.warn('[TimStreamsService] Failed to fetch /api/streams:', e?.message || e);
    }

    // Fallback to disk cache
    try {
        const fallbackPath = path.join(process.cwd(), 'assets', 'tim_live_events.json');
        if (fs.existsSync(fallbackPath)) {
            const data = fs.readFileSync(fallbackPath, 'utf8');
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed) && parsed.length > 0) {
                allCategoriesCache = parsed;
                allCategoriesCacheTime = now;
                return parsed;
            }
        }
    } catch (e) {}

    return allCategoriesCache;
}

/**
 * Fetch all LIVE EVENTS from TimStreams API (with fallback to assets/tim_live_events.json and top 24/7 sports channels)
 */
export async function getTimLiveEvents(forceRefresh = false): Promise<TimLiveEvent[]> {
    const now = Date.now();
    if (!forceRefresh && liveEventsCache.length > 0 && (now - liveEventsCacheTime < EVENTS_CACHE_TTL_MS)) {
        return liveEventsCache;
    }

    const categories = await getAllTimStreams(forceRefresh);
    const evCat = categories.find((c: any) => c.category === 'Events' || c.category === 'Live');
    let events: TimLiveEvent[] = [];
    if (evCat && Array.isArray(evCat.events) && evCat.events.length > 0) {
        events = evCat.events.map((ev: any) => mapRawTimEvent(ev));
    }

    // NOTE: Do NOT fall back to 24/7 channels here. 24/7 channels are not events —
    // they belong in the Live TV catalog, not Live Now. When no real PPV/live events
    // are available from TimStreams, return empty so other sources (Streamic, ESPN,
    // Sony EPG) are shown cleanly without dummy channel noise.

    if (events.length > 0) {
        liveEventsCache = events;
        liveEventsCacheTime = now;
    }

    return events;
}

// In-memory cache for decoded stream M3U8 URLs (TTL: 1 minute)
const streamUrlCache = new Map<string, { m3u8: string; timestamp: number }>();
const STREAM_CACHE_TTL_MS = 60 * 1000;

/**
 * Invalidate cached stream URL for a given embed or channel
 */
export function invalidateStreamCache(key?: string) {
    if (key) {
        streamUrlCache.delete(key);
    } else {
        streamUrlCache.clear();
    }
}

/**
 * Fetch all available channels and streams from TimStreams API
 */
export async function getTimChannels(forceRefresh = false): Promise<TimChannel[]> {
    const now = Date.now();
    if (!forceRefresh && channelsCache.length > 0 && (now - channelsCacheTime < CACHE_TTL_MS)) {
        return channelsCache;
    }

    try {
        const res = await axios.get('https://timst.cfd/api/channels', {
            headers: {
                'Referer': 'https://timst.cfd/',
                'Origin': 'https://timst.cfd',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            },
            httpsAgent: agent,
            timeout: 9000
        });

        const raw = res.data?.channels || res.data || [];
        if (Array.isArray(raw) && raw.length > 0) {
            channelsCache = raw;
            channelsCacheTime = now;
            return raw;
        }
    } catch (e: any) {
        console.warn('[TimStreamsService] Failed to fetch /api/channels:', e?.message || e);
    }

    // Fallback: try secondary /api/streams endpoint if available
    try {
        const resStreams = await axios.get('https://timst.cfd/api/streams', {
            headers: {
                'Referer': 'https://timst.cfd/',
                'Origin': 'https://timst.cfd',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            },
            httpsAgent: agent,
            timeout: 9000
        });
        let raw: TimChannel[] = [];
        if (Array.isArray(resStreams.data)) {
            const cat247 = resStreams.data.find((c: any) => c.category === '24/7' || c.category === 'Channels');
            if (cat247 && Array.isArray(cat247.events) && cat247.events.length > 0) {
                raw = cat247.events;
            }
        }
        if (raw.length > 0) {
            channelsCache = raw;
            channelsCacheTime = now;
            return raw;
        }
    } catch (e: any) {}

    // Fallback to static assets/tim_channels.json
    if (channelsCache.length === 0) {
        const fallback = loadFallbackChannels();
        if (fallback.length > 0) {
            channelsCache = fallback;
            channelsCacheTime = now;
            return fallback;
        }
    }

    return channelsCache;
}

/**
 * Extract and deobfuscate M3U8 stream from exmxbxe / timst embed HTML
 */
export function extractM3u8FromHtml(html: string): string | null {
    if (!html || typeof html !== 'string') return null;

    // Pattern 1: Deobfuscate array XOR / addition cipher used by exmxbxe.cfd & timst embeds
    const cipherMatch = html.match(/var\s+([a-zA-Z0-9_$]+)\s*=\s*\[([\d,\s]+)\]\s*,\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+)\s*,\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+)/);
    if (cipherMatch) {
        try {
            const arr = cipherMatch[2].split(',').map(n => parseInt(n.trim(), 10));
            const k1 = parseInt(cipherMatch[4], 10);
            const k2 = parseInt(cipherMatch[6], 10);
            let decoded = '';
            for (let i = 0; i < arr.length; i++) {
                decoded += String.fromCharCode(((arr[i] ^ k1) - k2 + 256) & 255);
            }
            const m3u8Match = decoded.match(/https?:\/\/[^\s'"\\]+\.m3u8[^\s'"\\]*/);
            if (m3u8Match) return m3u8Match[0];
        } catch (e) {}
    }

    // Pattern 2: atob base64 encoding
    const atobMatch = html.match(/atob\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (atobMatch) {
        try {
            const decoded = Buffer.from(atobMatch[1], 'base64').toString('utf-8');
            if (decoded.includes('.m3u8')) return decoded;
        } catch (e) {}
    }

    // Pattern 3: standard semicoloned cipher
    const semiMatch = html.match(/var\s+([a-zA-Z0-9_$]+)\s*=\s*\[([\d,]+)\];\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+);\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+);/);
    if (semiMatch) {
        try {
            const arr = semiMatch[2].split(',').map(Number);
            const k1 = parseInt(semiMatch[4], 10);
            const k2 = parseInt(semiMatch[6], 10);
            let decoded = '';
            for (let i = 0; i < arr.length; i++) {
                decoded += String.fromCharCode(((arr[i] ^ k1) - k2 + 256) & 255);
            }
            const m3u8Match = decoded.match(/https?:\/\/[^\s'"\\]+\.m3u8[^\s'"\\]*/);
            if (m3u8Match) return m3u8Match[0];
        } catch (e) {}
    }

    // Pattern 4: Direct M3U8 string match
    const directMatch = html.match(/https?:\/\/[^\s'"\\]+\.m3u8[^\s'"\\]*/);
    return directMatch ? directMatch[0] : null;
}

/**
 * Fallback to native curl sub-process if Cloudflare WAF or TLS fingerprint blocks Node axios
 */
function fetchHtmlViaCurl(url: string, referer: string = 'https://timst.cfd/'): Promise<string | null> {
    return new Promise((resolve) => {
        const safeUrl = url.replace(/(["$`\\])/g, '\\$1');
        const safeReferer = referer.replace(/(["$`\\])/g, '\\$1');
        const cmd = `curl -s -L "${safeUrl}" -H "Referer: ${safeReferer}" -H "Origin: https://timst.cfd" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8" --max-time 7`;
        exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
            if (err || !stdout || stdout.length < 50) return resolve(null);
            resolve(stdout);
        });
    });
}

/**
 * Resolve direct M3U8 URL given an embed URL (e.g. https://exmxbxe.cfd/nhmzkzez-7144)
 */
export async function resolveEmbedUrl(embedUrl: string, forceFresh = false): Promise<string | null> {
    if (!embedUrl || !embedUrl.startsWith('http')) return null;

    if (!forceFresh) {
        const cached = streamUrlCache.get(embedUrl);
        if (cached && (Date.now() - cached.timestamp < STREAM_CACHE_TTL_MS)) {
            return cached.m3u8;
        }
    }

    const browserHeaders = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://timst.cfd/',
        'Origin': 'https://timst.cfd',
        'Sec-Fetch-Dest': 'iframe',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    };

    // Prepare candidates: the URL itself, and fresh randomized cache busters if slug has -xxxx suffix
    const candidates = [embedUrl];
    const slugMatch = embedUrl.match(/https?:\/\/([^\/]+)\/([a-z0-9]{6,12})-(\d+)/i);
    if (slugMatch) {
        const domain = slugMatch[1];
        const baseSlug = slugMatch[2];
        candidates.push(`https://${domain}/${baseSlug}-${Math.floor(Math.random() * 9000 + 1000)}`);
        candidates.push(`https://${domain}/${baseSlug}`);
    }

    for (const urlToTry of candidates) {
        let html: string | null = null;
        try {
            const res = await axios.get(urlToTry, {
                headers: browserHeaders,
                httpsAgent: agent,
                timeout: 7000
            });
            if (res.status === 200 && typeof res.data === 'string') {
                html = res.data;
            }
        } catch (e: any) {
            // If axios failed with 403 or TLS block, fallback to curl
            html = await fetchHtmlViaCurl(urlToTry, 'https://timst.cfd/');
            if (!html && urlToTry.includes('exmxbxe.cfd')) {
                html = await fetchHtmlViaCurl(urlToTry, 'https://timst.cfd/streams');
            }
        }

        if (html) {
            const m3u8 = extractM3u8FromHtml(html);
            if (m3u8 && !m3u8.includes('epidd.hundxvision.co.uk')) {
                streamUrlCache.set(embedUrl, { m3u8, timestamp: Date.now() });
                if (urlToTry !== embedUrl) {
                    streamUrlCache.set(urlToTry, { m3u8, timestamp: Date.now() });
                }
                return m3u8;
            }
        }
    }

    console.info(`[TimStreamsService] Embed stream currently unavailable or ended: ${embedUrl}`);
    return null;
}

// Canonical alias dictionary for channels with regional / prefix variations
const KNOWN_ALIASES: Record<string, string> = {
    // Willow Cricket
    'willow': 'willow-cricket',
    'willow-hd': 'willow-cricket',
    'willow-usa': 'willow-cricket',
    'willowcricket-usa': 'willow-cricket',
    'willowcricket': 'willow-cricket',
    'willow-1': 'willow-cricket',
    '247-willow': 'willow-cricket',
    '247-willow-hd': 'willow-cricket',
    'willow-2': 'willow-cricket-2',
    'willow2': 'willow-cricket-2',
    'willow-2-usa': 'willow-cricket-2',
    'willowcricket2': 'willow-cricket-2',
    '247-willow-2': 'willow-cricket-2',

    // Sky Sports UK
    'sky-sports-cricket': 'sky-sports-cricket',
    'skysportscricket': 'sky-sports-cricket',
    'skysportscricket-uk': 'sky-sports-cricket',
    'sky-sports-premier-league': 'sky-sports-premier-league',
    'skysportspremierleague': 'sky-sports-premier-league',
    'skysportspremierleague-uk': 'sky-sports-premier-league',
    'sky-sports-main-event': 'sky-sports-main-event',
    'skysportsmainevent': 'sky-sports-main-event',
    'skysportsmainevent-uk': 'sky-sports-main-event',
    'sky-sports-football': 'sky-sports-football',
    'skysportsfootball': 'sky-sports-football',
    'skysportsfootball-uk': 'sky-sports-football',
    'sky-sports-f1': 'sky-sports-f1',
    'skysportsf1': 'sky-sports-f1',
    'skysportsf1-uk': 'sky-sports-f1',
    'sky-sports-action': 'sky-sports-action',
    'skysportsaction': 'sky-sports-action',
    'skysportsaction-uk': 'sky-sports-action',
    'sky-sports-golf': 'sky-sports-golf',
    'skysportsgolf': 'sky-sports-golf',
    'skysportsgolf-uk': 'sky-sports-golf',
    'sky-sports-news': 'sky-sports-news',
    'skysportsnews': 'sky-sports-news',
    'skysportsnews-uk': 'sky-sports-news',
    'sky-sports-tennis': 'sky-sports-tennis',
    'skysportstennis': 'sky-sports-tennis',
    'skysportstennis-uk': 'sky-sports-tennis',
    'sky-sports-racing': 'sky-sports-racing',
    'skysportsracing': 'sky-sports-racing',
    'sky-sports-plus': 'sky-sports-plus',
    'skysportsplus': 'sky-sports-plus',
    'sky-sports-mix': 'sky-sports-mix',
    'skysportsmix': 'sky-sports-mix',

    // TNT Sports UK
    'tnt-sports-1': 'tnt-sports-1',
    'tntsports1': 'tnt-sports-1',
    'tntsports1-uk': 'tnt-sports-1',
    'tnt-sports-2': 'tnt-sports-2',
    'tntsports2': 'tnt-sports-2',
    'tntsports2-uk': 'tnt-sports-2',
    'tnt-sports-3': 'tnt-sports-3',
    'tntsports3': 'tnt-sports-3',
    'tntsports3-uk': 'tnt-sports-3',
    'tnt-sports-4': 'tnt-sports-4',
    'tntsports4': 'tnt-sports-4',
    'tntsports4-uk': 'tnt-sports-4',

    // Sony Sports Network
    'sony-sports-1': 'sony-sports-network',
    'sony-sports-network': 'sony-sports-network',
    'sonyten1': 'sony-sports-network',
    'sony-ten-1': 'sony-sports-network',
    'sonyten1-in': 'sony-sports-network',
    'sony-sports-2': 'sony-sports-network-2',
    'sony-sports-network-2': 'sony-sports-network-2',
    'sonyten2': 'sony-sports-network-2',
    'sony-ten-2': 'sony-sports-network-2',
    'sonyten2-in': 'sony-sports-network-2',
    'sony-sports-3': 'sony-sports-network-3',
    'sony-sports-network-3': 'sony-sports-network-3',
    'sonyten3': 'sony-sports-network-3',
    'sony-ten-3': 'sony-sports-network-3',
    'sonyten3-in': 'sony-sports-network-3',
    'sony-sports-4': 'sony-sports-network-4',
    'sony-sports-network-4': 'sony-sports-network-4',
    'sony-six': 'sony-sports-network-4',
    'sonysix': 'sony-sports-network-4',
    'sonysix-in': 'sony-sports-network-4',
    'sony-sports-5': 'sony-sports-network-5',
    'sony-sports-network-5': 'sony-sports-network-5',

    // Fox Sports
    'fox-cricket': 'fox-sports-501-cricket',
    'foxcricket': 'fox-sports-501-cricket',
    'foxcricket-au': 'fox-sports-501-cricket',
    'fox-sports-501': 'fox-sports-501-cricket',
    'fox-sports-1': 'fox-sports-1',
    'fs1': 'fox-sports-1',
    'fs1-usa': 'fox-sports-1',
    'fox-sports-2': 'fox-sports-2',
    'fs2': 'fox-sports-2',
    'fs2-usa': 'fox-sports-2',

    // ESPN
    'espn': 'espn',
    'espn-usa': 'espn',
    'espn-2': 'espn2',
    'espn2': 'espn2',
    'espn2-usa': 'espn2',

    // Eleven Sports
    'eleven-sports-1-poland': 'eleven-sports-1',
    'eleven-sports-2-poland': 'eleven-sports-2',
    'eleven-sports-3-poland': 'eleven-sports-3',
    'eleven-sports-4-poland': 'eleven-sports-4',

    // beIN & DAZN
    'bein-sports-1': 'bein-sports',
    'beinsports-usa': 'bein-sports',
    'dazn-1': 'dazn-1-spain',
    'dazn1-uk': 'dazn-1-spain',
    'ufc-fight-pass': 'ufc-fight-pass-24-7',
    'ufc': 'ufc-fight-pass-24-7'
};

/**
 * Resolve a channel slug or ID (e.g., 'abc', 'cartoon-network', 'tim_abc', 'tim_cartoon-network')
 */
export async function resolveTimChannel(channelSlugOrId: string, forceFresh = false): Promise<string | null> {
    if (!channelSlugOrId) return null;

    // 1. If it is directly an exmxbxe or timst embed URL
    if (channelSlugOrId.startsWith('http://') || channelSlugOrId.startsWith('https://')) {
        if (channelSlugOrId.includes('exmxbxe') || channelSlugOrId.includes('timst')) {
            return await resolveEmbedUrl(channelSlugOrId, forceFresh);
        }
        return channelSlugOrId;
    }

    let cleanSlug = channelSlugOrId
        .replace(/^(tim|embed|embedindia|dlhd|247)[_-]?/i, '')
        .replace(/^channel\//i, '')
        .replace(/^live-tv\//i, '')
        .trim()
        .toLowerCase();

    // Check direct alias dictionary
    if (KNOWN_ALIASES[cleanSlug]) {
        cleanSlug = KNOWN_ALIASES[cleanSlug];
    } else {
        // Strip country code suffixes (-uk, -usa, -us, -in, -au, -za, -pl, -fr, -ie)
        const strippedCountry = cleanSlug.replace(/-(uk|usa|us|in|au|za|pl|fr|ie)$/i, '');
        if (KNOWN_ALIASES[strippedCountry]) {
            cleanSlug = KNOWN_ALIASES[strippedCountry];
        }
    }

    // 2. Fetch or retrieve from cache
    const channels = await getTimChannels();
    
    // Match 1: Exact URL slug match
    let target = channels.find(c => c.url?.toLowerCase() === cleanSlug);

    // Match 2: Normalized alphanumeric slug match (e.g. 'skysportscricket' === 'sky-sports-cricket')
    if (!target) {
        const cleanAlnum = cleanSlug.replace(/[^a-z0-9]/g, '');
        target = channels.find(c => (c.url || '').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanAlnum);
    }

    // Match 3: Channel Name normalized match
    if (!target) {
        const cleanAlnum = cleanSlug.replace(/[^a-z0-9]/g, '');
        target = channels.find(c => (c.name || '').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanAlnum);
    }

    // Match 4: Normalized name with country stripped
    if (!target) {
        const strippedClean = cleanSlug.replace(/(uk|usa|us|in|au|za|pl|fr|ie)$/i, '').replace(/[^a-z0-9]/g, '');
        target = channels.find(c => (c.name || '').toLowerCase().replace(/[^a-z0-9]/g, '') === strippedClean || (c.url || '').toLowerCase().replace(/[^a-z0-9]/g, '') === strippedClean);
    }

    if (target && target.streams && target.streams.length > 0) {
        for (const streamObj of target.streams) {
            if (streamObj.url) {
                const resolved = await resolveEmbedUrl(streamObj.url, forceFresh);
                if (resolved) return resolved;
            }
        }
    }

    // 3. Fallback: Check if cleanSlug is a Live Event from timst.cfd/api/streams
    try {
        const liveEvents = await getTimLiveEvents();
        let matchedEvent = liveEvents.find(e => e.url?.toLowerCase() === cleanSlug);
        if (!matchedEvent) {
            const cleanAlnum = cleanSlug.replace(/[^a-z0-9]/g, '');
            matchedEvent = liveEvents.find(e => 
                (e.url || '').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanAlnum ||
                (e.name || '').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanAlnum
            );
        }
        if (matchedEvent && matchedEvent.streams && matchedEvent.streams.length > 0) {
            for (const st of matchedEvent.streams) {
                if (st.url) {
                    const resolved = await resolveEmbedUrl(st.url, forceFresh);
                    if (resolved) return resolved;
                }
            }
        }
        // Also check if cleanSlug matches any event stream's embedSlug directly
        for (const ev of liveEvents) {
            const matchedStream = ev.streams.find(s => s.embedSlug === cleanSlug);
            if (matchedStream && matchedStream.url) {
                const resolved = await resolveEmbedUrl(matchedStream.url, forceFresh);
                if (resolved) return resolved;
            }
        }
    } catch(e) {}

    // 4. Fallback: Check if cleanSlug is an exmxbxe slug directly (e.g. b3sfc94n-6526 or nhmzkzez-7144)
    if (cleanSlug.match(/^[a-z0-9]{6,12}-\d+$/)) {
        const directEmbed = `https://exmxbxe.cfd/${cleanSlug}`;
        const resolved = await resolveEmbedUrl(directEmbed, forceFresh);
        if (resolved) return resolved;
    }

    return null;
}

