import { Router, Request, Response } from 'express';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { StalkerAPI } from '../stalkerAPI';
import { ChannelJsonService } from '../services/channelJsonService';
import { getTimChannels, getTimLiveEvents, getAllTimStreams } from '../services/timstreamsService';
import { JtvService } from '../services/jtvService';

const router = Router();
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours for the channel list itself
let cachedPlaylist: string | null = null;
let lastFetchTime = 0;

function fetchUrl(url: string, referer: string = 'https://epiembeds.online/', timeoutMs: number = 8000): Promise<string> {
    return new Promise((resolve) => {
        try {
            const u = new URL(url);
            const isHttps = u.protocol === 'https:';
            const client = isHttps ? https : http;
            const options: any = {
                hostname: u.hostname,
                port: u.port || (isHttps ? 443 : 80),
                path: u.pathname + u.search,
                timeout: timeoutMs,
                rejectUnauthorized: false,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Referer': referer
                }
            };
            const req = client.get(options, (res: any) => {
                let data = '';
                res.on('data', (chunk: any) => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', () => resolve(''));
            
            req.on('timeout', () => {
                req.destroy();
                resolve('');
            });
        } catch(e) {
            resolve('');
        }
    });
}

function decodeStreamUrl(html: string): string | null {
    if (!html) return null;
    const atobMatch = html.match(/atob\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (atobMatch) {
        try {
            const decoded = Buffer.from(atobMatch[1], 'base64').toString('utf-8');
            if (decoded.includes('.m3u8')) return decoded;
        } catch(e) {}
    }
    let match = html.match(/var\s+([a-zA-Z0-9_$]+)\s*=\s*\[([\d,]+)\]\s*,\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+)\s*,\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+)/);
    if (!match) {
        match = html.match(/var\s+([a-zA-Z0-9_$]+)\s*=\s*\[([\d,]+)\];\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+);\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+);/);
    }
    if (match) {
        const arr = match[2].split(',').map(Number);
        const arg1 = parseInt(match[4]);
        const arg2 = parseInt(match[6]);
        let decoded = "";
        for (let i = 0; i < arr.length; i++) {
            decoded += String.fromCharCode(((arr[i] ^ arg1) - arg2 + 256) % 256);
        }
        const m3u8Match = decoded.match(/https?:\/\/[^\s'"\\]+\.m3u8[^\s'"\\]*/);
        if (m3u8Match) return m3u8Match[0];
    }
    const directMatch = html.match(/https?:\/\/[^\s'"\\]+\.m3u8[^\s'"\\]*/);
    return directMatch ? directMatch[0] : null;
}

const DLHD_TO_TIM: Record<string, string> = {
    'sky-sports-main-event': 'skysportsmainevent-uk',
    'sky-sports-premier-league': 'skysportspremierleague-uk',
    'sky-sports-football': 'skysportsfootball-uk',
    'sky-sports-f1': 'skysportsf1-uk',
    'sky-sports-cricket': 'skysportscricket-uk',
    'sky-sports-action': 'skysportsaction-uk',
    'sky-sports-arena': 'skysportsarena-uk',
    'sky-sports-golf': 'skysportsgolf-uk',
    'sky-sports-news': 'skysportsnews-uk',
    'tnt-sports-1': 'tntsports1-uk',
    'tnt-sports-2': 'tntsports2-uk',
    'tnt-sports-3': 'tntsports3-uk',
    'tnt-sports-4': 'tntsports4-uk',
    'bein-sports-1': 'beinsports-usa',
    'bein-sports-2': 'beinsports2-fr',
    'bein-sports-3': 'beinsports3-fr',
    'espn': 'espn-usa',
    'espn2': 'espn2-usa',
    'fox-sports-1': 'fs1-usa',
    'fox-sports-2': 'fs2-usa',
    'dazn-1': 'dazn1-uk',
    'willow-hd': 'willowcricket-usa',
    'willow': 'willowcricket-usa',
    'willow-2': '247-willow-2',
    'willow2': '247-willow-2',
    '247-willow-2': '247-willow-2',
    'embed-247-willow-2': '247-willow-2',
    'embed_247-willow-2': '247-willow-2',
    'sony-ten-1': 'sonyten1-in',
    'sony-ten-2': 'sonyten2-in',
    'sony-six': 'sonysix-in',
    'star-sports-1': 'starsports1-in',
    'eurosport-1': 'eurosport1-uk',
    'eurosport-2': 'eurosport2-uk',
    'wwe-network': 'wwenetwork-usa',
    'abc': 'abc-usa',
    'cbs': 'cbs-usa',
    'nbc': 'nbc-usa',
    'fox': 'fox-usa'
};

async function resolveChannelStream(rawId: string): Promise<string | null> {
    const isDlhd = rawId.startsWith('dlhd-') || rawId.startsWith('dlhd_') || rawId.toLowerCase().startsWith('dlhd');
    const isTim = rawId.startsWith('tim_') || rawId.startsWith('tim-') || rawId.toLowerCase().startsWith('tim');
    const isEmbed = rawId.startsWith('embed-') || rawId.startsWith('embed_') || rawId.startsWith('embedindia-') || rawId.startsWith('247-');
    const isJtv = rawId.startsWith('jtv-') || rawId.startsWith('mdtv-') || rawId.startsWith('jtv_') || rawId.startsWith('mdtv_');
    let channelId = rawId;
    if (isDlhd) {
        channelId = channelId.replace(/^dlhd[_-]?/i, '');
    } else if (isTim) {
        channelId = channelId.replace(/^tim[_-]?/i, '');
    } else if (isEmbed) {
        channelId = channelId.replace(/^(embed|embedindia)[_-]?/i, '');
    } else if (isJtv) {
        channelId = channelId.replace(/^(jtv|mdtv)[_-]?/i, '');
    }

    if (channelId.startsWith('http://') || channelId.startsWith('https://')) {
        return channelId;
    }

    // High priority: Resolve JioTV DASH / SonyLIV / Hotstar channels directly
    if (isJtv) {
        const jtvCh = await JtvService.resolveChannel(channelId);
        if (jtvCh && (jtvCh.full_stream_url || jtvCh.stream_url)) {
            return jtvCh.full_stream_url || jtvCh.stream_url;
        }
    }

    let streamUrl: string | null = null;
    let html = '';

    // 1. High priority: Resolve via TimStreams / epiembeds online engine
    if (isTim || isDlhd || isEmbed) {
        let timId = channelId;
        if (isDlhd) {
            const cleanDlhd = channelId.toLowerCase();
            timId = DLHD_TO_TIM[cleanDlhd] || DLHD_TO_TIM[cleanDlhd.replace(/[-_]/g, '')] || (cleanDlhd.replace(/[-_]/g, '') + '-uk');
        } else if (isEmbed && DLHD_TO_TIM[channelId]) {
            timId = DLHD_TO_TIM[channelId];
        }
        html = await fetchUrl(`https://epiembeds.online/embed/${encodeURIComponent(timId)}`, 'https://epiembeds.online/');
        streamUrl = decodeStreamUrl(html);

        if (!streamUrl && isDlhd) {
            // Try without -uk suffix
            const plainId = channelId.replace(/[-_]/g, '').toLowerCase();
            html = await fetchUrl(`https://epiembeds.online/embed/${encodeURIComponent(plainId)}`, 'https://epiembeds.online/');
            streamUrl = decodeStreamUrl(html);
        }
    }

    // 2. Secondary fallback: Try DaddyLive endpoints
    if (!streamUrl && isDlhd) {
        html = await fetchUrl(`https://hamis.romponalis.st/premiumtv/daddy3.php?id=${encodeURIComponent(channelId)}`, 'https://dlhd.st/');
        let tempUrl = decodeStreamUrl(html);
        if (tempUrl && !tempUrl.includes('premium0')) {
            streamUrl = tempUrl;
        }

        if (!streamUrl) {
            html = await fetchUrl(`https://dlhd.st/stream/stream-${encodeURIComponent(channelId)}.php`, 'https://dlhd.st/');
            tempUrl = decodeStreamUrl(html);
            if (tempUrl && !tempUrl.includes('premium0')) {
                streamUrl = tempUrl;
            }
        }
    }

    return streamUrl;
}

export async function getOrUpdatePlaylist(force: boolean = false): Promise<string> {
    const now = Date.now();
    if (force) {
        cachedPlaylist = null;
        lastFetchTime = 0;
    }

    const sportsM3uDiskPath = path.join(process.cwd(), 'assets', 'sports.m3u');
    if (!force && fs.existsSync(sportsM3uDiskPath)) {
        try {
            const diskPlaylist = fs.readFileSync(sportsM3uDiskPath, 'utf-8');
            if (diskPlaylist && diskPlaylist.length > 500) {
                cachedPlaylist = diskPlaylist;
                return cachedPlaylist;
            }
        } catch(e) {}
    }

    if (!force && cachedPlaylist && (now - lastFetchTime < CACHE_DURATION_MS)) {
        return cachedPlaylist;
    }
    
    console.log(`[*] Generating master unified dynamic M3U playlist...`);
    let m3uLines = ['#EXTM3U\n'];
    let totalStreamsCount = 0;
    let data: any[] = [];
    const seenUrls = new Set<string>();

    const addChannelToCatalog = (ch: any) => {
        if (!ch) return;
        const streamUrl = ch.stream_url || ch.channel_id || ch.url;
        if (!streamUrl) return;
        const cleanUrl = String(streamUrl).trim();
        if (seenUrls.has(cleanUrl)) return;
        seenUrls.add(cleanUrl);
        data.push({
            channel_id: ch.channel_id || cleanUrl,
            stream_url: cleanUrl,
            name: (ch.name || ch.title || 'Channel ' + (data.length + 1)).trim(),
            genre: (ch.genre || ch.group || 'Sports').trim(),
            logo: (ch.logo || '').trim(),
            source: (ch.source || 'm3u_storage').trim(),
            drm: ch.drm || null
        });
    };

    // 1. Primary Source: assets/channels.json
    try {
        const localChannels = ChannelJsonService.getChannels();
        if (Array.isArray(localChannels) && localChannels.length > 0) {
            console.log(`[+] Loaded ${localChannels.length} channels from channels.json.`);
            localChannels.forEach(addChannelToCatalog);
        }
    } catch (err: any) {
        console.error('[!] Failed to load channels.json', err.message);
    }

    // 2. Secondary Source: doctor_strange/admin_db.json (sportsM3uFiles & sports)
    try {
        const dbPath = path.join(process.cwd(), 'doctor_strange', 'admin_db.json');
        if (fs.existsSync(dbPath)) {
            const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            
            // Custom Sports M3U Files
            if (db.sportsM3uFiles && Array.isArray(db.sportsM3uFiles)) {
                for (const m3u of db.sportsM3uFiles) {
                    if (!m3u.url) continue;
                    let m3uContent = '';
                    if (m3u.url.startsWith('/doctor_strange/')) {
                        const localPath = path.join(process.cwd(), m3u.url);
                        if (fs.existsSync(localPath)) {
                            m3uContent = fs.readFileSync(localPath, 'utf8');
                        }
                    } else if (m3u.url.startsWith('http://') || m3u.url.startsWith('https://')) {
                        m3uContent = await fetchUrl(m3u.url);
                    }
                    
                    if (m3uContent) {
                        const lines = m3uContent.split('\n');
                        let currentChannel: any = null;
                        for (let i = 0; i < lines.length; i++) {
                            const line = lines[i].trim();
                            if (line.startsWith('#EXTINF:')) {
                                let name = line.split(',').pop() || 'Unknown';
                                let logoMatch = line.match(/tvg-logo="([^"]+)"/i);
                                let groupMatch = line.match(/group-title="([^"]+)"/i);
                                currentChannel = {
                                    name: name.trim(),
                                    logo: logoMatch ? logoMatch[1] : '',
                                    genre: groupMatch ? groupMatch[1] : m3u.name || 'Custom Sports',
                                    source: 'sports_m3u_file'
                                };
                            } else if (line && !line.startsWith('#') && currentChannel) {
                                currentChannel.stream_url = line;
                                addChannelToCatalog(currentChannel);
                                currentChannel = null;
                            }
                        }
                    }
                }
            }

            // Single Sports Items
            if (db.sports && Array.isArray(db.sports)) {
                for (const s of db.sports) {
                    if (s.url) {
                        addChannelToCatalog({
                            name: s.title || 'Sports Stream',
                            stream_url: s.url,
                            logo: s.icon && s.icon.startsWith('http') ? s.icon : '',
                            genre: 'Custom Sports',
                            source: 'admin_single_sports'
                        });
                    }
                }
            }
        }
    } catch (err: any) {
        console.error('[!] Failed to parse admin_db M3U items:', err.message);
    }

    // 3. Third Source: doctor_strange/m3u_playlists/*.m3u directory
    try {
        const vaultDir = path.join(process.cwd(), 'doctor_strange', 'm3u_playlists');
        if (fs.existsSync(vaultDir)) {
            const files = fs.readdirSync(vaultDir);
            for (const file of files) {
                if (file.endsWith('.m3u') || file.endsWith('.m3u8')) {
                    const filePath = path.join(vaultDir, file);
                    const fileContent = fs.readFileSync(filePath, 'utf8');
                    const lines = fileContent.split('\n');
                    let currentChannel: any = null;
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (line.startsWith('#EXTINF:')) {
                            let name = line.split(',').pop() || 'Unknown';
                            let logoMatch = line.match(/tvg-logo="([^"]+)"/i);
                            let groupMatch = line.match(/group-title="([^"]+)"/i);
                            currentChannel = {
                                name: name.trim(),
                                logo: logoMatch ? logoMatch[1] : '',
                                genre: groupMatch ? groupMatch[1] : file.replace(/\.m3u8?$/i, ''),
                                source: 'vault_file'
                            };
                        } else if (line && !line.startsWith('#') && currentChannel) {
                            currentChannel.stream_url = line;
                            addChannelToCatalog(currentChannel);
                            currentChannel = null;
                        }
                    }
                }
            }
        }
    } catch (err: any) {
        console.error('[!] Failed scanning vault directory:', err.message);
    }

    // 4. Guaranteed Proxy Streams: TimStreams & DaddyLive (DLHD)
    try {
        // Fetch online TimStreams directory
        try {
            const timChannels = await getTimChannels();
            if (Array.isArray(timChannels)) {
                timChannels.forEach((c: any) => {
                    const slug = c.url;
                    if (slug) {
                        addChannelToCatalog({
                            channel_id: 'tim_' + slug,
                            stream_url: 'tim_' + slug,
                            name: '⚡ ' + (c.name || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'"),
                            genre: 'Proxy Streams',
                            logo: c.logo || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150',
                            source: 'timstreams'
                        });
                    }
                });
            }
        } catch (e: any) {
            console.warn('[!] Note: TimStreams online fetch fallback:', e.message);
        }
    } catch (e: any) {
        console.error('[!] Error populating proxy streams:', e.message);
    }

    const curatedProxyStreams = [
        { id: 'dlhd-sky-sports-main-event', name: '⚡ Sky Sports Main Event (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/ae/Sky_Sports_Main_Event_logo.svg/512px-Sky_Sports_Main_Event_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-sky-sports-premier-league', name: '⚡ Sky Sports Premier League (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/6/6b/Sky_Sports_Premier_League_logo.svg/512px-Sky_Sports_Premier_League_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-sky-sports-football', name: '⚡ Sky Sports Football (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/c/cb/Sky_Sports_Football_logo.svg/512px-Sky_Sports_Football_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-sky-sports-f1', name: '⚡ Sky Sports F1 (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/08/Sky_Sports_F1_logo.svg/512px-Sky_Sports_F1_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-sky-sports-cricket', name: '⚡ Sky Sports Cricket (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e0/Sky_Sports_Cricket_logo.svg/512px-Sky_Sports_Cricket_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-tnt-sports-1', name: '⚡ TNT Sports 1 (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/TNT_Sports_1.svg/512px-TNT_Sports_1.svg.png', source: 'dlhd' },
        { id: 'dlhd-tnt-sports-2', name: '⚡ TNT Sports 2 (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/87/TNT_Sports_2.svg/512px-TNT_Sports_2.svg.png', source: 'dlhd' },
        { id: 'dlhd-tnt-sports-3', name: '⚡ TNT Sports 3 (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4e/TNT_Sports_3.svg/512px-TNT_Sports_3.svg.png', source: 'dlhd' },
        { id: 'dlhd-tnt-sports-4', name: '⚡ TNT Sports 4 (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/84/TNT_Sports_4.svg/512px-TNT_Sports_4.svg.png', source: 'dlhd' },
        { id: 'dlhd-bein-sports-1', name: '⚡ beIN Sports 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/BeIN_Sports_1_logo.svg/512px-BeIN_Sports_1_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-bein-sports-2', name: '⚡ beIN Sports 2 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/BeIN_Sports_2_logo.svg/512px-BeIN_Sports_2_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-espn', name: '⚡ ESPN USA HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/ESPN_logo.svg/512px-ESPN_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-espn2', name: '⚡ ESPN 2 USA HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/ESPN2_logo.svg/512px-ESPN2_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-fox-sports-1', name: '⚡ Fox Sports 1 (FS1) (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Fox_Sports_1_logo.svg/512px-Fox_Sports_1_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-fox-sports-2', name: '⚡ Fox Sports 2 (FS2) (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Fox_Sports_2_logo.svg/512px-Fox_Sports_2_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-dazn-1', name: '⚡ DAZN 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/DAZN_Logo.svg/512px-DAZN_Logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-willow-hd', name: '⚡ Willow Cricket HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/6/69/Willow_logo.png/512px-Willow_logo.png', source: 'dlhd' },
        { id: 'dlhd-sony-ten-1', name: '⚡ Sony Ten 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/df/Sony_Ten_1.svg/512px-Sony_Ten_1.svg.png', source: 'dlhd' },
        { id: 'dlhd-sony-ten-2', name: '⚡ Sony Ten 2 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/23/Sony_Ten_2.svg/512px-Sony_Ten_2.svg.png', source: 'dlhd' },
        { id: 'dlhd-sony-six', name: '⚡ Sony Sports Ten 5 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f6/Sony_Sports_Ten_5_logo.png/512px-Sony_Sports_Ten_5_logo.png', source: 'dlhd' },
        { id: 'dlhd-star-sports-1', name: '⚡ Star Sports 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/25/Star_Sports_1.svg/512px-Star_Sports_1.svg.png', source: 'dlhd' },
        { id: 'dlhd-star-sports-hindi', name: '⚡ Star Sports 1 Hindi (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/07/Star_Sports_Hindi_1.svg/512px-Star_Sports_Hindi_1.svg.png', source: 'dlhd' },
        { id: 'dlhd-star-sports-select-1', name: '⚡ Star Sports Select 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/87/Star_Sports_Select_1.svg/512px-Star_Sports_Select_1.svg.png', source: 'dlhd' },
        { id: 'dlhd-sports18-1', name: '⚡ Sports18 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Sports18_1_logo.svg/512px-Sports18_1_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-eurosport-1', name: '⚡ Eurosport 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Eurosport_1_logo.svg/512px-Eurosport_1_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-wwe-network', name: '⚡ WWE Network Live 24/7 (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/WWE_Network_Logo.svg/512px-WWE_Network_Logo.svg.png', source: 'dlhd' },
        { id: 'embed-247-willow-2', name: '⚡ Willow 2 (Embed)', genre: 'Cricket', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/6/69/Willow_logo.png/512px-Willow_logo.png', source: 'embed' }
    ];
    curatedProxyStreams.forEach(c => {
        addChannelToCatalog({
            channel_id: c.id,
            stream_url: c.id,
            name: c.name,
            genre: c.genre,
            logo: c.logo,
            source: c.source
        });
    });

    // Format all catalog channels into standard M3U
    try {
        if (Array.isArray(data) && data.length > 0) {
            for (const ch of data) {
                if (!ch.channel_id && !ch.stream_url) continue;
                totalStreamsCount++;
                const genre = ch.genre || 'Sports Channels';
                const name = ch.name || 'Unknown Channel';
                const logo = ch.logo || '';
                
                let streamUrl = ch.stream_url || ch.channel_id;
                if (ch.source === 'jtv' || ch.source === 'mdtv' || (ch.channel_id && (ch.channel_id.startsWith('jtv-') || ch.channel_id.startsWith('mdtv-')))) {
                    streamUrl = `__HOSTURL__/live.php?token=STALKER_PRO&id=${encodeURIComponent(ch.channel_id)}&m3u=1`;
                } else if (ch.source === 'kliv_jozo' || (ch.channel_id && (ch.channel_id.startsWith('http://stream.kliv.in') || ch.channel_id.startsWith('https://stream.kliv.in')))) {
                    streamUrl = `__HOSTURL__/live.php?token=STALKER_PRO&id=${encodeURIComponent(ch.channel_id)}&m3u=1`;
                } else if (ch.channel_id && (ch.channel_id.startsWith('tim_') || ch.channel_id.startsWith('dlhd-') || ch.channel_id.startsWith('embed-') || ch.channel_id.startsWith('embed_') || ch.source === 'embed')) {
                    streamUrl = `__HOSTURL__/live.php?token=STALKER_PRO&id=${encodeURIComponent(ch.channel_id)}&m3u=1`;
                } else if (ch.channel_id && (ch.channel_id.startsWith('http://') || ch.channel_id.startsWith('https://') || ch.source === 'custom' || ch.source === 'admin_manual' || ch.source === 'm3u_converter')) {
                    streamUrl = ch.channel_id;
                } else if (ch.stream_url && (ch.stream_url.startsWith('http://') || ch.stream_url.startsWith('https://') || ch.source === 'custom')) {
                    streamUrl = ch.stream_url;
                } else if (ch.stream_url && (ch.stream_url.includes('.m3u8') || ch.stream_url.includes('.mpd'))) {
                    streamUrl = `__HOSTURL__/live.php?token=STALKER_PRO&id=${encodeURIComponent(ch.stream_url)}&m3u=1`;
                }
                
                m3uLines.push(`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" group-title="${genre}",${name}\n`);
                if (ch.drm && ch.drm.type === 'clearkey' && (ch.drm.key_id || ch.drm.keyId) && ch.drm.key) {
                    const keyId = ch.drm.key_id || ch.drm.keyId;
                    m3uLines.push(`#KODIPROP:inputstream.adaptive.manifest_type=mpd\n`);
                    m3uLines.push(`#KODIPROP:inputstream.adaptive.license_type=clearkey\n`);
                    m3uLines.push(`#KODIPROP:inputstream.adaptive.license_key=${keyId}:${ch.drm.key}\n`);
                }
                m3uLines.push(`${streamUrl}\n`);
            }
        }
    } catch(e: any) {
        console.error("[!] Error generating playlist from channels catalog:", e.message);
    }

    cachedPlaylist = m3uLines.join('');
    lastFetchTime = Date.now();
    try { fs.writeFileSync(path.join(process.cwd(), 'assets', 'sports.m3u'), cachedPlaylist, 'utf-8'); } catch(e) {}
    console.log(`[✓] Master Sports M3U connected & synchronized with ${totalStreamsCount} total stream items.`);
    return cachedPlaylist;
}

router.get(['/sports.m3u', '/playlist.m3u', '/dlhd.m3u'], async (req: Request, res: Response) => {
    // Generate base URL (e.g., http://localhost:3000 or https://your-domain.com)
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const hostUrl = `${protocol}://${host}`;
    
    const forceRefresh = req.query.refresh === '1' || req.query.force === 'true';
    const playlist = await getOrUpdatePlaylist(forceRefresh);
    const finalPlaylist = playlist.replace(/__HOSTURL__/g, hostUrl);
    res.setHeader('Content-Type', 'application/x-mpegurl; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=2700');
    res.send(finalPlaylist);
});

// Direct playback redirect endpoint
router.get('/api/play_stream/:id', async (req: Request, res: Response) => {
    const rawParam = req.params.id;
    const channelId = Array.isArray(rawParam) ? rawParam[0] : (rawParam || '');
    try {
        const streamUrl = await resolveChannelStream(channelId);
        
        if (streamUrl) {
            if (streamUrl.startsWith('http://') || streamUrl.startsWith('https://')) {
                res.redirect(302, streamUrl);
                return;
            }
            const stalkerEnc = StalkerAPI.scarletWitch('encrypt', streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1));
            const wandaEnc = StalkerAPI.scarletWitch('encrypt', streamUrl);
            const proxiedUrl = `/live.php?token=STALKER_PRO&stalker=${stalkerEnc}&wanda=${wandaEnc}&m3u=1`;
            res.redirect(302, proxiedUrl);
        } else {
            console.error(`[!] Failed to resolve stream for channel: ${channelId}`);
            res.status(404).send('Stream not found or token expired.');
        }
    } catch (err) {
        res.status(500).send('Error resolving stream.');
    }
});

