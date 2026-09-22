import { GoogleGenAI } from '@google/genai';

/**
 * Lazy initialization of GoogleGenAI client
 */
let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY;
    if (!apiKey) return null;
    if (!aiClient) {
        aiClient = new GoogleGenAI({ apiKey });
    }
    return aiClient;
}

export interface AiContainerResult {
    title: string;
    subtitle: string;
    badge: string;
    bgUrl: string;
    playerPng: string;
    gridBgUrl: string;
    gridStyle: 'shelf' | 'grid' | 'glass_cards' | 'compact_chips' | 'spotlight';
    keywords: string[];
    webSearchQueries?: string[];
    sources?: Array<{ title?: string; uri?: string }>;
}

/**
 * Generates an intelligent Sports Container with Google Web Search Grounding
 */
export async function generateContainerWithWebSearch(prompt: string, availableChannels: any[] = []): Promise<AiContainerResult> {
    const channelNames = availableChannels.slice(0, 50).map(c => c.title || c.name).filter(Boolean);
    
    // Default fallback in case API key is missing or network failure
    const pLower = prompt.toLowerCase();
    const fallbackResult: AiContainerResult = {
        title: prompt.toUpperCase(),
        subtitle: "Curated high-speed sports broadcasts and live event multi-cam streams.",
        badge: "AI SHOWCASE",
        bgUrl: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1920&auto=format&fit=crop",
        playerPng: "https://pngimg.com/d/football_player_PNG11.png",
        gridBgUrl: "",
        gridStyle: "grid",
        keywords: pLower.split(/\s+/).filter(w => w.length > 2)
    };

    if (pLower.includes('cricket') || pLower.includes('ipl') || pLower.includes('icc') || pLower.includes('t20')) {
        fallbackResult.title = fallbackResult.title.includes('CRICKET') ? fallbackResult.title : `${fallbackResult.title} · CRICKET LIVE`;
        fallbackResult.badge = "LIVE CRICKET";
        fallbackResult.subtitle = "Official stadium feeds, dugout Hindi & English commentary, 4K multi-cam coverage.";
        fallbackResult.bgUrl = "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1920&auto=format&fit=crop";
        fallbackResult.playerPng = "https://pngimg.com/d/cricket_PNG10.png";
        fallbackResult.gridStyle = "shelf";
        fallbackResult.keywords = ['cricket', 'ipl', 'star', 'willow', 'icc', 'sky'];
    } else if (pLower.includes('football') || pLower.includes('soccer') || pLower.includes('champions') || pLower.includes('premier') || pLower.includes('laliga')) {
        fallbackResult.title = fallbackResult.title.includes('FOOTBALL') ? fallbackResult.title : `${fallbackResult.title} · LIVE ARENA`;
        fallbackResult.badge = "CHAMPIONS LEAGUE";
        fallbackResult.subtitle = "Ultra HD 60FPS coverage, tactical broadcast angles, and live match stats.";
        fallbackResult.bgUrl = "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1920&auto=format&fit=crop";
        fallbackResult.playerPng = "https://pngimg.com/d/football_player_PNG95.png";
        fallbackResult.gridStyle = "grid";
        fallbackResult.keywords = ['football', 'soccer', 'champions', 'premier', 'laliga', 'bein', 'tnt'];
    } else if (pLower.includes('f1') || pLower.includes('racing') || pLower.includes('grand prix')) {
        fallbackResult.title = fallbackResult.title.includes('F1') ? fallbackResult.title : `${fallbackResult.title} · F1 GRAND PRIX`;
        fallbackResult.badge = "F1 SPEEDWAY";
        fallbackResult.subtitle = "Cockpit onboards, team radio channels, live telemetry timing, and pitlane feeds.";
        fallbackResult.bgUrl = "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?q=80&w=1920&auto=format&fit=crop";
        fallbackResult.playerPng = "https://pngimg.com/d/formula_1_PNG27.png";
        fallbackResult.gridStyle = "glass_cards";
        fallbackResult.keywords = ['f1', 'racing', 'grand prix', 'sky', 'speed'];
    } else if (pLower.includes('ufc') || pLower.includes('boxing') || pLower.includes('fight')) {
        fallbackResult.title = fallbackResult.title.includes('FIGHT') ? fallbackResult.title : `${fallbackResult.title} · FIGHT NIGHT`;
        fallbackResult.badge = "OCTAGON LIVE";
        fallbackResult.subtitle = "Main championship cards, preliminary bouts, corner audio streams, and blow-by-blow feeds.";
        fallbackResult.bgUrl = "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=1920&auto=format&fit=crop";
        fallbackResult.playerPng = "https://pngimg.com/d/boxing_PNG82.png";
        fallbackResult.gridStyle = "compact_chips";
        fallbackResult.keywords = ['ufc', 'fight', 'combat', 'boxing', 'mma'];
    } else if (pLower.includes('nba') || pLower.includes('basketball')) {
        fallbackResult.title = fallbackResult.title.includes('NBA') ? fallbackResult.title : `${fallbackResult.title} · NBA SHOWDOWN`;
        fallbackResult.badge = "COURTSIDE LIVE";
        fallbackResult.subtitle = "Courtside 4K camera feeds, rim mic sound, and high-flying playoff action.";
        fallbackResult.bgUrl = "https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1920&auto=format&fit=crop";
        fallbackResult.playerPng = "https://pngimg.com/d/basketball_player_PNG41.png";
        fallbackResult.gridStyle = "spotlight";
        fallbackResult.keywords = ['nba', 'basketball', 'espn'];
    }

    const ai = getGeminiClient();
    if (!ai) {
        return fallbackResult;
    }

    try {
        const systemInstruction = `You are an elite Sports Broadcast & Streaming Showcase Curator.
Your task is to analyze user requests for sports/event channels and search the web using Google Search to discover real-time live events, team logos, stadium visual themes, and channel mappings.
Always output a strictly valid JSON object matching the requested schema.`;

        const userPrompt = `Search the web for real-time information regarding: "${prompt}".
Identify current tournaments, team rosters, official stadium broadcast backgrounds, star athlete cutouts, and keywords.

Available channels in database: ${JSON.stringify(channelNames.slice(0, 30))}

Respond with ONLY a valid JSON object matching this exact TypeScript structure:
{
  "title": "Short punchy uppercase title (e.g. ICC T20 WORLD CUP 2026)",
  "subtitle": "Informative 1-2 sentence subtitle about the live coverage",
  "badge": "2-3 word uppercase badge (e.g. 4K ULTRA HD / WORLD FINALS)",
  "bgUrl": "Direct high-res Unsplash or official stadium background image URL (e.g. https://images.unsplash.com/...)",
  "playerPng": "Direct high quality transparent athlete cutout PNG (or pngimg.com URL)",
  "gridBgUrl": "Optional subtle background texture URL or empty string",
  "gridStyle": "shelf" | "grid" | "glass_cards" | "compact_chips" | "spotlight",
  "keywords": ["array", "of", "matching", "channel", "name", "keywords"]
}`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: userPrompt,
            config: {
                systemInstruction: systemInstruction,
                tools: [{ googleSearch: {} }],
                responseMimeType: 'application/json'
            }
        });

        const text = response.text || '';
        const searchMetadata = response.candidates?.[0]?.groundingMetadata;
        const webSearchQueries = searchMetadata?.webSearchQueries || [];
        const sources = searchMetadata?.groundingChunks?.map(chunk => ({
            title: chunk.web?.title,
            uri: chunk.web?.uri
        })).filter(s => s.uri) || [];

        if (text) {
            const parsed = JSON.parse(text);
            return {
                title: parsed.title || fallbackResult.title,
                subtitle: parsed.subtitle || fallbackResult.subtitle,
                badge: parsed.badge || fallbackResult.badge,
                bgUrl: parsed.bgUrl || fallbackResult.bgUrl,
                playerPng: parsed.playerPng || fallbackResult.playerPng,
                gridBgUrl: parsed.gridBgUrl || fallbackResult.gridBgUrl,
                gridStyle: ['shelf', 'grid', 'glass_cards', 'compact_chips', 'spotlight'].includes(parsed.gridStyle) 
                    ? parsed.gridStyle 
                    : fallbackResult.gridStyle,
                keywords: Array.isArray(parsed.keywords) && parsed.keywords.length > 0 
                    ? parsed.keywords.map((k: string) => String(k).toLowerCase()) 
                    : fallbackResult.keywords,
                webSearchQueries,
                sources
            };
        }
    } catch (e) {
        console.warn('[AI Service] Gemini Web Search Grounding error, falling back to local heuristic:', e);
    }

    return fallbackResult;
}

