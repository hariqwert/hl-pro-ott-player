# Guide: Fetching M3U Playlists for "Time Stream" (145 Sports Channels)

This guide provides full details on how to fetch and generate an M3U playlist specifically for the 145 live sports channels typically associated with the "Time Stream" (or similar sports IPTV scrapers/APIs like Time4TV or DaddyLive). 

When working with these specialized sports streaming directories, the channels are usually scraped from a central source that maintains exactly 145 (or similar) dedicated 24/7 sports channels.

## 1. How the "145 Channels" Source Works
These sports sources generally don't provide a direct `.m3u` file that you can plug into a player. Instead, they provide a web portal or a JSON endpoint. 
To get a working M3U, you must:
1. **Fetch the Channel List**: Retrieve the list of all 145 channels (names, IDs, logos).
2. **Resolve the Stream URL**: For each channel, hit the specific stream endpoint to extract the underlying `.m3u8` HLS URL.
3. **Generate the M3U**: Combine the channel data and the `.m3u8` URLs into a standard `#EXTM3U` text format.

## 2. Node.js (TypeScript) Implementation

Below is a complete, robust script to fetch the 145 sports channels from a Time Stream-like API/Source and convert it into a playable M3U playlist. You can integrate this into your Express server (e.g., `server.ts`).

### Step 1: Create the M3U Generator Route

Add this route to your Express backend. It fetches the JSON data from the sports stream provider and dynamically builds the M3U file.

```typescript
import axios from 'axios';
import express, { Request, Response } from 'express';
import * as cheerio from 'cheerio'; // If scraping HTML is required instead of JSON

const app = express();

// The base URL of the Time Stream / 145-channel sports provider
const TIME_STREAM_API = 'https://api.example-timestream.com/v1'; 

app.get('/api/m3u/sports-145', async (req: Request, res: Response) => {
    try {
        // 1. Fetch the master list of all 145 sports channels
        // Some APIs return this as a JSON array
        const response = await axios.get(`${TIME_STREAM_API}/channels`);
        const channels = response.data.channels; // Assuming it returns the 145 channels

        if (!channels || channels.length === 0) {
            return res.status(404).send('No channels found.');
        }

        // 2. Start building the standard M3U Playlist header
        let m3uPlaylist = '#EXTM3U x-tvg-url=""\\n';

        // 3. Loop through the 145 channels and map them
        for (const channel of channels) {
            const channelId = channel.id;
            const channelName = channel.name || 'Unknown Sports Channel';
            const channelLogo = channel.logo_url || '';
            const channelGroup = channel.category || 'Live Sports';

            // Optional: If the API requires a secondary request to get the m3u8 URL
            // you can fetch it here. For performance on 145 channels, it's better if 
            // the initial API call returns the stream URLs directly, or if you format 
            // a predictable stream URL.
            
            // Example of a predictable stream URL format:
            const streamUrl = `${TIME_STREAM_API}/live/${channelId}/playlist.m3u8`;

            // 4. Append the channel metadata and stream URL to the M3U string
            m3uPlaylist += `#EXTINF:-1 tvg-id="${channelId}" tvg-logo="${channelLogo}" group-title="${channelGroup}", ${channelName}\\n`;
            m3uPlaylist += `${streamUrl}\\n`;
        }

        // 5. Serve the response as a downloadable/playable M3U file
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Content-Disposition', 'attachment; filename="time_stream_145.m3u"');
        res.send(m3uPlaylist);

    } catch (error: any) {
        console.error('Error fetching Time Stream 145 channels:', error.message);
        res.status(500).send('Failed to generate sports M3U playlist.');
    }
});
```

## 3. Handling HTML Scraping (If No JSON API Exists)

If the "Time Stream" source does not have a clean JSON API and only offers a website with 145 channels, you must scrape the HTML using `cheerio`.

```typescript
app.get('/api/scrape/sports-145', async (req, res) => {
    try {
        const { data } = await axios.get('https://www.example-timestream.com/channels');
        const $ = cheerio.load(data);
        
        let m3u = '#EXTM3U\\n';
        
        // Assume the 145 channels are inside <li> elements with class "channel-item"
        $('li.channel-item').each((index, element) => {
            const name = $(element).find('.channel-name').text().trim();
            const logo = $(element).find('img').attr('src');
            const streamPath = $(element).find('a.play-btn').attr('href'); // e.g., /watch/123
            
            // Build the M3U8 URL by appending it to your proxy or the direct source
            const m3u8Url = \`https://www.example-timestream.com\${streamPath}/stream.m3u8\`;
            
            m3u += \`#EXTINF:-1 tvg-logo="\${logo}" group-title="Sports", \${name}\\n\`;
            m3u += \`\${m3u8Url}\\n\`;
        });
        
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(m3u);
    } catch (e) {
        res.status(500).send('Scraping failed');
    }
});
```

## 4. Bypassing CORS and Security Tokens

Sports streams are heavily protected. When extracting the `.m3u8` links from these 145 channels, you will often encounter CORS (Cross-Origin Resource Sharing) blocks or token expirations.

To fix this in your app (like Stalker Pro):
1. **Proxy the Streams**: Never send the `time_stream` m3u8 directly to the browser frontend. Instead, route the M3U8 URL through your Node.js proxy (e.g., your `src/proxy.ts` file).
2. **Referer Headers**: When your proxy requests the stream, it MUST pass the correct `Referer` and `User-Agent` headers that belong to the original Time Stream website.
3. **Rewrite the M3U**: In your generated M3U file, change the stream URL to point to your local proxy:
   * **Instead of**: `https://time-stream-source.com/live/ch1.m3u8`
   * **Use**: `http://localhost:3000/api/proxy?url=https://time-stream-source.com/live/ch1.m3u8`

## 5. Performance Optimization (Caching 145 Channels)

Generating the playlist for 145 channels dynamically on every request will cause rate limits. 

**Add a Cache mechanism**:
```typescript
import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.join(__dirname, 'cache_stalker', 'time_stream_145.m3u');
const CACHE_TTL = 60 * 60 * 1000; // 1 Hour

// Before fetching from the API, check if the cache exists and is fresh:
if (fs.existsSync(CACHE_FILE)) {
    const stats = fs.statSync(CACHE_FILE);
    const age = Date.now() - stats.mtimeMs;
    if (age < CACHE_TTL) {
        // Serve from cache
        const cachedM3u = fs.readFileSync(CACHE_FILE, 'utf-8');
        return res.send(cachedM3u);
    }
}
// If not cached or expired, run the fetch logic, generate the M3U, and save to fs.writeFileSync(CACHE_FILE, m3uPlaylist);
```