// Dynamic stream resolver endpoint
router.get('/api/resolve_stream/:id', async (req: Request, res: Response) => {
    const rawParam = req.params.id;
    const channelId = Array.isArray(rawParam) ? rawParam[0] : (rawParam || '');
    try {
        const streamUrl = await resolveChannelStream(channelId);
        
        if (streamUrl) {
            let proxiedUrl = streamUrl;
            if (!streamUrl.startsWith('http://') && !streamUrl.startsWith('https://')) {
                const stalkerEnc = StalkerAPI.scarletWitch('encrypt', streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1));
                const wandaEnc = StalkerAPI.scarletWitch('encrypt', streamUrl);
                proxiedUrl = `/live.php?token=STALKER_PRO&stalker=${stalkerEnc}&wanda=${wandaEnc}&m3u=1`;
            }
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.json({ status: 'success', url: proxiedUrl, raw_url: streamUrl });
        } else {
            console.error(`[!] Failed to resolve stream for channel: ${channelId}`);
            res.status(404).json({ status: 'error', message: 'Stream not found or token expired.' });
        }
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Error resolving stream.' });
    }
});

// JSON channels list endpoint for fast rendering
router.get('/api/sports/channels', async (req: Request, res: Response) => {
    try {
        const force = req.query.refresh === '1';
        await getOrUpdatePlaylist(force);
        
        let allChannels: any[] = [];
        try {
            const data = ChannelJsonService.getChannels();
            if (Array.isArray(data)) allChannels = [...data];
        } catch (err: any) {
            console.error('[!] Failed to read channels in /api/sports/channels:', err.message);
        }

        // Add proxy streams
        const proxyStreams = await getProxyStreamsList();
        const existingIds = new Set(allChannels.map(c => c.channel_id || c.stream_url));
        proxyStreams.forEach(ps => {
            if (!existingIds.has(ps.channel_id) && !existingIds.has(ps.stream_url)) {
                allChannels.push(ps);
            }
        });

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json(allChannels);
    } catch (e) {
        res.status(500).json({ error: 'Failed to load channels' });
    }
});

