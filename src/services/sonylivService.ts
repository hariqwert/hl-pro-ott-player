import axios from 'axios';
import https from 'https';

export interface SonyLivEvent {
    id: string;
    contentId: string | number;
    title: string;
    eventName: string;
    category: string;
    sportName?: string;
    sportEmoji?: string;
    broadcastChannel: string;
    isLive: boolean;
    status: 'LIVE' | 'UPCOMING';
    thumbnail: string;
    streamUrl?: string;
    playUrl?: string;
    language?: string;
    updatedAt: number;
}

const SONYLIV_JSON_URL = 'https://raw.githubusercontent.com/sportlive18/Sonyliv-Playlist-Autoupdate/main/sonyliv.json';
const SONYLIV_M3U_URL = 'https://raw.githubusercontent.com/sportlive18/Sonyliv-Playlist-Autoupdate/main/sonyliv.m3u';

let cachedLiveEvents: SonyLivEvent[] = [];
let cachedUpcomingEvents: SonyLivEvent[] = [];
let cachedAllEvents: SonyLivEvent[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute auto-refresh

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    timeout: 8000
});

function getSportEmoji(cat: string): string {
    const lower = (cat || '').toLowerCase();
    if (lower.includes('cricket')) return '🏏';
    if (lower.includes('football') || lower.includes('soccer')) return '⚽';
    if (lower.includes('tennis')) return '🎾';
    if (lower.includes('combat') || lower.includes('mma') || lower.includes('ufc') || lower.includes('wwe')) return '🥊';
    if (lower.includes('f1') || lower.includes('motorsport')) return '🏎️';
    if (lower.includes('basketball')) return '🏀';
    return '🏆';
}

/**
 * Fetch and synchronize ongoing and upcoming SonyLIV sports fixtures
 */
export async function fetchSonyLivEvents(forceRefresh = false): Promise<{ live: SonyLivEvent[]; upcoming: SonyLivEvent[]; all: SonyLivEvent[] }> {
    const now = Date.now();
    if (!forceRefresh && cachedAllEvents.length > 0 && (now - lastFetchTime < CACHE_TTL_MS)) {
        return { live: cachedLiveEvents, upcoming: cachedUpcomingEvents, all: cachedAllEvents };
    }

    try {
        const res = await axios.get(SONYLIV_JSON_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            httpsAgent,
            timeout: 6000
        });

        const data = res.data;
        if (data && Array.isArray(data.matches)) {
            const liveEvents: SonyLivEvent[] = [];
            const upcomingEvents: SonyLivEvent[] = [];
            const allEvents: SonyLivEvent[] = [];

            data.matches.forEach((m: any, idx: number) => {
                const isLive = m.isLive === true;
                const cid = m.contentId || idx;
                const title = m.match_name || m.event_name || `SonyLIV Match ${idx + 1}`;
                const rawStream = m.video_url || m.pub_url || m.dai_url || '';
                const thumb = m.src || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800';
                const cat = m.event_category || 'Sports';
                const ch = m.broadcast_channel || 'SonyLIV';
                const emoji = getSportEmoji(cat);

                const playUrl = rawStream
                    ? `/play_consumet.php?channel_id=sonyliv-${cid}&name=${encodeURIComponent(title)}&url=${encodeURIComponent(`/api/proxy/fancode?url=${encodeURIComponent(rawStream)}`)}&logo=${encodeURIComponent(thumb)}&source=sonyliv`
                    : '#';

                const ev: SonyLivEvent = {
                    id: `sonyliv_${cid}`,
                    contentId: cid,
                    title,
                    eventName: m.event_name || title,
                    category: cat,
                    sportName: cat,
                    sportEmoji: emoji,
                    broadcastChannel: ch,
                    isLive,
                    status: isLive ? 'LIVE' : 'UPCOMING',
                    thumbnail: thumb,
                    streamUrl: rawStream,
                    playUrl,
                    language: m.audioLanguageName || 'ENG',
                    updatedAt: now
                };

                allEvents.push(ev);
                if (isLive && rawStream) {
                    liveEvents.push(ev);
                } else if (!isLive) {
                    upcomingEvents.push(ev);
                }
            });

            cachedLiveEvents = liveEvents;
            cachedUpcomingEvents = upcomingEvents;
            cachedAllEvents = allEvents;
            lastFetchTime = now;

            return { live: liveEvents, upcoming: upcomingEvents, all: allEvents };
        }
    } catch (e: any) {
        console.warn('[SonyLivService] Failed fetching SonyLIV events:', e?.message || e);
    }

    return { live: cachedLiveEvents, upcoming: cachedUpcomingEvents, all: cachedAllEvents };
}
