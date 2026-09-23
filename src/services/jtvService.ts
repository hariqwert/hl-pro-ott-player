import axios from 'axios';
import https from 'https';
import { syncZeeChannels } from './zeeChannelsService';
import fs from 'fs';
import path from 'path';

const agent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    timeout: 10000
});

export interface JtvChannel {
    id: string;
    name: string;
    category: string;
    genre: string;
    stream_url: string;
    cookie: string;
    token: string;
    full_stream_url: string;
    manifest_url: string;
    key_id: string;
    key: string;
    clearkey: string;
    logo: string;
    source: 'jtv' | 'sonyliv' | 'hotstar';
}

export interface LiveSportsEvent {
    id: string;
    name: string;
    title: string;
    badge: string;
    quality: string;
    tournament: string;
    group: string;
    logo: string;
    stream_url: string;
    manifest_type: 'mpd' | 'hls';
    clearkey: string;
    key_id: string;
    key: string;
    referrer: string;
    user_agent: string;
    source: 'live_event' | 'cric_live' | 'fancode' | 'primesport' | 'zyphx8' | 'crichd' | 'sport_special';
}

export interface IplReplayMatch {
    id: string;
    title: string;
    matchNumber: string;
    teams: string;
    language: 'ENGLISH' | 'HINDI' | string;
    logo: string;
    stream_url: string;
    proxy_url: string;
}

export interface CategorySummary {
    name: string;
    count: number;
    icon: string;
}

const JTV_CATALOG_URL = 'https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/main/jtv.json';
const LIVE_EVENTS_URL = 'https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/main/LiveEvent.m3u';
const CRIC_LIVE_URL = 'https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/main/CricLive.m3u';
const WILDCARD_COOKIE_URL = 'https://allinonereborn2.online/jstrweb2/cookies.json';
const SPORTLIVE18_COOKIE_URL = 'https://raw.githubusercontent.com/sportlive18/playlist/main/cookie.json';
const SONYLIV_FEED_URL = 'https://raw.githubusercontent.com/sportlive18/Sonyliv-Playlist-Autoupdate/main/sony.m3u';
const HOTSTAR_FEED_URL = 'https://raw.githubusercontent.com/sanju-github24/m3u8-player/main/feeds/hotstar.m3u';
const FANCODE_JSON_URL = 'https://raw.githubusercontent.com/sportlive18/Fancode-New-Auto-Update/main/fancode.json';
const PRIME_VIDEO_JSON_URL = 'https://raw.githubusercontent.com/sportlive18/Willow-Cricbuzz-Prime-Video-Sport-Live-Event-Auto-Updated-Playlist/main/primesport.json';
const IPL_REPLAYS_URL = 'https://raw.githubusercontent.com/sportlive18/playlist/main/Replay/IPL2026.m3u';
const ZYPHX8_FANCODE_M3U = 'https://raw.githubusercontent.com/doctor-8trange/zyphx8/refs/heads/main/data/fancode.m3u';
const ZYPHX8_FANCODE_JSON = 'https://raw.githubusercontent.com/doctor-8trange/zyphx8/refs/heads/main/data/fancode.json';
const CRICHD_LIVE_EVENTS_JSON = 'https://raw.githubusercontent.com/srhady/crichd-speical-live-event/refs/heads/main/Live_Events.json';
const SPORT_M3U_URL = 'https://raw.githubusercontent.com/sportlive18/playlist/main/Sport.m3u';
const ICC_LIVE_URL = 'https://raw.githubusercontent.com/doctor-8trange/nexphi0/refs/heads/main/data/icc.m3u';
const FIFA_LIVE_URL = 'https://raw.githubusercontent.com/srhady/fifaplus/refs/heads/main/fifa_live.m3u';
const TNT_SPORTS_URL = 'https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/main/Tnt.m3u';
const WAVES_M3U_URL = 'https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/main/waves.m3u';
const SONYLIV_EVENTS_JSON = 'https://raw.githubusercontent.com/sportlive18/Sonyliv-Playlist-Autoupdate/main/sonyliv.json';
const SONYLIV_EVENTS_M3U = 'https://raw.githubusercontent.com/sportlive18/Sonyliv-Playlist-Autoupdate/main/sonyliv.m3u';
const DOCTOR_8TRANGE_SONY_M3U = 'https://raw.githubusercontent.com/doctor-8trange/zyphora/main/data/sony.m3u';
const WILLOW_EVENTS_JSON = 'https://raw.githubusercontent.com/sportlive18/Willow-Cricbuzz-Prime-Video-Sport-Live-Event-Auto-Updated-Playlist/main/willow.json';
const WILLOW_EVENTS_M3U = 'https://raw.githubusercontent.com/sportlive18/Willow-Cricbuzz-Prime-Video-Sport-Live-Event-Auto-Updated-Playlist/main/willow.m3u';
const AXSPORTS_M3U = 'https://raw.githubusercontent.com/srhady/axsports/refs/heads/main/playlist.m3u';
const MOVIE_SPOTLIGHT_JSON = 'https://raw.githubusercontent.com/sportlive18/MOVIE-API-AUTO-UPDATE/main/movie.json';
const IPL_HIGHLIGHTS_FANCODE_JSON = 'https://raw.githubusercontent.com/sportlive18/playlist/main/fancode2.json';
const IPL_HIGHLIGHTS_FANCODE3_JSON = 'https://raw.githubusercontent.com/sportlive18/playlist/main/fancode3.json';
const STAR2_SPORTS_JSON = 'https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/refs/heads/main/star2.json';

function isTokenExpired(token: string): boolean {
    if (!token) return true;
    const m = token.match(/exp=(\d+)/);
    if (!m) return false;
    const expSec = parseInt(m[1], 10);
    return (expSec * 1000) <= (Date.now() + 30000);
}

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

let cachedChannels: JtvChannel[] = [];
let lastChannelsFetch = 0;

let cachedEvents: LiveSportsEvent[] = [];
let lastEventsFetch = 0;

let cachedIplReplays: IplReplayMatch[] = [];
let lastIplFetch = 0;

let cachedIplHighlights: IplReplayMatch[] = [];
let lastHighlightsFetch = 0;

let activeWildcardCookie = '';
let lastCookieFetch = 0;
let autoSyncTimer: NodeJS.Timeout | null = null;

export function categorizeChannel(name: string): string {
    const n = (name || '').toLowerCase();
    if (/\b(sport|sports|ten|cricket|euro|dd sports|khel|fancode|willow|golf|nba|wwe|football|kabaddi)\b/i.test(n) ||
        n.includes('sports') || n.includes('ten 1') || n.includes('ten 2') || n.includes('ten 3') || n.includes('ten 4') || n.includes('ten 5') ||
        n.includes('star sports') || n.includes('sony sports')) {
        return 'Sports';
    }
    if (/\b(cinema|movie|movies|star gold|sony max|zee cinema|b4u movies|cineplex|filam|pictures|talkies|box office|action cinema|dhamaal|gold)\b/i.test(n) ||
        n.includes('cinema') || n.includes('movies')) {
        return 'Movies';
    }
    if (/\b(news|aaj tak|ndtv|abp|india today|cnbc|times now|republic|samachar|khabar|tv9|wion|news18|zee news|bharat|dilli|uttar pradesh|bihar|mp)\b/i.test(n) ||
        n.includes('news')) {
        return 'News';
    }
    if (/\b(cartoon|pogo|nick|hungama|disney|sonic|discovery kids|animax|baby|chutti|kochu|junior|cbeebies)\b/i.test(n) ||
        n.includes('kids')) {
        return 'Kids';
    }
    if (/\b(music|mtv|9xm|9x jalwa|zing|b4u music|zoom|mastiii|vh1|song|sangeet|balle balle|mh one|bindass play)\b/i.test(n) ||
        n.includes('music')) {
        return 'Music';
    }
    if (/\b(discovery|nat geo|history|animal planet|tlc|investigation|travel|science|fox life|national geographic)\b/i.test(n)) {
        return 'Infotainment';
    }
    if (/\b(tamil|telugu|kannada|malayalam|bengali|marathi|punjabi|gujarati|bhojpuri|odia|urdu|assamese|bangla|marath|surya|asianet|sun tv|vijay|kalaignar|jaya|polimer|etv|gemini|udaya|tarang|zee bangla|zee marathi|zee telugu|zee tamil|zee kannada|zee sarthak|zee punjabi|star maa|star vijay|star suvarna|star jalsha|star pravah|sun news|kairali|mazhavil|amrita|asianet plus|ptc)\b/i.test(n)) {
        return 'Regional';
    }
    return 'Entertainment';
}

