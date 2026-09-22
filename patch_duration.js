const fs = require('fs');
let code = fs.readFileSync('src/services/bingrScraperService.ts', 'utf8');

const durationValidatorFunc = `

/**
 * Validates the duration of the M3U8 stream against TMDB expected runtime
 */
export async function verifyStreamDuration(url: string, type: 'movie' | 'tv', tmdbId: number, season?: number, episode?: number): Promise<{ isValid: boolean; expected?: number; actual?: number; reason?: string }> {
    try {
        if (!url || !url.startsWith('http')) return { isValid: true };
        
        let expectedRuntime = 0;
        const apiKey = process.env.TMDB_API_KEY || 'a07e22bc18f5cb106bfe4cc1f83ad8ed';
        
        // 1. Fetch Expected Runtime
        if (type === 'movie') {
            const tmdbRes = await axios.get(\`https://api.themoviedb.org/3/movie/\${tmdbId}?api_key=\${apiKey}\`, { timeout: 3000 });
            expectedRuntime = tmdbRes.data.runtime || 0;
        } else {
            const tmdbRes = await axios.get(\`https://api.themoviedb.org/3/tv/\${tmdbId}/season/\${season}/episode/\${episode}?api_key=\${apiKey}\`, { timeout: 3000 });
            expectedRuntime = tmdbRes.data.runtime || 0;
            if (!expectedRuntime) {
                // Fallback to show-level runtime if episode-level is missing
                const showRes = await axios.get(\`https://api.themoviedb.org/3/tv/\${tmdbId}?api_key=\${apiKey}\`, { timeout: 3000 });
                if (showRes.data.episode_run_time && showRes.data.episode_run_time.length > 0) {
                    expectedRuntime = showRes.data.episode_run_time[0];
                }
            }
        }
        
        if (expectedRuntime <= 0) return { isValid: true }; // Cannot verify
        
        // 2. Fetch Actual Runtime from M3U8
        const actualRuntime = await getM3u8Duration(url);
        if (actualRuntime === null) return { isValid: true }; // Could not fetch M3U8, allow it
        
        // 3. Compare with strict tolerances
        const diff = Math.abs(actualRuntime - expectedRuntime);
        const maxTolerance = expectedRuntime < 40 ? 8 : 15;
        
        if (diff > maxTolerance) {
            return { 
                isValid: false, 
                expected: expectedRuntime, 
                actual: actualRuntime,
                reason: \`Duration mismatch: Expected \${expectedRuntime}m, got \${Math.round(actualRuntime)}m (Tolerance: +/-\${maxTolerance}m)\`
            };
        }
        
        return { isValid: true, expected: expectedRuntime, actual: actualRuntime };
        
    } catch (e: any) {
        // Fallback to allowing stream if validation fails due to network/cors
        return { isValid: true };
    }
}

async function getM3u8Duration(url: string, depth = 0): Promise<number | null> {
    if (depth > 2) return null; // Prevent infinite loops
    try {
        const res = await axios.get(url, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': '*/*'
            }
        });
        const content = res.data;
        if (typeof content !== 'string') return null;

        // Is it a master playlist?
        if (content.includes('#EXT-X-STREAM-INF')) {
            const lines = content.split('\\n');
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
                    let nextLine = lines[i+1]?.trim();
                    if (nextLine && !nextLine.startsWith('#')) {
                        const mediaUrl = nextLine.startsWith('http') ? nextLine : new URL(nextLine, url).toString();
                        return await getM3u8Duration(mediaUrl, depth + 1);
                    }
                }
            }
            return null;
        }

        // Media playlist - sum EXTINF
        const extinfRegex = /#EXTINF:([0-9.]+)/g;
        let match;
        let totalSeconds = 0;
        while ((match = extinfRegex.exec(content)) !== null) {
            totalSeconds += parseFloat(match[1]);
        }
        if (totalSeconds > 0) return totalSeconds / 60; // return minutes
        return null;
    } catch (err: any) {
        return null;
    }
}
`;

// Inject duration validator before scrapeBingrStream
const scrapeStr = 'export async function scrapeBingrStream(';
code = code.replace(scrapeStr, durationValidatorFunc + '\\n' + scrapeStr);

// Inject logic into scrapeBingrStream
const targetReach = `                // Ultra-fast reachability check
                const isReachable = await verifyStreamReachable(candidateUrl, 1800);
                if (!isReachable) {
                    attempts.push({
                        serverId,
                        serverName: serverMeta.name,
                        status: '404_unreachable',
                        latencyMs,
                        error: \`Upstream returned HTTP 404/dead link for \${candidateUrl}\`
                    });
                    return null;
                }`;

const replaceReach = targetReach + `
                
                // Strict Duration Verification
                const durCheck = await verifyStreamDuration(candidateUrl, type, Number(tmdbId), s ? Number(s) : undefined, e ? Number(e) : undefined);
                if (!durCheck.isValid) {
                    attempts.push({
                        serverId,
                        serverName: serverMeta.name,
                        status: 'duration_mismatch',
                        latencyMs,
                        error: durCheck.reason
                    });
                    return null; // Skip this stream because duration doesn't match
                }`;

code = code.replace(targetReach, replaceReach);

fs.writeFileSync('src/services/bingrScraperService.ts', code);