// Dedicated Proxy Streams (TimStreams & DLHD) endpoint
router.get('/api/sports/proxy-streams', async (req: Request, res: Response) => {
    try {
        const proxyStreams = await getProxyStreamsList();
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json({
            status: 'success',
            count: proxyStreams.length,
            channels: proxyStreams
        });
    } catch (e: any) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// Dedicated TimStreams Live Events endpoint (https://timst.cfd/api/streams)
router.get('/api/sports/live-events', async (req: Request, res: Response) => {
    try {
        const force = req.query.refresh === '1';
        const events = await getTimLiveEvents(force);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json({
            status: 'success',
            count: events.length,
            events
        });
    } catch (e: any) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// All TimStreams (categories, channels, live events)
router.get('/api/sports/timstreams', async (req: Request, res: Response) => {
    try {
        const force = req.query.refresh === '1';
        const data = await getAllTimStreams(force);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json({
            status: 'success',
            data
        });
    } catch (e: any) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

async function getProxyStreamsList(): Promise<any[]> {
    const list: any[] = [];
    const seen = new Set<string>();

    const add = (c: any) => {
        if (!c || !c.channel_id || seen.has(c.channel_id)) return;
        seen.add(c.channel_id);
        const resolvedUrl = `/live.php?token=STALKER_PRO&id=${c.channel_id}`;
        list.push({
            channel_id: c.channel_id,
            stream_url: resolvedUrl,
            url: resolvedUrl,
            name: c.name,
            genre: c.genre || 'Proxy Streams',
            logo: c.logo || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150',
            source: c.source || 'dlhd',
            isProxyStream: true
        });
    };

    // TimStreams Live Events
    try {
        const liveEvents = await getTimLiveEvents();
        if (Array.isArray(liveEvents)) {
            liveEvents.forEach((ev: any) => {
                if (ev.url) {
                    const bestStream = (ev.streams && ev.streams[0]) ? ev.streams[0].embedSlug : ev.url;
                    add({
                        channel_id: 'tim_' + bestStream,
                        name: '🔴 ' + (ev.name || '').replace(/&amp;/g, '&') + (ev.category ? ` (${ev.category})` : ''),
                        genre: 'Live Events',
                        logo: ev.logo || 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/tv.svg',
                        source: 'tim_events'
                    });
                }
            });
        }
    } catch (e: any) {}

    // TimStreams Channels
    try {
        const timChannels = await getTimChannels();
        if (Array.isArray(timChannels)) {
            timChannels.forEach((c: any) => {
                const slug = c.url;
                if (slug) {
                    add({
                        channel_id: 'tim_' + slug,
                        stream_url: 'tim_' + slug,
                        name: '⚡ ' + (c.name || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'") + ' (TimStreams)',
                        genre: 'Proxy Streams',
                        logo: c.logo || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150',
                        source: 'timstreams'
                    });
                }
            });
        }
    } catch (e: any) {}

    const curatedProxyStreams = [
        { id: 'dlhd-sky-sports-main-event', name: '⚡ Sky Sports Main Event (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/ae/Sky_Sports_Main_Event_logo.svg/512px-Sky_Sports_Main_Event_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-sky-sports-premier-league', name: '⚡ Sky Sports Premier League (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/6/6b/Sky_Sports_Premier_League_logo.svg/512px-Sky_Sports_Premier_League_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-sky-sports-football', name: '⚡ Sky Sports Football (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/c/cb/Sky_Sports_Football_logo.svg/512px-Sky_Sports_Football_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-sky-sports-f1', name: '⚡ Sky Sports F1 (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/08/Sky_Sports_F1_logo.svg/512px-Sky_Sports_F1_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-sky-sports-cricket', name: '⚡ Sky Sports Cricket (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e0/Sky_Sports_Cricket_logo.svg/512px-Sky_Sports_Cricket_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-tnt-sports-1', name: '⚡ TNT Sports 1 (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/TNT_Sports_1.svg/512px-TNT_Sports_1.svg.png', source: 'dlhd' },
        { id: 'dlhd-tnt-sports-2', name: '⚡ TNT Sports 2 (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/87/TNT_Sports_2.svg/512px-TNT_Sports_2.svg.png', source: 'dlhd' },
        { id: 'dlhd-tnt-sports-3', name: '⚡ TNT Sports 3 (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4e/TNT_Sports_3.svg/512px-TNT_Sports_3.svg.png', source: 'dlhd' },
        { id: 'dlhd-tnt-sports-4', name: '⚡ TNT Sports 4 (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/84/TNT_Sports_4.svg/512px-TNT_Sports_4.svg.png', source: 'dlhd' },
        { id: 'dlhd-bein-sports-1', name: '⚡ beIN Sports 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/BeIN_Sports_1_logo.svg/512px-BeIN_Sports_1_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-bein-sports-2', name: '⚡ beIN Sports 2 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/BeIN_Sports_2_logo.svg/512px-BeIN_Sports_2_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-espn', name: '⚡ ESPN USA HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/ESPN_logo.svg/512px-ESPN_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-espn2', name: '⚡ ESPN 2 USA HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/ESPN2_logo.svg/512px-ESPN2_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-fox-sports-1', name: '⚡ Fox Sports 1 (FS1) (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Fox_Sports_1_logo.svg/512px-Fox_Sports_1_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-fox-sports-2', name: '⚡ Fox Sports 2 (FS2) (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Fox_Sports_2_logo.svg/512px-Fox_Sports_2_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-dazn-1', name: '⚡ DAZN 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/DAZN_Logo.svg/512px-DAZN_Logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-willow-hd', name: '⚡ Willow Cricket HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/6/69/Willow_logo.png/512px-Willow_logo.png', source: 'dlhd' },
        { id: 'dlhd-sony-ten-1', name: '⚡ Sony Ten 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/df/Sony_Ten_1.svg/512px-Sony_Ten_1.svg.png', source: 'dlhd' },
        { id: 'dlhd-sony-ten-2', name: '⚡ Sony Ten 2 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/23/Sony_Ten_2.svg/512px-Sony_Ten_2.svg.png', source: 'dlhd' },
        { id: 'dlhd-sony-six', name: '⚡ Sony Sports Ten 5 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f6/Sony_Sports_Ten_5_logo.png/512px-Sony_Sports_Ten_5_logo.png', source: 'dlhd' },
        { id: 'dlhd-star-sports-1', name: '⚡ Star Sports 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/25/Star_Sports_1.svg/512px-Star_Sports_1.svg.png', source: 'dlhd' },
        { id: 'dlhd-star-sports-hindi', name: '⚡ Star Sports 1 Hindi (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/07/Star_Sports_Hindi_1.svg/512px-Star_Sports_Hindi_1.svg.png', source: 'dlhd' },
        { id: 'dlhd-star-sports-select-1', name: '⚡ Star Sports Select 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/87/Star_Sports_Select_1.svg/512px-Star_Sports_Select_1.svg.png', source: 'dlhd' },
        { id: 'dlhd-sports18-1', name: '⚡ Sports18 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Sports18_1_logo.svg/512px-Sports18_1_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-eurosport-1', name: '⚡ Eurosport 1 HD (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Eurosport_1_logo.svg/512px-Eurosport_1_logo.svg.png', source: 'dlhd' },
        { id: 'dlhd-wwe-network', name: '⚡ WWE Network Live 24/7 (DLHD)', genre: 'Proxy Streams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/WWE_Network_Logo.svg/512px-WWE_Network_Logo.svg.png', source: 'dlhd' },
        { id: 'embed-247-willow-2', name: '⚡ Willow 2 (Embed)', genre: 'Cricket', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/6/69/Willow_logo.png/512px-Willow_logo.png', source: 'embed' }
    ];

    curatedProxyStreams.forEach(c => {
        add({
            channel_id: c.id,
            name: c.name,
            genre: c.genre,
            logo: c.logo,
            source: c.source
        });
    });

    return list;
}

export default router;
