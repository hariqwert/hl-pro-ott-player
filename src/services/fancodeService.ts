import axios from 'axios';
import https from 'https';

export interface FanCodeEvent {
    id: string;
    matchId: number | string;
    title: string;
    eventName: string;
    sportCategory: string;
    team1?: string;
    team2?: string;
    status: 'LIVE' | 'UPCOMING' | 'FINISHED';
    startTime?: string;
    thumbnail: string;
    streamUrl?: string;
    playUrl?: string;
    isLive: boolean;
    updatedAt: number;
}

const FANCODE_M3U_URL = 'https://raw.githubusercontent.com/drmlive/fancode-live-events/main/fancode.m3u';
const FANCODE_JSON_URL = 'https://raw.githubusercontent.com/drmlive/fancode-live-events/main/fancode.json';

// In-memory cache for live FanCode events
let cachedLiveEvents: FanCodeEvent[] = [];
let cachedAllEvents: FanCodeEvent[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute auto-refresh

/**
 * Parse standard M3U playlist format from FanCode upstream
 */
function parseFanCodeM3u(m3uContent: string): Map<string, { streamUrl: string; logo?: string; group?: string; title?: string }> {
    const streamMap = new Map<string, { streamUrl: string; logo?: string; group?: string; title?: string }>();
    if (!m3uContent) return streamMap;

    const lines = m3uContent.split(/\r?\n/);
    let currentLogo = '';
    let currentGroup = '';
    let currentTitle = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#EXTINF:')) {
            const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
            const groupMatch = line.match(/group-title="([^"]+)"/i);
            const commaIdx = line.lastIndexOf(',');
            let rawTitle = commaIdx !== -1 ? line.slice(commaIdx + 1).trim() : '';
            // Clean any trailing tag remnants
            rawTitle = rawTitle.replace(/^(?:tvg-[^,]+|group-title="[^"]+"),\s*/gi, '').trim();
            currentTitle = rawTitle;
            currentLogo = logoMatch ? logoMatch[1] : '';
            currentGroup = groupMatch ? groupMatch[1] : 'FanCode';
        } else if (line.startsWith('http://') || line.startsWith('https://')) {
            const streamUrl = line;
            // Match ID extraction e.g. /mumbai/4249577_english_hls...
            const matchIdMatch = streamUrl.match(/\/(\d{5,10})_/);
            const matchKey = matchIdMatch ? matchIdMatch[1] : currentTitle;

            streamMap.set(matchKey, {
                streamUrl,
                logo: currentLogo,
                group: currentGroup,
                title: currentTitle
            });
            // Also store by full title lowercase for fuzzy lookup
            if (currentTitle) {
                streamMap.set(currentTitle.toLowerCase().replace(/\[.*?\]|\(.*?\)/g, '').trim(), {
                    streamUrl,
                    logo: currentLogo,
                    group: currentGroup,
                    title: currentTitle
                });
            }
        }
    }

    return streamMap;
}

/**
 * Fetch and synchronize ongoing FanCode live sports events
 */