function extractBadgeAndQuality(rawName: string): { name: string; badge: string; quality: string } {
    let cleanName = rawName || '';
    let badge = 'LIVE';
    let quality = 'HD';

    if (/fancode/i.test(cleanName)) badge = 'FANCODE';
    else if (/willow/i.test(cleanName)) badge = 'WILLOW';
    else if (/cricbuzz/i.test(cleanName)) badge = 'CRICBUZZ';
    else if (/cricgo/i.test(cleanName)) badge = 'CRICGO';
    else if (/sony/i.test(cleanName)) badge = 'SONY';
    else if (/star/i.test(cleanName)) badge = 'STAR';

    if (/\bFHD\b/i.test(cleanName) || /1080p/i.test(cleanName)) quality = 'FHD';
    else if (/\bHD\b/i.test(cleanName) || /720p/i.test(cleanName)) quality = 'HD';
    else if (/\bAQ\b/i.test(cleanName)) quality = 'AUTO';
    else if (/\bALT\b/i.test(cleanName)) quality = 'ALT';

    // Format display title
    const parts = cleanName.split(' - ');
    const title = parts[0].trim();

    return { name: title, badge, quality };
}

export class JtvService {
    /**
     * Fetch active wildcard Akamai cookie (__hdnea__ with acl=/*)
     */
    public static async fetchWildcardCookie(force = false): Promise<string> {
        const now = Date.now();
        if (!force && activeWildcardCookie && !isTokenExpired(activeWildcardCookie) && (now - lastCookieFetch < CACHE_TTL_MS)) {
            return activeWildcardCookie;
        }

        try {
            // First check sportlive18 auto-updated cookie.json
            const slRes = await axios.get(SPORTLIVE18_COOKIE_URL, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                httpsAgent: agent,
                timeout: 6000
            });
            if (Array.isArray(slRes.data)) {
                for (const item of slRes.data) {
                    if (item && item.cookie && typeof item.cookie === 'string') {
                        activeWildcardCookie = item.cookie.trim();
                        lastCookieFetch = now;
                        console.log(`[JtvService] Updated wildcard cookie from sportlive18: ${activeWildcardCookie.substring(0, 45)}...`);
                        return activeWildcardCookie;
                    }
                }
            }
        } catch (e: any) {
            // Fallback to secondary endpoint
        }

        try {
            const res = await axios.get(WILDCARD_COOKIE_URL, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                httpsAgent: agent,
                timeout: 8000
            });
            if (Array.isArray(res.data)) {
                for (const item of res.data) {
                    if (item && item.cookie && typeof item.cookie === 'string') {
                        activeWildcardCookie = item.cookie.trim();
                        lastCookieFetch = now;
                        console.log(`[JtvService] Updated wildcard cookie: ${activeWildcardCookie.substring(0, 45)}...`);
                        return activeWildcardCookie;
                    }
                }
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch wildcard cookie from fallback endpoint:', e?.message || e);
        }