/**
 * Intelligent AI Sports Assistant with Live Web Search Grounding
 */
export async function queryAiBroadcastAssistant(query: string): Promise<{
    answer: string;
    webSearchQueries: string[];
    sources: Array<{ title?: string; uri?: string }>;
}> {
    const ai = getGeminiClient();
    if (!ai) {
        return {
            answer: `AI Engine is running in local mode. Please configure GEMINI_API_KEY in settings to unlock real-time Google Web Search Grounding for "${query}".`,
            webSearchQueries: [],
            sources: []
        };
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: `The user is asking: "${query}".
Search the web for up-to-the-minute sports schedules, live match fixtures, official broadcasters (Sky Sports, Star Sports, Sony Sports, TNT Sports, ESPN, beIN Sports), team lineups, and streaming options.
Provide a concise, highly structured, and accurate response formatted with clear Markdown headers and bullet points.`,
            config: {
                systemInstruction: "You are the Stalker Pro AI Sports Broadcast Intelligence Assistant. You provide real-time fixture dates, timings, official TV network broadcast channels, and streaming insights grounded with live web search.",
                tools: [{ googleSearch: {} }]
            }
        });

        const searchMetadata = response.candidates?.[0]?.groundingMetadata;
        const webSearchQueries = searchMetadata?.webSearchQueries || [];
        const sources = searchMetadata?.groundingChunks?.map(chunk => ({
            title: chunk.web?.title,
            uri: chunk.web?.uri
        })).filter(s => s.uri) || [];

        return {
            answer: response.text || "No response generated.",
            webSearchQueries,
            sources
        };
    } catch (e: any) {
        return {
            answer: `Unable to complete web search: ${e.message || String(e)}`,
            webSearchQueries: [],
            sources: []
        };
    }
}