export async function fetchFanCodeEvents(forceRefresh = false): Promise<{ live: FanCodeEvent[]; all: FanCodeEvent[] }> {
    const now = Date.now();
    if (!forceRefresh && cachedLiveEvents.length > 0 && (now - lastFetchTime < CACHE_TTL_MS)) {
        return { live: cachedLiveEvents, all: cachedAllEvents };
    }

    try {
        const [m3uRes, jsonRes] = await Promise.allSettled([
            axios.get(FANCODE_M3U_URL, { timeout: 4000 }),
            axios.get(FANCODE_JSON_URL, { timeout: 4000 })
        ]);

        const streamMap = (m3uRes.status === 'fulfilled' && typeof m3uRes.value.data === 'string')
            ? parseFanCodeM3u(m3uRes.value.data)
            : new Map();

        const jsonEvents: any[] = (jsonRes.status === 'fulfilled' && jsonRes.value.data?.matches && Array.isArray(jsonRes.value.data.matches))
            ? jsonRes.value.data.matches
            : [];

        const allList: FanCodeEvent[] = [];
        const liveList: FanCodeEvent[] = [];

        // 1. Process matches from json feed
        for (const m of jsonEvents) {
            const matchIdStr = String(m.match_id || '');
            const matchKey = matchIdStr;
            const cleanTitle = (m.title || m.match_name || 'FanCode Match').replace(/\[.*?\]|\(.*?\)/g, '').trim();

            const streamData = streamMap.get(matchKey) || streamMap.get(cleanTitle.toLowerCase());
            const streamUrl = streamData?.streamUrl;
            const isLive = Boolean(streamUrl || m.status === 'LIVE');

            const event: FanCodeEvent = {
                id: `fancode-${matchIdStr}`,
                matchId: m.match_id,
                title: m.title || m.match_name || 'Live Sports',
                eventName: m.event_name || 'FanCode Live',
                sportCategory: m.event_category || 'Cricket',
                team1: m.team_1,
                team2: m.team_2,
                status: isLive ? 'LIVE' : (m.status || 'UPCOMING'),
                startTime: m.startTime,
                thumbnail: m.src || streamData?.logo || 'https://www.fancode.com/skillup-uploads/cms-media/web-1.png',
                streamUrl: streamUrl,
                playUrl: streamUrl ? `/play_consumet.php?channel_id=fancode-${matchIdStr}&name=${encodeURIComponent(m.title || m.match_name)}&url=${encodeURIComponent(`/api/proxy/fancode?url=${encodeURIComponent(streamUrl)}`)}&logo=${encodeURIComponent(m.src || '')}&source=fancode` : undefined,
                isLive,
                updatedAt: now
            };

            allList.push(event);
            if (isLive && streamUrl) {
                liveList.push(event);
            }
        }

        // 2. Add any active streams from M3U that weren't in JSON
        for (const [key, val] of streamMap.entries()) {
            if (/^\d+$/.test(key) && !liveList.some(e => String(e.matchId) === key)) {
                const event: FanCodeEvent = {
                    id: `fancode-${key}`,
                    matchId: key,
                    title: val.title || `FanCode Match #${key}`,
                    eventName: val.group || 'FanCode Live',
                    sportCategory: (val.group || '').includes('Cricket') ? 'Cricket' : ((val.group || '').includes('Football') ? 'Football' : 'Sports'),
                    status: 'LIVE',
                    thumbnail: val.logo || 'https://www.fancode.com/skillup-uploads/cms-media/web-1.png',
                    streamUrl: val.streamUrl,
                    playUrl: `/play_consumet.php?channel_id=fancode-${key}&name=${encodeURIComponent(val.title || `FanCode Match #${key}`)}&url=${encodeURIComponent(`/api/proxy/fancode?url=${encodeURIComponent(val.streamUrl)}`)}&logo=${encodeURIComponent(val.logo || '')}&source=fancode`,
                    isLive: true,
                    updatedAt: now
                };
                liveList.push(event);
                allList.unshift(event);
            }
        }

        cachedLiveEvents = liveList;
        cachedAllEvents = allList;
        lastFetchTime = now;

        console.log(`[FanCode] Refreshed: ${liveList.length} ongoing live streams, ${allList.length} total events`);
        return { live: liveList, all: allList };
    } catch (err: any) {
        console.warn('[FanCode] Refresh warning:', err?.message);
        return { live: cachedLiveEvents, all: cachedAllEvents };
    }
}

/**
 * Generate standard IPTV M3U for FanCode live sports
 */
export async function getFanCodeM3u(baseUrl?: string): Promise<string> {
    const { live } = await fetchFanCodeEvents();
    let m3u = `#EXTM3U\n`;
    for (const ev of live) {
        if (!ev.streamUrl) continue;
        const category = ev.sportCategory ? `Fancode-${ev.sportCategory}` : 'FanCode Live';
        const streamTarget = baseUrl ? `${baseUrl}/api/proxy/fancode?url=${encodeURIComponent(ev.streamUrl)}` : ev.streamUrl;
        m3u += `#EXTINF:-1 tvg-id="${ev.id}" tvg-name="${ev.title}" tvg-logo="${ev.thumbnail}" group-title="${category}",${ev.title}\n`;
        m3u += `${streamTarget}\n\n`;
    }
    return m3u;
}

// Background auto-updater every 2 minutes
setInterval(() => {
    fetchFanCodeEvents(true).catch(() => {});
}, 2 * 60 * 1000);