        return activeWildcardCookie;
    }

    /**
     * Fetch all channels from JioTV (1,176 ch), SonyLIV Direct CDN (22 ch), and Hotstar (126 ch)
     */
    public static async fetchChannels(force = false): Promise<JtvChannel[]> {
        const now = Date.now();
        if (!force && cachedChannels.length > 0 && (now - lastChannelsFetch < CACHE_TTL_MS)) {
            return cachedChannels;
        }

        const allChannels: JtvChannel[] = [];

        // 1. Fetch JioTV 1,176 Channels
        try {
            const wildcardCookie = await this.fetchWildcardCookie(force);
            const res = await axios.get(JTV_CATALOG_URL, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                httpsAgent: agent,
                timeout: 12000
            });

            if (Array.isArray(res.data) && res.data.length > 0) {
                const jtvChannels = res.data.map((item: any) => {
                    const id = String(item.id || item.channel_id || '').trim();
                    const name = (item.name || item.channel_name || 'TV Channel').trim();
                    const category = categorizeChannel(name);

                    let rawCookie = item.cookie || '';
                    if (!rawCookie || isTokenExpired(rawCookie)) {
                        if (wildcardCookie) {
                            rawCookie = wildcardCookie;
                        }
                    }

                    const token = rawCookie.startsWith('__hdnea__=') ? rawCookie : (rawCookie ? `__hdnea__=${rawCookie}` : '');
                    const streamUrl = item.stream_url || item.channel_url || '';
                    const fullStreamUrl = streamUrl ? (streamUrl + (streamUrl.includes('?') ? '&' : '?') + token) : '';
                    const rawKeyId = String(item.key_id || item.keyId || '').trim();
                    const rawKey = String(item.key || '').trim();
                    const keyId = (rawKeyId !== 'null' && rawKeyId !== 'undefined') ? rawKeyId : '';
                    const key = (rawKey !== 'null' && rawKey !== 'undefined') ? rawKey : '';
                    const manifestUrl = id ? `/api/mdtv/manifest/${id}.mpd` : '';

                    return {
                        id,
                        name,
                        category,
                        genre: category,
                        stream_url: streamUrl,
                        cookie: rawCookie,
                        token,
                        full_stream_url: fullStreamUrl,
                        manifest_url: manifestUrl,
                        key_id: keyId,
                        key,
                        clearkey: (keyId && key) ? `${keyId}:${key}` : '',
                        logo: item.logo || item.channel_logo || '',
                        source: 'jtv' as const
                    };
                });
                allChannels.push(...jtvChannels);
                console.log(`[JtvService] Loaded ${jtvChannels.length} JioTV channels.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch jtv.json catalog:', e?.message || e);
        }

        // 1b. Fetch Star Sports & Sony Sports Dedicated Feed (star2.json) with high-priority channel tokens
        try {
            const star2Res = await axios.get(STAR2_SPORTS_JSON, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                httpsAgent: agent,
                timeout: 8000
            });
            if (Array.isArray(star2Res.data) && star2Res.data.length > 0) {
                let updatedCount = 0;
                let addedCount = 0;
                for (const item of star2Res.data) {
                    const id = String(item.id || '').trim();
                    const name = (item.name || '').trim();
                    if (!id && !name) continue;
                    const rawCookie = item.cookie || '';
                    const token = rawCookie.startsWith('__hdnea__=') ? rawCookie : (rawCookie ? `__hdnea__=${rawCookie}` : '');
                    const streamUrl = item.stream_url || '';
                    const fullStreamUrl = streamUrl ? (streamUrl + (streamUrl.includes('?') ? '&' : '?') + token) : '';
                    const keyId = item.key_id || '';
                    const key = item.key || '';
                    const manifestUrl = id ? `/api/mdtv/manifest/${id}.mpd` : '';

                    const existingIdx = allChannels.findIndex(c => c.id === id || (name && c.name.toLowerCase() === name.toLowerCase()));
                    if (existingIdx !== -1) {
                        allChannels[existingIdx].cookie = rawCookie;
                        allChannels[existingIdx].token = token;
                        allChannels[existingIdx].stream_url = streamUrl || allChannels[existingIdx].stream_url;
                        allChannels[existingIdx].full_stream_url = fullStreamUrl;
                        allChannels[existingIdx].manifest_url = manifestUrl;
                        if (keyId) allChannels[existingIdx].key_id = keyId;
                        if (key) allChannels[existingIdx].key = key;
                        if (keyId && key) allChannels[existingIdx].clearkey = `${keyId}:${key}`;
                        if (item.logo) allChannels[existingIdx].logo = item.logo;
                        updatedCount++;
                    } else {
                        allChannels.push({
                            id,
                            name,
                            category: 'Sports',
                            genre: 'Sports',
                            stream_url: streamUrl,
                            cookie: rawCookie,
                            token,
                            full_stream_url: fullStreamUrl,
                            manifest_url: manifestUrl,
                            key_id: keyId,
                            key,
                            clearkey: (keyId && key) ? `${keyId}:${key}` : '',
                            logo: item.logo || '',
                            source: 'jtv' as const
                        });
                        addedCount++;
                    }
                }
                console.log(`[JtvService] star2.json synced: ${updatedCount} updated, ${addedCount} added.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch star2.json:', e?.message || e);
        }

        // 2. Fetch SonyLIV Direct CDN Channels (22 Channels)
        try {
            const sonyRes = await axios.get(SONYLIV_FEED_URL, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                httpsAgent: agent,
                timeout: 8000
            });
            if (sonyRes.data && typeof sonyRes.data === 'string') {
                const cookieMatch = sonyRes.data.match(/#\s*Cookie:\s*(hdnea=[^\r\n]+)/i);
                const sonyToken = cookieMatch ? cookieMatch[1].trim() : '';
                const lines = sonyRes.data.split('\n');
                let currentCh: Partial<JtvChannel> | null = null;
                let sonyCount = 1;

                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue;
                    if (line.startsWith('#EXTINF:')) {
                        const titleMatch = line.match(/,(.+)$/);
                        const chName = titleMatch ? titleMatch[1].trim() : `Sony Channel ${sonyCount}`;
                        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                        const idMatch = line.match(/tvg-id="([^"]+)"/);

                        currentCh = {
                            id: `sonyliv-${idMatch ? idMatch[1].replace(/[^a-zA-Z0-9_-]/g, '') : sonyCount++}`,
                            name: chName.includes('Sony') || chName.includes('SET') || chName.includes('BBC') ? chName : `${chName} [SonyLIV]`,
                            category: 'SonyLIV',
                            genre: categorizeChannel(chName),
                            stream_url: '',
                            cookie: sonyToken,
                            token: sonyToken,
                            full_stream_url: '',
                            manifest_url: '',
                            key_id: '',
                            key: '',
                            clearkey: '',
                            logo: logoMatch ? logoMatch[1] : 'https://origin-staticv2.sonyliv.com/videoasset_images/manage_file/1000024408/1790022758022512_ENGvsSL26_1odi_landscape_thumb.jpg',
                            source: 'sonyliv' as const
                        };
                    } else if (currentCh && (line.startsWith('http://') || line.startsWith('https://'))) {
                        const directUrl = line;
                        const fullUrl = directUrl + (sonyToken ? (directUrl.includes('?') ? '&' : '?') + sonyToken : '');
                        currentCh.stream_url = directUrl;
                        currentCh.full_stream_url = fullUrl;
                        currentCh.manifest_url = fullUrl;
                        allChannels.push(currentCh as JtvChannel);
                        currentCh = null;
                    }
                }
                console.log(`[JtvService] Loaded ${allChannels.filter(c => c.source === 'sonyliv').length} SonyLIV channels.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch SonyLIV channels:', e?.message || e);
        }

        // 3. Fetch Hotstar Channels (126 Channels)
        try {
            const hotstarRes = await axios.get(HOTSTAR_FEED_URL, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                httpsAgent: agent,
                timeout: 8000
            });
            if (hotstarRes.data && typeof hotstarRes.data === 'string') {
                const lines = hotstarRes.data.split('\n');
                let currentCh: Partial<JtvChannel> | null = null;
                let hotstarCount = 1;

                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue;
                    if (line.startsWith('#EXTINF:')) {
                        const titleMatch = line.match(/,(.+)$/);
                        const chName = titleMatch ? titleMatch[1].trim() : `Hotstar ${hotstarCount}`;
                        const logoMatch = line.match(/tvg-logo="([^"]+)"/);

                        currentCh = {
                            id: `hotstar-${hotstarCount++}`,
                            name: chName,
                            category: 'Hotstar',
                            genre: categorizeChannel(chName),
                            stream_url: '',
                            cookie: '',
                            token: '',
                            full_stream_url: '',
                            manifest_url: '',
                            key_id: '',
                            key: '',
                            clearkey: '',
                            logo: logoMatch ? logoMatch[1] : 'https://img10.hotstar.com/image/upload/sources/r1/cms/prod/2305/1788708712305-h.jpg',
                            source: 'hotstar' as const
                        };
                    } else if (currentCh && line.includes('http-cookie=')) {
                        const m = line.match(/http-cookie=([^\r\n]+)/);
                        if (m) currentCh.token = m[1].trim();
                    } else if (currentCh && (line.startsWith('http://') || line.startsWith('https://'))) {
                        currentCh.stream_url = line;
                        currentCh.full_stream_url = line + (currentCh.token ? (line.includes('?') ? '&' : '?') + currentCh.token : '');
                        currentCh.manifest_url = currentCh.full_stream_url;
                        allChannels.push(currentCh as JtvChannel);
                        currentCh = null;
                    }
                }
                console.log(`[JtvService] Loaded ${allChannels.filter(c => c.source === 'hotstar').length} Hotstar channels.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch Hotstar channels:', e?.message || e);
        }

        // 4. Ingest Zee Network Channels (Cloudfront Broadpeak origin with ClearKey DRM)
        try {
            const zeeChs = await syncZeeChannels();
            for (const z of zeeChs) {
                allChannels.push({
                    id: z.id,
                    name: z.name,
                    category: z.genre,
                    genre: z.genre,
                    stream_url: z.manifestUrl,
                    cookie: '',
                    token: '',
                    full_stream_url: z.manifestUrl,
                    manifest_url: z.manifestUrl,
                    key_id: z.keyId,
                    key: z.key,
                    clearkey: z.licenseKey,
                    logo: z.logo,
                    source: 'jtv' as const
                });
            }
            console.log(`[JtvService] Loaded ${zeeChs.length} Zee Network channels.`);
        } catch (e: any) {
            console.warn('[JtvService] Failed to load Zee channels:', e?.message || e);
        }

        cachedChannels = allChannels;
        lastChannelsFetch = now;
        console.log(`[JtvService] Total channels ready: ${cachedChannels.length}`);
        return cachedChannels;
    }

    /**
     * Fetch all live sports match events (FanCode, Willow Cricbuzz, Prime Video Sports)
     */
    public static async fetchLiveEvents(force = false): Promise<LiveSportsEvent[]> {
        const now = Date.now();
        if (!force && cachedEvents.length > 0 && (now - lastEventsFetch < CACHE_TTL_MS)) {
            return cachedEvents;
        }

        const events: LiveSportsEvent[] = [];
        let eventCounter = 1;

        // 1. Fetch LiveEvent.m3u (217 matches)
        try {
            const res = await axios.get(LIVE_EVENTS_URL, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                httpsAgent: agent,
                timeout: 10000
            });
            if (res.data && typeof res.data === 'string') {
                const lines = res.data.split('\n');
                let current: Partial<LiveSportsEvent> | null = null;

                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue;

                    if (line.startsWith('#EXTINF:')) {
                        if (current && current.stream_url) {
                            events.push(current as LiveSportsEvent);
                        }

                        const titleMatch = line.match(/,(.+)$/);
                        const rawTitle = titleMatch ? titleMatch[1].trim() : 'Live Match Event';
                        const { name, badge, quality } = extractBadgeAndQuality(rawTitle);

                        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                        const groupMatch = line.match(/group-title="([^"]+)"/);

                        current = {
                            id: `live-event-${eventCounter++}`,
                            name,
                            title: rawTitle,
                            badge,
                            quality,
                            tournament: groupMatch ? groupMatch[1] : 'Live Sports',
                            group: groupMatch ? groupMatch[1] : 'Cricket',
                            logo: logoMatch ? logoMatch[1] : '',
                            stream_url: '',
                            manifest_type: 'mpd',
                            clearkey: '',
                            key_id: '',
                            key: '',
                            referrer: '',
                            user_agent: '',
                            source: 'live_event'
                        };
                    } else if (current) {
                        if (line.includes('manifest_type=mpd')) {
                            current.manifest_type = 'mpd';
                        } else if (line.includes('manifest_type=hls')) {
                            current.manifest_type = 'hls';
                        } else if (line.includes('license_key=')) {
                            const m = line.match(/license_key=([a-fA-F0-9:]+)/);
                            if (m) {
                                current.clearkey = m[1].trim();
                                const parts = current.clearkey.split(':');
                                if (parts.length === 2) {
                                    current.key_id = parts[0];
                                    current.key = parts[1];
                                }
                            }
                        } else if (line.includes('http-referrer=')) {
                            const m = line.match(/http-referrer=([^\s]+)/);
                            if (m) current.referrer = m[1].trim();
                        } else if (line.includes('http-user-agent=')) {
                            const m = line.match(/http-user-agent=([^\r\n]+)/);
                            if (m) current.user_agent = m[1].trim();
                        } else if (line.startsWith('http://') || line.startsWith('https://')) {
                            current.stream_url = line;
                            events.push(current as LiveSportsEvent);
                            current = null;
                        }
                    }
                }
                if (current && current.stream_url) {
                    events.push(current as LiveSportsEvent);
                }
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch LiveEvent.m3u:', e?.message || e);
        }

        // 2. Fetch FanCode JSON feeds (fancode.json)
        try {
            const fcRes = await axios.get(FANCODE_JSON_URL, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                httpsAgent: agent,
                timeout: 8000
            });
            if (fcRes.data && Array.isArray(fcRes.data.matches)) {
                for (const m of fcRes.data.matches) {
                    let streamUrl = '';
                    if (m.akamai_m3u8_hex) {
                        try {
                            const decoded = Buffer.from(m.akamai_m3u8_hex, 'hex').toString('utf8');
                            const lines = decoded.split('\n');
                            // Find highest resolution variant or master URL
                            const urls = lines.filter((l: string) => l.startsWith('https://'));
                            streamUrl = urls[urls.length - 1] || urls[0] || '';
                        } catch (e) {}
                    }
                    if (!streamUrl && m.stream_url) streamUrl = m.stream_url;

                    if (streamUrl) {
                        events.push({
                            id: `fancode-live-${eventCounter++}`,
                            name: m.match_name || 'FanCode Live Match',
                            title: `${m.event_name ? m.event_name + ' - ' : ''}${m.match_name || 'FanCode Match'}`,
                            badge: 'FANCODE',
                            quality: 'FHD',
                            tournament: m.event_name || 'FanCode Sports',
                            group: 'Cricket',
                            logo: m.src || 'https://www.fancode.com/skillup-uploads/cms-media/fancode_logo.png',
                            stream_url: streamUrl,
                            manifest_type: 'hls',
                            clearkey: '',
                            key_id: '',
                            key: '',
                            referrer: 'https://fancode.com/',
                            user_agent: 'ReactNativeVideo/9.7.0 (Linux;Android 10) AndroidXMedia3/1.6.1',
                            source: 'fancode'
                        });
                    }
                }
                console.log(`[JtvService] Added FanCode direct match feeds.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch fancode.json:', e?.message || e);
        }

        // 3. Fetch Prime Video Sports Matches (primesport.json)
        try {
            const primeRes = await axios.get(PRIME_VIDEO_JSON_URL, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                httpsAgent: agent,
                timeout: 8000
            });
            if (primeRes.data && Array.isArray(primeRes.data.Matches)) {
                for (const pm of primeRes.data.Matches) {
                    const streamUrls = pm.stream_url || {};
                    const targetStream = streamUrls['Amazon Server'] || streamUrls['Fastly Server'] || Object.values(streamUrls)[0] as string || '';
                    if (targetStream) {
                        const drmKey = pm.drm_key || '';
                        const parts = drmKey.split(':');
                        events.push({
                            id: `prime-live-${eventCounter++}`,
                            name: pm.title || 'Prime Video Sport',
                            title: `${pm.title} - ${pm.synopsis || 'Live on Prime'}`,
                            badge: 'PRIME',
                            quality: 'FHD',
                            tournament: 'Prime Video Sports',
                            group: 'Sports',
                            logo: pm.cover_image || 'https://images-na.ssl-images-amazon.com/images/G/01/digital/video/merch/subs/benefit-id/a-f/freewithads/logos/channels-logo-white.png',
                            stream_url: targetStream,
                            manifest_type: 'mpd',
                            clearkey: drmKey,
                            key_id: parts[0] || '',
                            key: parts[1] || '',
                            referrer: 'https://www.amazon.com/',
                            user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                            source: 'primesport'
                        });
                    }
                }
                console.log(`[JtvService] Added Prime Video Sports matches.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch primesport.json:', e?.message || e);
        }

        // 4. Fetch CricLive.m3u
        try {
            const res = await axios.get(CRIC_LIVE_URL, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                httpsAgent: agent,
                timeout: 8000
            });
            if (res.data && typeof res.data === 'string') {
                const lines = res.data.split('\n');
                let current: Partial<LiveSportsEvent> | null = null;

                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue;

                    if (line.startsWith('#EXTINF:')) {
                        if (current && current.stream_url) {
                            events.push(current as LiveSportsEvent);
                        }

                        const titleMatch = line.match(/,(.+)$/);
                        const rawTitle = titleMatch ? titleMatch[1].trim() : 'Live Cricket';
                        const { name, badge, quality } = extractBadgeAndQuality(rawTitle);

                        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                        const groupMatch = line.match(/group-title="([^"]+)"/);

                        current = {
                            id: `cric-event-${eventCounter++}`,
                            name,
                            title: rawTitle,
                            badge: badge === 'LIVE' ? 'CRICLIVE' : badge,
                            quality,
                            tournament: groupMatch ? groupMatch[1] : 'Cricket Series',
                            group: 'Cricket',
                            logo: logoMatch ? logoMatch[1] : '',
                            stream_url: '',
                            manifest_type: 'hls',
                            clearkey: '',
                            key_id: '',
                            key: '',
                            referrer: '',
                            user_agent: '',
                            source: 'cric_live'
                        };
                    } else if (current) {
                        if (line.includes('license_key=')) {
                            const m = line.match(/license_key=([a-fA-F0-9:]+)/);
                            if (m) {
                                current.clearkey = m[1].trim();
                                const parts = current.clearkey.split(':');
                                if (parts.length === 2) {
                                    current.key_id = parts[0];
                                    current.key = parts[1];
                                }
                            }
                        } else if (line.includes('http-referrer=')) {
                            const m = line.match(/http-referrer=([^\s]+)/);
                            if (m) current.referrer = m[1].trim();
                        } else if (line.includes('http-user-agent=')) {
                            const m = line.match(/http-user-agent=([^\r\n]+)/);
                            if (m) current.user_agent = m[1].trim();
                        } else if (line.startsWith('http://') || line.startsWith('https://')) {
                            current.stream_url = line;
                            events.push(current as LiveSportsEvent);
                            current = null;
                        }
                    }
                }
                if (current && current.stream_url) {
                    events.push(current as LiveSportsEvent);
                }
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch CricLive.m3u:', e?.message || e);
        }

        // 5. Fetch doctor-8trange / zyphx8 FanCode M3U (Direct DAI HLS Streams)
        try {
            const zRes = await axios.get(ZYPHX8_FANCODE_M3U, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                httpsAgent: agent,
                timeout: 8000
            });
            if (zRes.data && typeof zRes.data === 'string') {
                const lines = zRes.data.split('\n');
                let current: Partial<LiveSportsEvent> | null = null;
                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue;
                    if (line.startsWith('#EXTINF:')) {
                        if (current && current.stream_url) events.push(current as LiveSportsEvent);
                        const titleMatch = line.match(/,(.+)$/);
                        const rawTitle = titleMatch ? titleMatch[1].trim() : 'FanCode Live Match';
                        const { name, badge, quality } = extractBadgeAndQuality(rawTitle);
                        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                        const groupMatch = line.match(/group-title="([^"]+)"/);
                        current = {
                            id: `zyphx8-fc-${eventCounter++}`,
                            name,
                            title: rawTitle,
                            badge: 'FANCODE',
                            quality: 'FHD',
                            tournament: groupMatch ? groupMatch[1] : 'FanCode Sports',
                            group: 'Cricket',
                            logo: logoMatch ? logoMatch[1] : 'https://www.fancode.com/skillup-uploads/cms-media/FC_Sports_Default_cricket.jpg',
                            stream_url: '',
                            manifest_type: 'hls',
                            clearkey: '',
                            key_id: '',
                            key: '',
                            referrer: 'https://fancode.com/',
                            user_agent: 'ReactNativeVideo/9.11.1 (Linux;Android 13) AndroidXMedia3/1.6.1',
                            source: 'zyphx8'
                        };
                    } else if (current && (line.startsWith('http://') || line.startsWith('https://'))) {
                        const parts = line.split('|');
                        current.stream_url = parts[0].trim();
                        events.push(current as LiveSportsEvent);
                        current = null;
                    }
                }
                if (current && current.stream_url) events.push(current as LiveSportsEvent);
                console.log(`[JtvService] Loaded doctor-8trange/zyphx8 FanCode M3U streams.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch zyphx8 fancode.m3u:', e?.message || e);
        }

        // 6. Fetch doctor-8trange / zyphx8 FanCode JSON (Matches with Multi-bitrate & Score Data)
        try {
            const zJsonRes = await axios.get(ZYPHX8_FANCODE_JSON, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                httpsAgent: agent,
                timeout: 8000
            });
            if (zJsonRes.data && Array.isArray(zJsonRes.data.matches)) {
                for (const m of zJsonRes.data.matches) {
                    const primaryUrl = m.STREAMING_CDN?.Primary_Playback_URL || m.STREAMING_CDN?.fancode_cdn;
                    if (primaryUrl && (m.status === 'LIVE' || m.streamingStatus === 'STARTED')) {
                        const matchTitle = m.title || `${m.team?.[0]?.name || 'Team 1'} vs ${m.team?.[1]?.name || 'Team 2'}`;
                        const logo = m.image || m.image_cdn?.APP || m.image_cdn?.TATAPLAY || 'https://www.fancode.com/skillup-uploads/cms-media/FC_Sports_Default_cricket.jpg';
                        events.push({
                            id: `zyphx8-json-${m.match_id || eventCounter++}`,
                            name: matchTitle,
                            title: matchTitle,
                            badge: 'FANCODE',
                            quality: '1080p',
                            tournament: m.tournament || 'FanCode Live',
                            group: m.category || 'Cricket',
                            logo,
                            stream_url: primaryUrl,
                            manifest_type: 'hls',
                            clearkey: '',
                            key_id: '',
                            key: '',
                            referrer: 'https://fancode.com/',
                            user_agent: 'ReactNativeVideo/9.11.1 (Linux;Android 13) AndroidXMedia3/1.6.1',
                            source: 'zyphx8'
                        });
                    }
                }
                console.log(`[JtvService] Loaded doctor-8trange/zyphx8 FanCode JSON matches.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch zyphx8 fancode.json:', e?.message || e);
        }

        // 7. Fetch crichd-special-live-event (Willow, Star Sports, Fox Cricket Match Events)
        try {
            const chRes = await axios.get(CRICHD_LIVE_EVENTS_JSON, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                httpsAgent: agent,
                timeout: 8000
            });
            if (chRes.data && Array.isArray(chRes.data.matches)) {
                for (const m of chRes.data.matches) {
                    const matchName = m['match name'] || m['Tour/Group name'] || 'Cricket Live';
                    const channels = Array.isArray(m.Channels) ? m.Channels : [];
                    for (const ch of channels) {
                        const stream = ch['Stream link'] || ch['Embed link'];
                        if (stream) {
                            events.push({
                                id: `crichd-${eventCounter++}`,
                                name: `${matchName} (${ch['Channel name'] || 'Live'})`,
                                title: `${matchName} - ${ch['Channel name'] || 'Cricket'}`,
                                badge: 'CRICHD',
                                quality: 'HD',
                                tournament: m['Tour/Group name'] || 'Live Cricket Event',
                                group: 'Cricket',
                                logo: 'https://cdn.iconscout.com/icon/free/png-256/free-cricket-ball-1817208-1538072.png',
                                stream_url: stream,
                                manifest_type: 'hls',
                                clearkey: '',
                                key_id: '',
                                key: '',
                                referrer: m.referer || 'https://player0003.com/',
                                user_agent: m['User agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                                source: 'crichd'
                            });
                        }
                    }
                }
                console.log(`[JtvService] Loaded crichd special live match events.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch crichd live events:', e?.message || e);
        }

        // 8. Fetch sportlive18 Sport.m3u (F1 TV, MotoGP & Motorsport ClearKey MPD)
        try {
            const sRes = await axios.get(SPORT_M3U_URL, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                httpsAgent: agent,
                timeout: 8000
            });
            if (sRes.data && typeof sRes.data === 'string') {
                const lines = sRes.data.split('\n');
                let current: Partial<LiveSportsEvent> | null = null;
                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue;
                    if (line.startsWith('#EXTINF:')) {
                        if (current && current.stream_url) events.push(current as LiveSportsEvent);
                        const titleMatch = line.match(/,(.+)$/);
                        const title = titleMatch ? titleMatch[1].trim() : 'Motorsport Channel';
                        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                        const groupMatch = line.match(/group-title="([^"]+)"/);
                        current = {
                            id: `sport-special-${eventCounter++}`,
                            name: title,
                            title,
                            badge: title.includes('F1') ? 'F1' : (title.includes('Moto') ? 'MOTOGP' : 'SPORTS'),
                            quality: '1080p',
                            tournament: groupMatch ? groupMatch[1] : 'Motorsport Network',
                            group: 'Motorsport',
                            logo: logoMatch ? logoMatch[1] : '',
                            stream_url: '',
                            manifest_type: 'mpd',
                            clearkey: '',
                            key_id: '',
                            key: '',
                            referrer: '',
                            user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                            source: 'sport_special'
                        };
                    } else if (current) {
                        if (line.includes('license_key=')) {
                            const m = line.match(/license_key=([a-fA-F0-9:]+)/);
                            if (m) {
                                current.clearkey = m[1].trim();
                                const parts = current.clearkey.split(':');
                                if (parts.length === 2) {
                                    current.key_id = parts[0];
                                    current.key = parts[1];
                                }
                            }
                        } else if (line.startsWith('http://') || line.startsWith('https://')) {
                            current.stream_url = line;
                            if (line.endsWith('.m3u8')) current.manifest_type = 'hls';
                            events.push(current as LiveSportsEvent);
                            current = null;
                        }
                    }
                }
                if (current && current.stream_url) events.push(current as LiveSportsEvent);
                console.log(`[JtvService] Loaded sportlive18 Sport.m3u motorsports.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch Sport.m3u:', e?.message || e);
        }

        // 9. Fetch doctor-8trange ICC Cricket Live Events
        try {
            const iccRes = await axios.get(ICC_LIVE_URL, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                httpsAgent: agent,
                timeout: 8000
            });
            if (iccRes.data && typeof iccRes.data === 'string') {
                const lines = iccRes.data.split('\n');
                let current: Partial<LiveSportsEvent> | null = null;
                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue;
                    if (line.startsWith('#EXTINF:')) {
                        if (current && current.stream_url) events.push(current as LiveSportsEvent);
                        const titleMatch = line.match(/,(.+)$/);
                        const title = titleMatch ? titleMatch[1].trim() : 'ICC Live Match';
                        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                        current = {
                            id: `icc-${eventCounter++}`,
                            name: title,
                            title,
                            badge: 'ICC',
                            quality: 'FHD',
                            tournament: 'ICC Cricket Tournament',
                            group: 'Cricket',
                            logo: logoMatch ? logoMatch[1] : 'https://images.icc-cricket.com/image/upload/t_ratio16_9-size20/prd/vcjle3i0ksxxnbdkeqpq',
                            stream_url: '',
                            manifest_type: 'mpd',
                            clearkey: '',
                            key_id: '',
                            key: '',
                            referrer: '',
                            user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                            source: 'sport_special'
                        };
                    } else if (current) {
                        if (line.includes('license_key=')) {
                            const m = line.match(/license_key=([a-fA-F0-9:]+)/);
                            if (m) {
                                current.clearkey = m[1].trim();
                                const parts = current.clearkey.split(':');
                                if (parts.length === 2) {
                                    current.key_id = parts[0];
                                    current.key = parts[1];
                                }
                            }
                        } else if (line.startsWith('http://') || line.startsWith('https://')) {
                            current.stream_url = line;
                            events.push(current as LiveSportsEvent);
                            current = null;
                        }
                    }
                }
                if (current && current.stream_url) events.push(current as LiveSportsEvent);
                console.log(`[JtvService] Loaded ICC Cricket Live events.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch ICC events:', e?.message || e);
        }

        // 10. Fetch FIFA Plus Live Events
        try {
            const fifaRes = await axios.get(FIFA_LIVE_URL, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                httpsAgent: agent,
                timeout: 8000
            });
            if (fifaRes.data && typeof fifaRes.data === 'string') {
                const lines = fifaRes.data.split('\n');
                let current: Partial<LiveSportsEvent> | null = null;
                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue;
                    if (line.startsWith('#EXTINF:')) {
                        if (current && current.stream_url) events.push(current as LiveSportsEvent);
                        const titleMatch = line.match(/,(.+)$/);
                        const title = titleMatch ? titleMatch[1].trim() : 'FIFA Plus Event';
                        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                        current = {
                            id: `fifa-${eventCounter++}`,
                            name: title,
                            title,
                            badge: 'FIFA',
                            quality: 'HD',
                            tournament: 'FIFA Football',
                            group: 'Football',
                            logo: logoMatch ? logoMatch[1] : 'https://www.fifa.com/favicon.ico',
                            stream_url: '',
                            manifest_type: 'hls',
                            clearkey: '',
                            key_id: '',
                            key: '',
                            referrer: '',
                            user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                            source: 'sport_special'
                        };
                    } else if (current && (line.startsWith('http://') || line.startsWith('https://'))) {
                        current.stream_url = line;
                        events.push(current as LiveSportsEvent);
                        current = null;
                    }
                }
                if (current && current.stream_url) events.push(current as LiveSportsEvent);
                console.log(`[JtvService] Loaded FIFA Plus live events.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch FIFA Plus events:', e?.message || e);
        }

        // 11. Fetch TNT Sports Network
        try {
            const tntRes = await axios.get(TNT_SPORTS_URL, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                httpsAgent: agent,
                timeout: 8000
            });
            if (tntRes.data && typeof tntRes.data === 'string') {
                const lines = tntRes.data.split('\n');
                let current: Partial<LiveSportsEvent> | null = null;
                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue;
                    if (line.startsWith('#EXTINF:')) {
                        if (current && current.stream_url) events.push(current as LiveSportsEvent);
                        const titleMatch = line.match(/,(.+)$/);
                        const title = titleMatch ? titleMatch[1].trim() : 'TNT Sports Channel';
                        current = {
                            id: `tnt-${eventCounter++}`,
                            name: title,
                            title,
                            badge: 'TNT',
                            quality: '1080p',
                            tournament: 'TNT Sports UK',
                            group: 'Football',
                            logo: 'https://images.ctfassets.net/pjshm78m9jt4/5K1q7oO43KmgUecmIeSmc6/1b12b509d784a0d9e96e0004ff25f694/TNT_Sports_Logo.png',
                            stream_url: '',
                            manifest_type: 'mpd',
                            clearkey: '',
                            key_id: '',
                            key: '',
                            referrer: '',
                            user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                            source: 'sport_special'
                        };
                    } else if (current) {
                        if (line.includes('license_key=')) {
                            const m = line.match(/license_key=([a-fA-F0-9:]+)/);
                            if (m) {
                                current.clearkey = m[1].trim();
                                const parts = current.clearkey.split(':');
                                if (parts.length === 2) {
                                    current.key_id = parts[0];
                                    current.key = parts[1];
                                }
                            }
                        } else if (line.startsWith('http://') || line.startsWith('https://')) {
                            current.stream_url = line;
                            events.push(current as LiveSportsEvent);
                            current = null;
                        }
                    }
                }
                if (current && current.stream_url) events.push(current as LiveSportsEvent);
                console.log(`[JtvService] Loaded TNT Sports Network channels.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch TNT Sports:', e?.message || e);
        }

        // 12. Fetch sportlive18 SonyLIV Live Events (sonyliv.m3u & sonyliv.json)
        try {
            const slRes = await axios.get(SONYLIV_EVENTS_M3U, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                httpsAgent: agent,
                timeout: 8000
            });
            if (slRes.data && typeof slRes.data === 'string') {
                const lines = slRes.data.split('\n');
                let current: Partial<LiveSportsEvent> | null = null;
                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue;
                    if (line.startsWith('#EXTINF:')) {
                        if (current && current.stream_url) events.push(current as LiveSportsEvent);
                        const titleMatch = line.match(/,(.+)$/);
                        const rawTitle = titleMatch ? titleMatch[1].trim() : 'SonyLIV Live Event';
                        const { name, badge, quality } = extractBadgeAndQuality(rawTitle);
                        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                        const groupMatch = line.match(/group-title="([^"]+)"/);
                        current = {
                            id: `sonyliv-ev-${eventCounter++}`,
                            name,
                            title: rawTitle,
                            badge: 'SONYLIV',
                            quality,
                            tournament: groupMatch ? groupMatch[1] : 'SonyLIV Sports',
                            group: 'Sports',
                            logo: logoMatch ? logoMatch[1] : 'https://origin-staticv2.sonyliv.com/videoasset_images/manage_file/1000024408/1790022758022512_ENGvsSL26_1odi_landscape_thumb.jpg',
                            stream_url: '',
                            manifest_type: 'hls',
                            clearkey: '',
                            key_id: '',
                            key: '',
                            referrer: 'https://www.sonyliv.com/',
                            user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:155.0) Gecko/20100101 Firefox/155.0',
                            source: 'sport_special'
                        };
                    } else if (current && (line.startsWith('http://') || line.startsWith('https://'))) {
                        current.stream_url = line;
                        events.push(current as LiveSportsEvent);
                        current = null;
                    }
                }
                if (current && current.stream_url) events.push(current as LiveSportsEvent);
                console.log(`[JtvService] Loaded sportlive18 SonyLIV live events.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch SonyLIV events:', e?.message || e);
        }

        // 13. Fetch doctor-8trange / zyphora SonyLIV (Cloudflare Pages edge proxied)
        try {
            const zSonyRes = await axios.get(DOCTOR_8TRANGE_SONY_M3U, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                httpsAgent: agent,
                timeout: 8000
            });
            if (zSonyRes.data && typeof zSonyRes.data === 'string') {
                const lines = zSonyRes.data.split('\n');
                let current: Partial<LiveSportsEvent> | null = null;
                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue;
                    if (line.startsWith('#EXTINF:')) {
                        if (current && current.stream_url) events.push(current as LiveSportsEvent);
                        const titleMatch = line.match(/,(.+)$/);
                        const rawTitle = titleMatch ? titleMatch[1].trim() : 'Sony Sports Live';
                        const { name, badge, quality } = extractBadgeAndQuality(rawTitle);
                        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                        const groupMatch = line.match(/group-title="([^"]+)"/);
                        current = {
                            id: `zyphora-sony-${eventCounter++}`,
                            name,
                            title: rawTitle,
                            badge: 'SONY',
                            quality: '1080p',
                            tournament: groupMatch ? groupMatch[1] : 'Sony Sports Network',
                            group: 'Sports',
                            logo: logoMatch ? logoMatch[1] : 'https://origin-staticv2.sonyliv.com/videoasset_images/manage_file/1000024234/1789852034881646_AG26_Stream1_generic_landscape_thumb.jpg',
                            stream_url: '',
                            manifest_type: 'hls',
                            clearkey: '',
                            key_id: '',
                            key: '',
                            referrer: 'https://www.sonyliv.com/',
                            user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:155.0) Gecko/20100101 Firefox/155.0',
                            source: 'zyphx8'
                        };
                    } else if (current && (line.startsWith('http://') || line.startsWith('https://'))) {
                        current.stream_url = line;
                        events.push(current as LiveSportsEvent);
                        current = null;
                    }
                }
                if (current && current.stream_url) events.push(current as LiveSportsEvent);
                console.log(`[JtvService] Loaded doctor-8trange/zyphora Sony streams.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch zyphora sony.m3u:', e?.message || e);
        }

        // 14. Fetch sportlive18 Willow Cricket Event Info (willow.m3u & willow.json)
        try {
            const wRes = await axios.get(WILLOW_EVENTS_JSON, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                httpsAgent: agent,
                timeout: 8000
            });
            if (wRes.data && Array.isArray(wRes.data.Matches)) {
                for (const wm of wRes.data.Matches) {
                    if (wm.status === 'LIVE' || wm.stream_url) {
                        const targetStream = typeof wm.stream_url === 'string' ? wm.stream_url : (wm.stream_url ? Object.values(wm.stream_url)[0] as string : '');
                        if (targetStream) {
                            events.push({
                                id: `willow-ev-${wm.match_id || eventCounter++}`,
                                name: wm.title || 'Willow Cricket',
                                title: wm.synopsis || wm.title || 'Willow Cricket Live',
                                badge: 'WILLOW',
                                quality: 'HD',
                                tournament: 'Willow Cricket',
                                group: 'Cricket',
                                logo: wm.cover_image || 'https://www.willow.tv/images/willow-logo.png',
                                stream_url: targetStream,
                                manifest_type: targetStream.includes('.mpd') ? 'mpd' : 'hls',
                                clearkey: wm.drm_key || '',
                                key_id: wm.drm_key ? wm.drm_key.split(':')[0] : '',
                                key: wm.drm_key ? wm.drm_key.split(':')[1] : '',
                                referrer: 'https://www.willow.tv/',
                                user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                                source: 'sport_special'
                            });
                        }
                    }
                }
                console.log(`[JtvService] Loaded Willow cricket matches.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch willow.json:', e?.message || e);
        }

        // 15. Fetch AXSports Live Sports Playlist
        try {
            const axRes = await axios.get(AXSPORTS_M3U, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                httpsAgent: agent,
                timeout: 8000
            });
            if (axRes.data && typeof axRes.data === 'string') {
                const lines = axRes.data.split('\n');
                let current: Partial<LiveSportsEvent> | null = null;
                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue;
                    if (line.startsWith('#EXTINF:')) {
                        if (current && current.stream_url) events.push(current as LiveSportsEvent);
                        const titleMatch = line.match(/,(.+)$/);
                        const rawTitle = titleMatch ? titleMatch[1].trim() : 'AXSports Channel';
                        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                        const groupMatch = line.match(/group-title="([^"]+)"/);
                        current = {
                            id: `axsports-${eventCounter++}`,
                            name: rawTitle,
                            title: rawTitle,
                            badge: 'AXSPORTS',
                            quality: 'HD',
                            tournament: groupMatch ? groupMatch[1] : 'AXSports Network',
                            group: 'Sports',
                            logo: logoMatch ? logoMatch[1] : '',
                            stream_url: '',
                            manifest_type: 'hls',
                            clearkey: '',
                            key_id: '',
                            key: '',
                            referrer: '',
                            user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                            source: 'sport_special'
                        };
                    } else if (current && (line.startsWith('http://') || line.startsWith('https://'))) {
                        current.stream_url = line;
                        if (line.includes('.mpd')) current.manifest_type = 'mpd';
                        events.push(current as LiveSportsEvent);
                        current = null;
                    }
                }
                if (current && current.stream_url) events.push(current as LiveSportsEvent);
                console.log(`[JtvService] Loaded AXSports network channels.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch axsports playlist.m3u:', e?.message || e);
        }

        cachedEvents = events;
        lastEventsFetch = now;
        console.log(`[JtvService] Total live sporting events: ${cachedEvents.length}`);
        return cachedEvents;
    }

    /**
     * Fetch all IPL 2026 Replay Matches from sportlive18/playlist
     */
    public static async fetchIplReplays(force = false): Promise<IplReplayMatch[]> {
        const now = Date.now();
        if (!force && cachedIplReplays.length > 0 && (now - lastIplFetch < CACHE_TTL_MS)) {
            return cachedIplReplays;
        }

        const replays: IplReplayMatch[] = [];
        try {
            const res = await axios.get(IPL_REPLAYS_URL, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                httpsAgent: agent,
                timeout: 10000
            });
            if (res.data && typeof res.data === 'string') {
                const lines = res.data.split('\n');
                let current: Partial<IplReplayMatch> | null = null;
                let counter = 1;

                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue;

                    if (line.startsWith('#EXTINF:')) {
                        if (current && current.stream_url) replays.push(current as IplReplayMatch);

                        const titleMatch = line.match(/,(.+)$/);
                        const rawTitle = titleMatch ? titleMatch[1].trim() : `IPL Match ${counter}`;
                        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                        const groupMatch = line.match(/group-title="([^"]+)"/);

                        const lang = groupMatch ? groupMatch[1].toUpperCase() : (rawTitle.includes('(HINDI)') ? 'HINDI' : 'ENGLISH');
                        const matchNumMatch = rawTitle.match(/MATCH\s*(\d+)/i);
                        const matchNum = matchNumMatch ? matchNumMatch[1] : String(counter);
                        const teams = rawTitle.replace(/\(ENGLISH\)|\(HINDI\)|MATCH\s*\d+/gi, '').trim();

                        current = {
                            id: `ipl-replay-${counter++}`,
                            title: rawTitle,
                            matchNumber: matchNum,
                            teams,
                            language: lang,
                            logo: logoMatch ? logoMatch[1] : 'https://img10.hotstar.com/image/upload/f_auto/sources/r1/cms/prod/4384/1774726004384-h',
                            stream_url: '',
                            proxy_url: ''
                        };
                    } else if (current && (line.startsWith('http://') || line.startsWith('https://'))) {
                        current.stream_url = line;
                        current.proxy_url = `/api/proxy/fancode?url=${encodeURIComponent(line)}`;
                        replays.push(current as IplReplayMatch);
                        current = null;
                    }
                }
                if (current && current.stream_url) replays.push(current as IplReplayMatch);
                console.log(`[JtvService] Successfully parsed ${replays.length} IPL 2026 replays.`);
            }
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch IPL 2026 replays:', e?.message || e);
        }

        cachedIplReplays = replays;
        lastIplFetch = now;
        return cachedIplReplays;
    }

    /**
     * Fetch IPL 2026 Highlights:
     * 1. Key playoff/final matches from the same IPL2026.m3u (Qualifier, Eliminator, Final)
     * 2. Completed FanCode cricket matches from fancode2.json / fancode3.json
     */
    public static async fetchIplHighlights(force = false): Promise<IplReplayMatch[]> {
        const now = Date.now();
        if (!force && cachedIplHighlights.length > 0 && (now - lastHighlightsFetch < CACHE_TTL_MS)) {
            return cachedIplHighlights;
        }

        const highlights: IplReplayMatch[] = [];

        // --- Source 1: Playoff/Key matches from IPL2026.m3u ---
        try {
            const res = await axios.get(IPL_REPLAYS_URL, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                httpsAgent: agent,
                timeout: 10000
            });
            if (res.data && typeof res.data === 'string') {
                const lines = res.data.split('\n');
                let current: Partial<IplReplayMatch> | null = null;
                let counter = 1000;
                const HIGHLIGHT_KEYWORDS = /qualifier|eliminator|final|super.over|semifinal|playoff/i;

                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue;

                    if (line.startsWith('#EXTINF:')) {
                        const titleMatch = line.match(/,(.+)$/);
                        const rawTitle = titleMatch ? titleMatch[1].trim() : '';
                        if (!HIGHLIGHT_KEYWORDS.test(rawTitle)) { current = null; continue; }

                        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                        const groupMatch = line.match(/group-title="([^"]+)"/);
                        const lang = groupMatch ? groupMatch[1].toUpperCase() : (rawTitle.includes('(HINDI)') ? 'HINDI' : 'ENGLISH');
                        const teams = rawTitle.replace(/\(ENGLISH\)|\(HINDI\)/gi, '').trim();

                        current = {
                            id: `ipl-highlight-${counter++}`,
                            title: rawTitle,
                            matchNumber: teams.includes('FINAL') ? 'FINAL' : teams.includes('QUALIFIER') ? 'QF' : teams.includes('ELIMINATOR') ? 'ELIM' : 'KM',
                            teams,
                            language: lang,
                            logo: logoMatch ? logoMatch[1] : 'https://img10.hotstar.com/image/upload/f_auto/sources/r1/cms/prod/4384/1774726004384-h',
                            stream_url: '',
                            proxy_url: ''
                        };
                    } else if (current && (line.startsWith('http://') || line.startsWith('https://'))) {
                        current.stream_url = line;
                        current.proxy_url = `/api/proxy/fancode?url=${encodeURIComponent(line)}`;
                        highlights.push(current as IplReplayMatch);
                        current = null;
                    }
                }
            }
        } catch (e: any) {
            console.warn('[JtvService] highlights - failed to parse IPL2026.m3u:', e?.message);
        }

        // --- Source 2: Completed FanCode cricket matches ---
        const fancodeUrls = [IPL_HIGHLIGHTS_FANCODE_JSON, IPL_HIGHLIGHTS_FANCODE3_JSON];
        for (const url of fancodeUrls) {
            try {
                const res = await axios.get(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    httpsAgent: agent,
                    timeout: 8000
                });
                const data = res.data;
                const matches: any[] = data?.matches || [];
                for (const m of matches) {
                    // Only include completed cricket matches with a stream_url
                    if (m.status !== 'COMPLETED' && m.status !== 'FINISHED' && m.status !== 'ENDED') continue;
                    if (m.category !== 'Cricket' && m.category !== 'cricket') continue;
                    const streamUrl = m.stream_url || m.hls_url || m.url || '';
                    if (!streamUrl) continue;

                    const title = m.title || m.name || m.tournament || 'Cricket Highlights';
                    const thumb = m.image || m.image_cdn?.APP || m.image_cdn?.CLOUDFARE || m.image_cdn?.SPORTS || '';
                    const teams = m.team ? m.team.map((t: any) => t.shortName || t.name).join(' VS ') : (m.title || '');

                    highlights.push({
                        id: `fc-highlight-${m.match_id || Math.random()}`,
                        title,
                        matchNumber: 'HIGHLIGHTS',
                        teams,
                        language: 'ENGLISH',
                        logo: thumb,
                        stream_url: streamUrl,
                        proxy_url: streamUrl.startsWith('/api/') ? streamUrl : `/api/proxy/fancode?url=${encodeURIComponent(streamUrl)}`
                    });
                }
                console.log(`[JtvService] Highlights from ${url}: ${highlights.length} total`);
            } catch (e: any) {
                console.warn('[JtvService] highlights - fancode fetch failed:', e?.message);
            }
        }

        cachedIplHighlights = highlights;
        lastHighlightsFetch = now;
        console.log(`[JtvService] Total highlights fetched: ${highlights.length}`);
        return cachedIplHighlights;
    }

    /**
     * Fetch auto-updated spotlight movies from sportlive18/MOVIE-API-AUTO-UPDATE
     */
    public static async fetchMovieSpotlight(): Promise<any> {
        try {
            const res = await axios.get(MOVIE_SPOTLIGHT_JSON, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                httpsAgent: agent,
                timeout: 8000
            });
            return res.data;
        } catch (e: any) {
            console.warn('[JtvService] Failed to fetch movie spotlight:', e?.message || e);
            return { success: false, data: { spotlight: [] } };
        }
    }

    /**
     * Regional Bigg Boss fallback resolver:
     * Maps tokenized Hotstar 24/7 feeds to 1080p JioTV live TV broadcast channels
     */
    public static resolveBiggBossFallback(channelIdOrName: string): { fallbackChannelId: string; name: string } | null {
        const lower = (channelIdOrName || '').toLowerCase();
        if (!lower.includes('big') && !lower.includes('boss') && !lower.includes('bb')) return null;

        if (lower.includes('malayalam') || lower.includes('mal')) return { fallbackChannelId: '443', name: 'Asianet HD (Bigg Boss Malayalam Official Live)' };
        if (lower.includes('hindi') || lower.includes('hin')) return { fallbackChannelId: '144', name: 'Colors HD (Bigg Boss Hindi Official Live)' };
        if (lower.includes('telugu') || lower.includes('tel')) return { fallbackChannelId: '439', name: 'Star Maa HD (Bigg Boss Telugu Official Live)' };
        if (lower.includes('tamil') || lower.includes('tam')) return { fallbackChannelId: '441', name: 'Star Vijay HD (Bigg Boss Tamil Official Live)' };
        if (lower.includes('kannada') || lower.includes('kan')) return { fallbackChannelId: '757', name: 'Colors Kannada HD (Bigg Boss Kannada Official Live)' };
        if (lower.includes('bangla') || lower.includes('ben')) return { fallbackChannelId: '756', name: 'Colors Bangla HD (Bigg Boss Bangla Official Live)' };
        if (lower.includes('marathi') || lower.includes('mar')) return { fallbackChannelId: '755', name: 'Colors Marathi HD (Bigg Boss Marathi Official Live)' };

        return { fallbackChannelId: '144', name: 'Colors HD (Bigg Boss Official Live)' };
    }

    /**
     * Resolve channel from catalog by ID or name
     */
    public static async resolveChannel(idOrSlug: string): Promise<JtvChannel | null> {
        if (!idOrSlug) return null;
        let clean = String(idOrSlug).trim().toLowerCase();
        if (clean.startsWith('jtv-')) clean = clean.replace('jtv-', '');
        if (clean.startsWith('mdtv-')) clean = clean.replace('mdtv-', '');

        const channels = await this.fetchChannels();

        let match = channels.find(c => String(c.id).toLowerCase() === clean);
        if (!match) match = channels.find(c => c.name.toLowerCase() === clean);
        if (!match) match = channels.find(c => c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === clean.replace(/[^a-z0-9]/g, ''));
        if (!match) match = channels.find(c => c.name.toLowerCase().includes(clean));

        // If the channel is a Hotstar channel, Hotstar ephemeral 24/7 stream tokens frequently expire.
        // Transparently fallback to the official live broadcaster channel (Asianet HD, Colors HD, Star Sports, etc.)
        if (match && (match.id.includes('hotstar') || match.source === 'hotstar' || match.name.toLowerCase().includes('bigboss') || match.name.toLowerCase().includes('bigg boss'))) {
            const fb = this.resolveBiggBossFallback(match.name || match.id);
            if (fb) {
                const fbCh = channels.find(c => String(c.id) === fb.fallbackChannelId);
                if (fbCh) {
                    return {
                        ...fbCh,
                        id: match.id,
                        name: `${match.name} [Broadcaster: ${fb.name}]`
                    };
                }
            }

            // General Hotstar channel: find official JioTV/MDTV broadcast counterpart
            const cleanName = match.name.toLowerCase()
                .replace(/hotstar|vip|special|live|\bhd\b|\bfeed\b/gi, '')
                .trim();
            if (cleanName.length >= 3) {
                const liveMatch = channels.find(c => 
                    (c.source === 'jtv' || c.source === 'mdtv') && 
                    c.name.toLowerCase().includes(cleanName)
                );
                if (liveMatch) {
                    return {
                        ...liveMatch,
                        id: match.id,
                        name: `${match.name} [Live]`
                    };
                }
            }
        }

        if (!match) {
            const fb = this.resolveBiggBossFallback(clean);
            if (fb) {
                const fbCh = channels.find(c => String(c.id) === fb.fallbackChannelId);
                if (fbCh) {
                    return {
                        ...fbCh,
                        id: clean,
                        name: fb.name
                    };
                }
            }
        }

        return match || null;
    }

    /**
     * Fetch upstream manifest and rewrite it with absolute CDN base URL, ClearKey ContentProtection and Akamai tokens
     */
    public static async getRewrittenManifest(idOrSlug: string): Promise<{ manifest: string; contentType: string } | null> {
        let ch = await this.resolveChannel(idOrSlug);
        if (!ch || !ch.stream_url) return null;

        if (ch.stream_url.includes('.m3u8') || (ch.full_stream_url && ch.full_stream_url.includes('.m3u8'))) {
            return null;
        }

        let upstreamUrl = ch.full_stream_url || (ch.stream_url + (ch.token ? (ch.stream_url.includes('?') ? '&' : '?') + ch.token : ''));
        let res: any;
        try {
            res = await axios.get(upstreamUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Referer': 'https://i.mdtv.dpdns.org/'
                },
                httpsAgent: agent,
                timeout: 8000,
                responseType: 'text'
            });
        } catch (err: any) {
            if (err?.response?.status === 403 || err?.message?.includes('403')) {
                console.log(`[JtvService] Manifest 403 on ${idOrSlug}, refreshing tokens from upstream feeds...`);
                await this.fetchChannels(true);
                ch = await this.resolveChannel(idOrSlug);
                if (ch && ch.stream_url) {
                    upstreamUrl = ch.full_stream_url || (ch.stream_url + (ch.token ? (ch.stream_url.includes('?') ? '&' : '?') + ch.token : ''));
                    res = await axios.get(upstreamUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                            'Referer': 'https://i.mdtv.dpdns.org/'
                        },
                        httpsAgent: agent,
                        timeout: 8000,
                        responseType: 'text'
                    });
                } else {
                    throw err;
                }
            } else {
                throw err;
            }
        }

        let data = res.data;
        if (!data || typeof data !== 'string') return null;

        // Calculate absolute CDN base directory from stream_url
        const lastSlash = ch.stream_url.lastIndexOf('/');
        const cdnDir = lastSlash !== -1 ? ch.stream_url.substring(0, lastSlash + 1) : ch.stream_url;

        // Rewrite relative BaseURL
        data = data.replace(/<BaseURL>dash\/<\/BaseURL>/gi, `<BaseURL>${cdnDir}dash/</BaseURL>`);
        data = data.replace(/<BaseURL>([a-zA-Z0-9_\-\/]+)<\/BaseURL>/gi, (match: string, p1: string) => {
            if (p1.startsWith('http://') || p1.startsWith('https://')) return match;
            return `<BaseURL>${cdnDir}${p1}</BaseURL>`;
        });

        // Insert ClearKey ContentProtection if not present
        if (!data.includes('1077efec-c0b2-4d02-ace3-3c1e52e2fb4b')) {
            const clearKeyProtection = `<ContentProtection schemeIdUri="urn:uuid:1077efec-c0b2-4d02-ace3-3c1e52e2fb4b" value="ClearKey1.0"/>`;
            data = data.replace(
                /<ContentProtection schemeIdUri="urn:uuid:EDEF8BA9-79D6-4ACE-A3C8-27DCD51D21ED">[\s\S]*?<\/ContentProtection>/gi,
                `${clearKeyProtection}\n      <ContentProtection schemeIdUri="urn:uuid:EDEF8BA9-79D6-4ACE-A3C8-27DCD51D21ED">\n      </ContentProtection>`
            );
        }

        // Inject Akamai authentication token into segment templates so CDN chunk requests succeed
        const tokenQuery = ch.token ? (ch.token.startsWith('__hdnea__=') ? ch.token : `__hdnea__=${ch.token}`) : '';
        if (tokenQuery) {
            data = data.replace(/initialization="([^"]+)"/gi, (match: string, url: string) => {
                if (url.includes('__hdnea__=')) return match;
                const separator = url.includes('?') ? '&amp;' : '?';
                return `initialization="${url}${separator}${tokenQuery}"`;
            });
            data = data.replace(/media="([^"]+)"/gi, (match: string, url: string) => {
                if (url.includes('__hdnea__=')) return match;
                const separator = url.includes('?') ? '&amp;' : '?';
                return `media="${url}${separator}${tokenQuery}"`;
            });
            data = data.replace(/sourceURL="([^"]+)"/gi, (match: string, url: string) => {
                if (url.includes('__hdnea__=')) return match;
                const separator = url.includes('?') ? '&amp;' : '?';
                return `sourceURL="${url}${separator}${tokenQuery}"`;
            });
        }

        return {
            manifest: data,
            contentType: res.headers['content-type'] || 'application/dash+xml'
        };
    }

    /**
     * Resolve single live sports match event by ID
     */
    public static async resolveEvent(eventId: string): Promise<LiveSportsEvent | null> {
        if (!eventId) return null;
        const clean = String(eventId).trim().toLowerCase();
        const events = await this.fetchLiveEvents();
        return events.find(e => e.id.toLowerCase() === clean) || null;
    }

    /**
     * Get summary category counts
     */
    public static async getCategories(): Promise<CategorySummary[]> {
        const channels = await this.fetchChannels();
        const counts: Record<string, number> = {};
        for (const c of channels) {
            counts[c.category] = (counts[c.category] || 0) + 1;
        }

        const iconMap: Record<string, string> = {
            'Sports': '⚽',
            'SonyLIV': '⚡',
            'Hotstar': '🌟',
            'Movies': '🎬',
            'Entertainment': '🎭',
            'News': '📰',
            'Kids': '🧸',
            'Music': '🎵',
            'Infotainment': '🌍',
            'Regional': '🇮🇳'
        };

        return Object.keys(counts).sort().map(cat => ({
            name: cat,
            count: counts[cat],
            icon: iconMap[cat] || '📺'
        }));
    }

    /**
     * Start background auto-synchronization every 15 minutes
     */
    public static startAutoSync(intervalMs = CACHE_TTL_MS): void {
        if (autoSyncTimer) {
            clearInterval(autoSyncTimer);
        }

        console.log(`[JtvService] Starting auto-sync worker every ${Math.round(intervalMs / 60000)} minutes`);

        Promise.all([
            this.fetchWildcardCookie(true),
            this.fetchChannels(true),
            this.fetchLiveEvents(true)
        ]).catch(err => console.error('[JtvService] Initial background sync error:', err));

        autoSyncTimer = setInterval(async () => {
            try {
                console.log('[JtvService] Auto-sync triggered: refreshing tokens, SonyLIV, Hotstar, FanCode, and live events...');
                await this.fetchWildcardCookie(true);
                await this.fetchChannels(true);
                await this.fetchLiveEvents(true);
                console.log('[JtvService] Auto-sync completed successfully.');
            } catch (err: any) {
                console.error('[JtvService] Auto-sync error:', err?.message || err);
            }
        }, intervalMs);
    }

    /**
     * Stop background auto-sync worker
     */
    public static stopAutoSync(): void {
        if (autoSyncTimer) {
            clearInterval(autoSyncTimer);
            autoSyncTimer = null;
        }
    }
}
