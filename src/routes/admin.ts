import { syncToFirestore, syncM3uToFirestore, deleteM3uFromFirestore } from "../services/firestoreSyncService";
import axios from "axios";
import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { requireAdmin, JWT_SECRET, getClientIp } from '../middleware/auth';
import { StalkerAPI } from '../stalkerAPI';
import { activeSessions, refreshBlacklist, systemState, systemStatus as globalSystemStatus, notifyVideoBroadcastChanged } from '../../server';
import * as server from '../../server';
import { killAllActiveStreams } from '../proxy';
import { getOrUpdatePlaylist } from './sportsM3u';
import { LogoService } from '../services/logoService';
import { QuarantineService } from '../services/quarantineService';
import { M3uReorganizeService } from '../services/m3uReorganizeService';
import { ChannelJsonService } from '../services/channelJsonService';
import { streamHealthService } from '../services/streamHealthService';
import { generateContainerWithWebSearch, queryAiBroadcastAssistant } from '../services/aiService';
import { scrapeEmbedToM3u8, testM3u8Connectivity, inferChannelMetadata } from '../services/embedScraperService';

const router = Router();

// Protected Storage for M3U playlists
const DARK_SIDE = path.join(process.cwd(), 'doctor_strange');
const LIGHT_SIDE = path.join(process.cwd(), 'cache_stalker');
const M3U_VAULT = path.join(DARK_SIDE, 'm3u_playlists');
const DB_FILE = path.join(DARK_SIDE, 'admin_db.json');
const VIDEO_UPLOADS = path.join(process.cwd(), 'public', 'uploads');

// Ensure directories exist
const TMP_CHUNKS_DIR = path.join(DARK_SIDE, 'tmp_chunks');
[DARK_SIDE, LIGHT_SIDE, M3U_VAULT, VIDEO_UPLOADS, TMP_CHUNKS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Configure Multer for video/m3u file uploads
const videoUploadStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(VIDEO_UPLOADS)) {
            fs.mkdirSync(VIDEO_UPLOADS, { recursive: true });
        }
        cb(null, VIDEO_UPLOADS);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
        const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, `maint_broadcast_${Date.now()}_${cleanBase}${ext}`);
    }
});

const uploadVideoMiddleware = multer({
    storage: videoUploadStorage,
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB max
});

// Configure Multer for video chunks (50MB max per chunk)
const chunkUploadStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadId = (req.body.uploadId || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
        const targetDir = path.join(TMP_CHUNKS_DIR, uploadId);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        cb(null, targetDir);
    },
    filename: (req, file, cb) => {
        const chunkIndex = parseInt(req.body.chunkIndex, 10) || 0;
        cb(null, `chunk_${chunkIndex}`);
    }
});

const uploadChunkMiddleware = multer({
    storage: chunkUploadStorage,
    limits: { fileSize: 50 * 1024 * 1024 }
});

// Admin DB interface
interface Portal {
    id: string;
    name: string;
    url: string;
    mac?: string;
    model?: string;
    username?: string;
    password?: string;
    type?: 'stalker' | 'xtream';
    isDefault: boolean;
}

interface M3UPlaylist {
    id: string;
    name: string;
    filePath: string;
    uploadedAt: string;
    isActive: boolean;
    channelsCount: number;
}

interface SecurityIncident {
    ip: string;
    username: string;
    timestamp: number;
    reason: string;
}

export interface SportsSection {
    id: string;
    title: string;
    icon: string;
    url: string;
    bgUrl?: string;
    containerId?: string;
    addedAt: string;
}

export interface SportsContainer {
    id: string;
    title: string;
    subtitle?: string;
    badge?: string;
    bgUrl?: string;
    playerPng?: string;
    gridBgUrl?: string;
    gridStyle?: 'shelf' | 'grid' | 'glass_cards' | 'compact_chips' | 'spotlight';
    cardBg?: string;
    enabled?: boolean;
    order?: number;
    createdAt?: string;
}

interface SportsM3UPlaylist {
    id: string;
    name: string;
    url?: string;
    addedAt: string;
}

export interface SportsHubConfig {
    title?: string;
    subtitle?: string;
    badge?: string;
    bgUrl?: string;
    playerPng?: string;
    gridBgUrl?: string;
    displayMode?: 'shelf' | 'grid' | 'glass_cards' | 'compact_chips' | 'spotlight';
}

interface AdminDB {
    backgrounds?: {
        hero?: { type: string, url: string };
        consumet?: { type: string, url: string };
        music?: { type: string, url: string };
        index?: { type: string, url: string };
        globalAudio?: { type: string, url: string, title?: string, artist?: string, thumbnail?: string };
        musicUseSongVideo?: boolean;
    };
    portals: Portal[];
    m3uPlaylists: M3UPlaylist[];
    sports?: SportsSection[];
    sportsContainers?: SportsContainer[];
    sportsM3uFiles?: SportsM3UPlaylist[];
    sportsHubConfig?: SportsHubConfig;
    customScrapedChannels?: any[];
    liveEvents?: SportsSection[];
    maintenanceMode: boolean;
    maintenanceAdminBypass?: boolean;
    maintenanceSchedule?: {
        enabled: boolean;
        scheduledTime: string;
        durationMinutes: number;
        noticeText: string;
        autoActivate: boolean;
};
    consumetMaintenance?: boolean;
    playMaintenance?: boolean;
    playConsumetMaintenance?: boolean;
    activeTemplate: string;
    maintenanceTitle?: string;
    maintenanceText?: string;
    maintenanceMusicMode?: 'query' | 'random' | 'playlist';
    maintenanceMusicQuery?: string;
    maintenanceMusicPlaylist?: any[];
    maintenanceVideoEnabled?: boolean;
    maintenanceVideoType?: 'auto' | 'youtube' | 'direct' | 'hls' | 'm3u' | 'twitter' | 'facebook' | 'iframe' | 'local' | 'webrtc';
    maintenanceVideoUrl?: string;
    maintenanceVideoTitle?: string;
    maintenanceVideoSubtitle?: string;
    maintenanceVideoAutoplay?: boolean;
    maintenanceVideoMuted?: boolean;
    maintenanceVideoLoop?: boolean;
    maintenanceVideoUploadedFile?: string;
    blacklist?: string[];
    incidents?: SecurityIncident[];
    systemStatus?: 'active' | 'offline';
    developerMode?: boolean;
    allowedDeveloperIps?: string[];
    siteLockMode?: boolean;
    siteLockPassword?: string;
    siteLockTitle?: string;
    siteLockMessage?: string;
    siteLockHint?: string;
    admin2faPin?: string;
    features?: {
        m3uEnabled: boolean;
        stalkerEnabled: boolean;
        firewallEnabled: boolean;
        publicPlaylistEnabled: boolean;
    };
}

// In-memory tracker for failed attempts (per session)
const loginFailures = new Map<string, number>();
const gateFailures = new Map<string, number>();

/**
 * Load or initialize the admin DB.
 */
function getDB(): AdminDB {
    if (!fs.existsSync(DB_FILE)) {
        const initial: AdminDB = {
            portals: [],
            m3uPlaylists: [],
            sports: [],
            sportsM3uFiles: [],
            liveEvents: [],
            maintenanceMode: false,
            activeTemplate: 'Scheduled Downtime',
            blacklist: [],
            incidents: [],
            systemStatus: 'active',
            features: {
                m3uEnabled: true,
                stalkerEnabled: true,
                firewallEnabled: true,
                publicPlaylistEnabled: true
            }
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 4), 'utf8');
        return initial;
    }
    try {
        const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        // Sync with any existing stalker portals if our db has none
        if ((!data.portals || data.portals.length === 0)) {
            data.portals = scanExistingStalkerPortals();
            fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 4), 'utf8');
        }
        return {
            ...data,
            portals: data.portals || [],
            m3uPlaylists: data.m3uPlaylists || [],
            sports: data.sports || [],
            sportsContainers: data.sportsContainers || [],
            sportsM3uFiles: data.sportsM3uFiles || [],
            liveEvents: data.liveEvents || [],
            maintenanceMode: !!data.maintenanceMode,
        maintenanceAdminBypass: data.maintenanceAdminBypass || false,
            activeTemplate: data.activeTemplate || 'Scheduled Downtime',
            blacklist: data.blacklist || [],
            incidents: data.incidents || [],
            systemStatus: data.systemStatus || 'active',
            developerMode: !!data.developerMode,
            allowedDeveloperIps: data.allowedDeveloperIps || [],
            maintenanceSchedule: data.maintenanceSchedule || {
                enabled: false,
                scheduledTime: '',
                durationMinutes: 60,
                noticeText: 'Scheduled system maintenance for network & server upgrades.',
                autoActivate: true
            },
            features: data.features || {
                m3uEnabled: true,
                stalkerEnabled: true,
                firewallEnabled: true,
                publicPlaylistEnabled: true
            }
        };
    } catch (e) {
        console.error("[CRITICAL] Failed to parse admin_db.json. Returning cached or blank DB to prevent overwrite.", e);
        // Instead of returning a pure blank DB that will immediately overwrite everything on the next save,
        // we should try to return something safe, or throw. But to keep types happy:
        return {
            portals: [],
            m3uPlaylists: [],
            sports: [],
            sportsM3uFiles: [],
            liveEvents: [],
            maintenanceMode: false,
            activeTemplate: 'Scheduled Downtime',
            blacklist: [],
            features: {
                m3uEnabled: true,
                stalkerEnabled: true,
                firewallEnabled: true,
                publicPlaylistEnabled: true
            }
        };
    }
}

function saveDB(db: AdminDB) {
    const tmpFile = DB_FILE + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 4), 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
    syncToFirestore(db).catch((e: any) => console.error("Firestore sync error:", e));
}

/**
 * Helper to scan existing portal json files in doctor_strange.
 */
function scanExistingStalkerPortals(): Portal[] {
    const portals: Portal[] = [];
    const files = fs.readdirSync(DARK_SIDE);
    const systemFiles = ['genre.json', 'iptv_logo_map.json', 'm3u_playlists.json', 'favorites.json', 'recents.json', 'multiverse.log', 'login.stalker', 'token.stalker', 'active_playlist_id.txt', 'admin_db.json'];
    
    // Check if there is an active login file to see what is default
    let activeHost = '';
    const loginFile = path.join(DARK_SIDE, 'login.stalker');
    if (fs.existsSync(loginFile)) {
        try {
            const activeLogin = JSON.parse(fs.readFileSync(loginFile, 'utf8'));
            if (activeLogin?.URL) {
                activeHost = new URL(activeLogin.URL).host;
            }
        } catch (e) {}
    }

    for (const file of files) {
        if (systemFiles.includes(file)) continue;
        if (file.startsWith('m3u_channels_')) continue;
        if (file.startsWith('favorites_')) continue;
        if (file.startsWith('recents_')) continue;
        if (!file.endsWith('.json')) continue;

        try {
            const data = JSON.parse(fs.readFileSync(path.join(DARK_SIDE, file), 'utf8'));
            if (data && data.URL) {
                const host = new URL(data.URL).host;
                let portalType = data.type;
                if (!portalType) {
                    portalType = !!(data.username && data.password && !data.MAC) ? 'xtream' : 'stalker';
                }
                
                portals.push({
                    id: path.basename(file, '.json'),
                    name: data.Name || host,
                    url: data.URL,
                    type: portalType,
                    username: data.username || '',
                    password: data.password || '',
                    mac: data.MAC || '',
                    model: data.Model || 'MAG250',
                    isDefault: host === activeHost
                });
            }
        } catch (e) {}
    }
    return portals;
}

// Multer Config
const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.m3u' || ext === '.m3u8') {
        cb(null, true);
    } else {
        cb(new Error('Invalid File Type: Only .m3u and .m3u8 files are allowed.'), false);
    }
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, M3U_VAULT);
    },
    filename: (req, file, cb) => {
        const hash = crypto.createHash('md5').update(file.originalname + Date.now()).digest('hex').substring(0, 8);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `playlist-${hash}${ext}`);
    }
});

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024,  // 100MB max file
        fieldSize: 100 * 1024 * 1024, // 100MB max text fields (e.g. pasted M3U text in FormData)
        fields: 100,
        files: 10
    }
});

// Safe upload wrapper that catches multer errors (like file limits, field sizes) and returns JSON
const safeUploadSingle = (fieldName: string) => {
    const uploader = upload.single(fieldName);
    return (req: Request, res: Response, next: NextFunction) => {
        uploader(req, res, (err: any) => {
            if (err) {
                console.error('[!] Multer upload error:', err);
                if (err instanceof multer.MulterError) {
                    return res.status(400).json({
                        status: "error",
                        message: `Upload Error (${err.code}): ${err.message}`
                    });
                }
                return res.status(400).json({
                    status: "error",
                    message: err.message || "Failed to process uploaded file or form data."
                });
            }
            next();
        });
    };
};

// --- ADMIN API ENDPOINTS ---

// GET /features - Get feature access states

// GET /backgrounds
router.get('/backgrounds', requireAdmin, (req: Request, res: Response) => {
    const db = getDB();
    res.json({
        status: "success",
        backgrounds: db.backgrounds || { hero: '', consumet: '', music: '', index: '', musicUseSongVideo: true }
    });
});

// POST /backgrounds
router.post('/backgrounds', requireAdmin, (req: Request, res: Response) => {
    const db = getDB();
    db.backgrounds = db.backgrounds || {};
    
    if (req.body.hero !== undefined) db.backgrounds.hero = req.body.hero;
    if (req.body.consumet !== undefined) db.backgrounds.consumet = req.body.consumet;
    if (req.body.music !== undefined) db.backgrounds.music = req.body.music;
    if (req.body.index !== undefined) db.backgrounds.index = req.body.index;
    if (req.body.globalAudio !== undefined) db.backgrounds.globalAudio = req.body.globalAudio;
    if (req.body.musicUseSongVideo !== undefined) db.backgrounds.musicUseSongVideo = !!req.body.musicUseSongVideo;
    
    saveDB(db);
    res.json({
        status: "success",
        message: "Backgrounds updated successfully.",
        backgrounds: db.backgrounds
    });
});

router.get('/features', requireAdmin, (req: Request, res: Response) => {
    const db = getDB();
    res.json({
        status: "success",
        features: db.features
    });
});

// POST /features - Update feature access states
router.post('/features', requireAdmin, (req: Request, res: Response) => {
    const { m3uEnabled, stalkerEnabled, firewallEnabled, publicPlaylistEnabled } = req.body;
    const db = getDB();
    
    if (db.features) {
        if (m3uEnabled !== undefined) db.features.m3uEnabled = !!m3uEnabled;
        if (stalkerEnabled !== undefined) db.features.stalkerEnabled = !!stalkerEnabled;
        if (firewallEnabled !== undefined) db.features.firewallEnabled = !!firewallEnabled;
        if (publicPlaylistEnabled !== undefined) db.features.publicPlaylistEnabled = !!publicPlaylistEnabled;
    } else {
        db.features = {
            m3uEnabled: m3uEnabled !== undefined ? !!m3uEnabled : true,
            stalkerEnabled: stalkerEnabled !== undefined ? !!stalkerEnabled : true,
            firewallEnabled: firewallEnabled !== undefined ? !!firewallEnabled : true,
            publicPlaylistEnabled: publicPlaylistEnabled !== undefined ? !!publicPlaylistEnabled : true
        };
    }
    
    saveDB(db);
    res.json({
        status: "success",
        message: "Feature access settings updated successfully.",
        features: db.features
    });
});

// GET /analytics - Real-time server bandwidth, active streams, and top media telemetry
router.get('/analytics', requireAdmin, (req: Request, res: Response) => {
    try {
        const analytics = server.getAnalyticsData();
        res.json({
            status: "success",
            analytics
        });
    } catch (e: any) {
        res.status(500).json({ status: "error", message: e?.message || "Failed to fetch analytics" });
    }
});

// GET /stats - System overview statistics
router.get('/stats', requireAdmin, (req: Request, res: Response) => {
    const db = getDB();
    const activePortal = db.portals.find(p => p.isDefault);
    
    // Count M3U Channels
    let m3uChannelsCount = 0;
    db.m3uPlaylists.forEach(pl => {
        const channelsFile = path.join(DARK_SIDE, `m3u_channels_${pl.id}.json`);
        if (fs.existsSync(channelsFile)) {
            try {
                const channels = JSON.parse(fs.readFileSync(channelsFile, 'utf8'));
                m3uChannelsCount += channels.length;
            } catch (e) {}
        }
    });

    res.json({
        status: "success",
        stats: {
            totalPortals: db.portals.length,
            totalM3U: db.m3uPlaylists.length,
            totalBlacklisted: (db.blacklist || []).length,
            totalIncidents: (db.incidents || []).length,
            activeSessions: activeSessions.size,
            activePortal: activePortal ? activePortal.name : 'None',
            m3uChannels: m3uChannelsCount,
            systemStatus: db.systemStatus || 'active'
        }
    });
});

// POST /system/clear-cache - Purge Stalker API cache
router.post('/system/clear-cache', requireAdmin, (req: Request, res: Response) => {
    const cacheDir = path.join(process.cwd(), 'cache_stalker');
    if (fs.existsSync(cacheDir)) {
        const files = fs.readdirSync(cacheDir);
        let deletedCount = 0;
        files.forEach(file => {
            if (file !== 'index.php') {
                fs.unlinkSync(path.join(cacheDir, file));
                deletedCount++;
            }
        });
        return res.json({
            status: "success",
            message: `Successfully purged ${deletedCount} cached files. API is now fresh.`
        });
    }
    res.json({ status: "error", message: "Cache directory not found." });
});

/**
 * --- MONITOR & FIREWALL ENDPOINTS ---
 */

// POST /system/cleanup - Deep clean system artifacts
router.post('/system/cleanup', requireAdmin, (req: Request, res: Response) => {
    try {
        const type = req.body.type;
        const cacheDir = path.join(process.cwd(), 'cache_stalker');
        const dataDir = path.join(process.cwd(), 'doctor_strange');

        if (type === 'cache') {
            if (fs.existsSync(cacheDir)) {
                const files = fs.readdirSync(cacheDir);
                for (const file of files) {
                    if (file !== '.htaccess' && file !== 'index.php') {
                        const fullPath = path.join(cacheDir, file);
                        if (fs.lstatSync(fullPath).isDirectory()) {
                            fs.rmSync(fullPath, { recursive: true, force: true });
                        } else {
                            fs.unlinkSync(fullPath);
                        }
                    }
                }
            }
            return res.json({ status: "success", message: "System cache completely purged." });
        } else if (type === 'history') {
            if (fs.existsSync(dataDir)) {
                const files = fs.readdirSync(dataDir);
                for (const file of files) {
                    if (file.startsWith('recents_') && file.endsWith('.json')) {
                        fs.unlinkSync(path.join(dataDir, file));
                    }
                }
            }
            return res.json({ status: "success", message: "Global watch history purged." });
        } else if (type === 'favorites') {
            if (fs.existsSync(dataDir)) {
                const files = fs.readdirSync(dataDir);
                for (const file of files) {
                    if (file.startsWith('favorites_') && file.endsWith('.json')) {
                        fs.unlinkSync(path.join(dataDir, file));
                    }
                }
            }
            return res.json({ status: "success", message: "All user favorites purged." });
        }

        return res.status(400).json({ status: "error", message: "Invalid cleanup type." });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: "Failed to execute cleanup." });
    }
});

// GET /system/status - Get global power status
router.get('/system/status', requireAdmin, (req: Request, res: Response) => {
    const db = getDB();
    res.json({
        status: "success",
        systemStatus: db.systemStatus || 'active'
    });
});


// GET /developer - Developer Mode Settings
router.get('/developer', requireAdmin, (req: Request, res: Response) => {
    const db = getDB();
    res.json({
        status: "success",
        developerMode: db.developerMode || false,
        allowedDeveloperIps: db.allowedDeveloperIps || []
    });
});

// POST /developer - Update Developer Mode Settings
router.post('/developer', requireAdmin, (req: Request, res: Response) => {
    const db = getDB();
    const { developerMode } = req.body;
    db.developerMode = !!developerMode;
    saveDB(db);
    refreshBlacklist();
    res.json({ status: "success", message: "Developer mode updated", developerMode: db.developerMode });
});

// POST /developer/whitelist - Add IP to developer whitelist
router.post('/developer/whitelist', requireAdmin, (req: Request, res: Response) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ status: "error", message: "IP required" });

    const db = getDB();
    if (!db.allowedDeveloperIps) db.allowedDeveloperIps = [];
    if (!db.allowedDeveloperIps.includes(ip)) {
        db.allowedDeveloperIps.push(ip);
        saveDB(db);
        refreshBlacklist();
    }
    res.json({ status: "success", message: "IP added to developer whitelist", allowedDeveloperIps: db.allowedDeveloperIps });
});

// DELETE /developer/whitelist - Remove IP from developer whitelist
router.delete('/developer/whitelist', requireAdmin, (req: Request, res: Response) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ status: "error", message: "IP required" });

    const db = getDB();
    if (db.allowedDeveloperIps) {
        db.allowedDeveloperIps = db.allowedDeveloperIps.filter(i => i !== ip);
        saveDB(db);
        refreshBlacklist();
    }
    res.json({ status: "success", message: "IP removed from developer whitelist", allowedDeveloperIps: db.allowedDeveloperIps || [] });
});

// GET /lock-mode - Get Site Lock Mode Settings
router.get('/lock-mode', requireAdmin, (req: Request, res: Response) => {
    const db = getDB();
    res.json({
        status: "success",
        siteLockMode: !!db.siteLockMode,
        siteLockPassword: db.siteLockPassword || '1857',
        siteLockTitle: db.siteLockTitle || 'RESTRICTED ACCESS PORTAL',
        siteLockMessage: db.siteLockMessage || 'This site is currently protected by Quantum Lock. Enter the authorized PIN or Password to access.',
        siteLockHint: db.siteLockHint || ''
    });
});

// POST /lock-mode - Update Site Lock Mode Settings
router.post('/lock-mode', requireAdmin, (req: Request, res: Response) => {
    const db = getDB();
    const { siteLockMode, siteLockPassword, siteLockTitle, siteLockMessage, siteLockHint } = req.body;
    
    db.siteLockMode = !!siteLockMode;
    if (siteLockPassword !== undefined) db.siteLockPassword = String(siteLockPassword).trim();
    if (siteLockTitle !== undefined) db.siteLockTitle = String(siteLockTitle).trim();
    if (siteLockMessage !== undefined) db.siteLockMessage = String(siteLockMessage).trim();
    if (siteLockHint !== undefined) db.siteLockHint = String(siteLockHint).trim();

    saveDB(db);

    // Sync directly to live memory systemState
    (systemState as any).siteLockMode = db.siteLockMode;
    (systemState as any).siteLockPassword = db.siteLockPassword || '1857';
    (systemState as any).siteLockTitle = db.siteLockTitle || 'RESTRICTED ACCESS PORTAL';
    (systemState as any).siteLockMessage = db.siteLockMessage || 'This site is currently protected by Quantum Lock. Enter the authorized PIN or Password to access.';
    (systemState as any).siteLockHint = db.siteLockHint || '';

    console.warn(`[SYSTEM] SITE LOCK MODE UPDATED BY ADMIN: ${db.siteLockMode ? 'ACTIVE (SYSTEM LOCKED)' : 'INACTIVE (SYSTEM OPEN)'}`);

    res.json({
        status: "success",
        message: `Site Lock Mode is now ${db.siteLockMode ? 'ACTIVE' : 'INACTIVE'}`,
        siteLockMode: db.siteLockMode,
        siteLockPassword: db.siteLockPassword || '1857',
        siteLockTitle: db.siteLockTitle || 'RESTRICTED ACCESS PORTAL',
        siteLockMessage: db.siteLockMessage || 'This site is currently protected by Quantum Lock. Enter the authorized PIN or Password to access.',
        siteLockHint: db.siteLockHint || ''
    });
});

// GET /maintenance - Maintenance Mode
router.get('/maintenance', requireAdmin, (req: Request, res: Response) => {
    const db = getDB();
    res.json({
        status: "success",
        maintenanceMode: db.maintenanceMode || false,
        maintenanceAdminBypass: db.maintenanceAdminBypass || false,
        consumetMaintenance: db.consumetMaintenance || false,
        playMaintenance: db.playMaintenance || false,
        playConsumetMaintenance: db.playConsumetMaintenance || false,
        activeTemplate: db.activeTemplate || 'Scheduled Downtime',
        maintenanceTitle: db.maintenanceTitle || '',
        maintenanceText: db.maintenanceText || '',
        maintenanceMusicMode: db.maintenanceMusicMode || 'query',
        maintenanceMusicQuery: db.maintenanceMusicQuery || 'lofi relax',
        maintenanceMusicPlaylist: db.maintenanceMusicPlaylist || [],
        maintenanceVideoEnabled: db.maintenanceVideoEnabled || false,
        maintenanceVideoType: db.maintenanceVideoType || 'auto',
        maintenanceVideoUrl: db.maintenanceVideoUrl || '',
        maintenanceVideoTitle: db.maintenanceVideoTitle || '',
        maintenanceVideoSubtitle: db.maintenanceVideoSubtitle || '',
        maintenanceVideoAutoplay: db.maintenanceVideoAutoplay !== undefined ? db.maintenanceVideoAutoplay : true,
        maintenanceVideoMuted: db.maintenanceVideoMuted !== undefined ? db.maintenanceVideoMuted : false,
        maintenanceVideoLoop: db.maintenanceVideoLoop !== undefined ? db.maintenanceVideoLoop : true,
        maintenanceVideoUploadedFile: db.maintenanceVideoUploadedFile || '',
        maintenanceSchedule: db.maintenanceSchedule || {
            enabled: false,
            scheduledTime: '',
            durationMinutes: 60,
            noticeText: '',
            autoActivate: true
        }
    });
});

// POST /maintenance - Update Maintenance Mode
router.post('/maintenance', requireAdmin, (req: Request, res: Response) => {
    const db = getDB();
    const { 
        maintenanceMode,
        maintenanceAdminBypass = false, 
        activeTemplate, 
        maintenanceTitle, 
        maintenanceText, 
        maintenanceMusicMode, 
        maintenanceMusicQuery, 
        maintenanceMusicPlaylist, 
        consumetMaintenance, 
        playMaintenance, 
        playConsumetMaintenance,
        maintenanceVideoEnabled,
        maintenanceVideoType,
        maintenanceVideoUrl,
        maintenanceVideoTitle,
        maintenanceVideoSubtitle,
        maintenanceVideoAutoplay,
        maintenanceVideoMuted,
        maintenanceVideoLoop,
        maintenanceVideoUploadedFile,
        // Schedule parameters
        scheduleEnabled,
        scheduledTime,
        durationMinutes,
        scheduleNoticeText,
        scheduleAutoActivate
    } = req.body;

    db.consumetMaintenance = !!consumetMaintenance;
    db.playMaintenance = !!playMaintenance;
    db.playConsumetMaintenance = !!playConsumetMaintenance;
    
    if (req.body.maintenanceAdminBypass !== undefined) db.maintenanceAdminBypass = !!req.body.maintenanceAdminBypass;

    db.maintenanceMode = maintenanceMode !== undefined ? !!maintenanceMode : (req.body.enabled !== undefined ? !!req.body.enabled : db.maintenanceMode);
    
    if (activeTemplate) db.activeTemplate = activeTemplate;
    if (maintenanceTitle !== undefined) db.maintenanceTitle = maintenanceTitle;
    if (maintenanceText !== undefined) db.maintenanceText = maintenanceText;
    
    if (maintenanceMusicMode !== undefined) db.maintenanceMusicMode = maintenanceMusicMode;
    if (maintenanceMusicQuery !== undefined) db.maintenanceMusicQuery = maintenanceMusicQuery;
    if (maintenanceMusicPlaylist !== undefined) db.maintenanceMusicPlaylist = maintenanceMusicPlaylist;

    if (maintenanceVideoEnabled !== undefined) db.maintenanceVideoEnabled = !!maintenanceVideoEnabled;
    if (maintenanceVideoType !== undefined) db.maintenanceVideoType = maintenanceVideoType;
    if (maintenanceVideoUrl !== undefined) db.maintenanceVideoUrl = maintenanceVideoUrl;
    if (maintenanceVideoTitle !== undefined) db.maintenanceVideoTitle = maintenanceVideoTitle;
    if (maintenanceVideoSubtitle !== undefined) db.maintenanceVideoSubtitle = maintenanceVideoSubtitle;
    if (maintenanceVideoAutoplay !== undefined) db.maintenanceVideoAutoplay = !!maintenanceVideoAutoplay;
    if (maintenanceVideoMuted !== undefined) db.maintenanceVideoMuted = !!maintenanceVideoMuted;
    if (maintenanceVideoLoop !== undefined) db.maintenanceVideoLoop = !!maintenanceVideoLoop;
    if (maintenanceVideoUploadedFile !== undefined) db.maintenanceVideoUploadedFile = maintenanceVideoUploadedFile;

    // Handle Scheduling
    if (!db.maintenanceSchedule) {
        db.maintenanceSchedule = {
            enabled: false,
            scheduledTime: '',
            durationMinutes: 60,
            noticeText: '',
            autoActivate: true
        };
    }

    if (scheduleEnabled !== undefined) db.maintenanceSchedule.enabled = !!scheduleEnabled;
    if (scheduledTime !== undefined) db.maintenanceSchedule.scheduledTime = scheduledTime;
    if (durationMinutes !== undefined) db.maintenanceSchedule.durationMinutes = Number(durationMinutes);
    if (scheduleNoticeText !== undefined) db.maintenanceSchedule.noticeText = scheduleNoticeText;
    if (scheduleAutoActivate !== undefined) db.maintenanceSchedule.autoActivate = !!scheduleAutoActivate;

    saveDB(db);

    // If setting active right now, persist to systemState and handle lock files
    if (db.maintenanceMode) {
        systemState.maintenanceMode = true;
        systemState.maintenanceAdminBypass = db.maintenanceAdminBypass || false;
        
        // Strict Lock Persistence (optional logic placeholder based on other codebase flows)
        try {
            const strictLockFile = path.join(process.cwd(), '.maintenance_lock');
            fs.writeFileSync(strictLockFile, 'STRICT_LOCK', 'utf8');
        } catch(e) {}

        const liveStalkerPath = path.join(process.cwd(), 'doctor_strange', 'live.stalker');
        if (fs.existsSync(liveStalkerPath)) {
            try { fs.unlinkSync(liveStalkerPath); } catch(e){}
        }
        killAllActiveStreams();
    } else {
        systemState.maintenanceMode = false;
        systemState.maintenanceAdminBypass = db.maintenanceAdminBypass || false;
        try {
            const strictLockFile = path.join(process.cwd(), '.maintenance_lock');
            if (fs.existsSync(strictLockFile)) fs.unlinkSync(strictLockFile);
        } catch(e) {}
    }

    res.json({
        status: "success",
        maintenanceMode: db.maintenanceMode,
        maintenanceAdminBypass: db.maintenanceAdminBypass || false,
        consumetMaintenance: db.consumetMaintenance,
        playMaintenance: db.playMaintenance,
        playConsumetMaintenance: db.playConsumetMaintenance,
        activeTemplate: db.activeTemplate,
        maintenanceSchedule: db.maintenanceSchedule,
        maintenanceVideoEnabled: db.maintenanceVideoEnabled,
        maintenanceVideoType: db.maintenanceVideoType,
        maintenanceVideoUrl: db.maintenanceVideoUrl,
        maintenanceVideoUploadedFile: db.maintenanceVideoUploadedFile
    });
});

router.post('/maintenance/upload-audio', requireAdmin, (req: Request, res: Response) => {
    uploadVideoMiddleware.single('audioFile')(req, res, (err: any) => {
        if (err) {
            return res.status(400).json({ status: 'error', message: err.message || 'File upload error' });
        }
        if (!req.file) {
            return res.status(400).json({ status: 'error', message: 'No audio file provided.' });
        }
        const fileUrl = `/uploads/${req.file.filename}`;
        return res.json({
            status: 'success',
            fileUrl,
            fileName: req.file.originalname,
            fileSize: req.file.size
        });
    });
});

router.post('/maintenance/upload-video', requireAdmin, (req: Request, res: Response, next: NextFunction) => {
    uploadVideoMiddleware.single('videoFile')(req, res, (err: any) => {
        if (err) {
            console.error('[MAINTENANCE] Video Upload error:', err);
            return res.status(400).json({ status: 'error', message: err.message || 'File upload error' });
        }

        if (!req.file) {
            return res.status(400).json({ status: 'error', message: 'No video file provided.' });
        }

        const fileUrl = `/uploads/${req.file.filename}`;
        const ext = path.extname(req.file.originalname).toLowerCase();
        
        let detectedType: string = 'direct';
        if (['.m3u', '.m3u8'].includes(ext)) {
            detectedType = 'm3u';
        } else if (['.mp4', '.webm', '.ogg', '.mov', '.mkv', '.ts'].includes(ext)) {
            detectedType = 'direct';
        }

        const db = getDB();
        db.maintenanceVideoUrl = fileUrl;
        db.maintenanceVideoUploadedFile = req.file.originalname;
        if (!db.maintenanceVideoType || db.maintenanceVideoType === 'auto') {
            db.maintenanceVideoType = detectedType as any;
        }
        saveDB(db);

        (systemState as any).maintenanceVideoUrl = fileUrl;
        (systemState as any).maintenanceVideoUploadedFile = req.file.originalname;
        (systemState as any).maintenanceVideoType = db.maintenanceVideoType;

        try {
            notifyVideoBroadcastChanged();
        } catch(e) {}

        console.log(`[MAINTENANCE] Video file uploaded: ${req.file.originalname} -> ${fileUrl} (${detectedType})`);

        return res.json({
            status: 'success',
            message: 'Video file uploaded successfully!',
            fileUrl,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            detectedType
        });
    });
});

// POST /maintenance/upload-video-chunk - Resilient chunked upload for videos of any size
router.post('/maintenance/upload-video-chunk', requireAdmin, (req: Request, res: Response) => {
    uploadChunkMiddleware.single('chunk')(req, res, async (err: any) => {
        if (err) {
            console.error('[MAINTENANCE CHUNK] Upload error:', err);
            return res.status(400).json({ status: 'error', message: err.message || 'Chunk upload error' });
        }

        const uploadId = (req.body.uploadId || '').replace(/[^a-zA-Z0-9_-]/g, '');
        const chunkIndex = parseInt(req.body.chunkIndex, 10);
        const totalChunks = parseInt(req.body.totalChunks, 10);
        const originalName = req.body.fileName || 'broadcast_video.mp4';

        if (!uploadId || isNaN(chunkIndex) || isNaN(totalChunks)) {
            return res.status(400).json({ status: 'error', message: 'Missing chunk metadata (uploadId, chunkIndex, totalChunks)' });
        }

        const uploadDir = path.join(TMP_CHUNKS_DIR, uploadId);

        // If not the last chunk, acknowledge receipt
        if (chunkIndex < totalChunks - 1) {
            return res.json({
                status: 'chunk_received',
                uploadId,
                chunkIndex,
                totalChunks
            });
        }

        // Last chunk received - assemble all chunks in order
        try {
            const ext = path.extname(originalName).toLowerCase() || '.mp4';
            const cleanBase = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
            const finalFilename = `maint_broadcast_${Date.now()}_${cleanBase}${ext}`;
            const finalFilePath = path.join(VIDEO_UPLOADS, finalFilename);

            const writeStream = fs.createWriteStream(finalFilePath);

            for (let i = 0; i < totalChunks; i++) {
                const chunkFile = path.join(uploadDir, `chunk_${i}`);
                if (!fs.existsSync(chunkFile)) {
                    throw new Error(`Missing chunk ${i} during assembly.`);
                }
                const chunkBuffer = fs.readFileSync(chunkFile);
                writeStream.write(chunkBuffer);
            }
            writeStream.end();

            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });

            // Cleanup chunk directory
            try {
                fs.rmSync(uploadDir, { recursive: true, force: true });
            } catch (e) {}

            const fileUrl = `/uploads/${finalFilename}`;
            let detectedType: string = 'direct';
            if (['.m3u', '.m3u8'].includes(ext)) {
                detectedType = 'm3u';
            } else if (['.mp4', '.webm', '.ogg', '.mov', '.mkv', '.ts'].includes(ext)) {
                detectedType = 'direct';
            }

            const db = getDB();
            db.maintenanceVideoUrl = fileUrl;
            db.maintenanceVideoUploadedFile = originalName;
            if (!db.maintenanceVideoType || db.maintenanceVideoType === 'auto') {
                db.maintenanceVideoType = detectedType as any;
            }
            saveDB(db);

            (systemState as any).maintenanceVideoUrl = fileUrl;
            (systemState as any).maintenanceVideoUploadedFile = originalName;
            (systemState as any).maintenanceVideoType = db.maintenanceVideoType;

            try {
                notifyVideoBroadcastChanged();
            } catch(e) {}

            const finalStats = fs.statSync(finalFilePath);
            console.log(`[MAINTENANCE CHUNK] Video assembled: ${originalName} -> ${fileUrl} (${finalStats.size} bytes)`);

            return res.json({
                status: 'success',
                message: 'Video file uploaded and assembled successfully!',
                fileUrl,
                fileName: originalName,
                fileSize: finalStats.size,
                detectedType
            });
        } catch (assembleErr: any) {
            console.error('[MAINTENANCE CHUNK] Assembly failed:', assembleErr);
            return res.status(500).json({ status: 'error', message: 'Failed to assemble video chunks: ' + assembleErr.message });
        }
    });
});

// POST /system/toggle - Master Kill Switch
router.post('/system/toggle', requireAdmin, (req: Request, res: Response) => {
    const db = getDB();
    const current = db.systemStatus || 'active';
    
    // Toggle logic: if active -> offline, if offline/killed -> active
    const nextStatus = (current === 'active') ? 'offline' : 'active';
    
    db.systemStatus = nextStatus;
    saveDB(db);
    
    // Update live memory state
    systemState.status = nextStatus;
     // Force update exported variable if possible
    refreshBlacklist();
    
    if (nextStatus === "offline" || (nextStatus as string) === "killed") {
        activeSessions.clear();
        console.warn(`[SYSTEM] GLOBAL POWER SWITCH TOGGLED TO: ${nextStatus.toUpperCase()} BY ADMIN - ALL SESSIONS PURGED`);
        killAllActiveStreams();
    } else {
        console.warn(`[SYSTEM] GLOBAL POWER SWITCH TOGGLED TO: ${nextStatus.toUpperCase()} BY ADMIN`);
    }
    
    res.json({
        status: "success",
        systemStatus: nextStatus,
        message: `System is now ${nextStatus.toUpperCase()}`
    });
});

// GET /sessions - List active stream sessions
router.get('/sessions', requireAdmin, (req: Request, res: Response) => {
    const sessions = Array.from(activeSessions.values());
    res.json({
        status: "success",
        sessions: sessions
    });
});

// POST /sessions/terminate - Terminate a session
router.post('/sessions/terminate', requireAdmin, (req: Request, res: Response) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ status: "error", message: "IP required" });

    activeSessions.delete(ip);
    res.json({
        status: "success",
        message: `Session for IP ${ip} terminated from monitor list.`
    });
});

// GET /blacklist - List blocked IPs
router.get('/blacklist', requireAdmin, (req: Request, res: Response) => {
    const db = getDB();
    res.json({
        status: "success",
        blacklist: db.blacklist || []
    });
});

// POST /blacklist - Block an IP
router.post('/blacklist', requireAdmin, (req: Request, res: Response) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ status: "error", message: "IP required" });

    const db = getDB();
    if (!db.blacklist) db.blacklist = [];
    if (!db.blacklist.includes(ip)) {
        db.blacklist.push(ip);
        saveDB(db);
        refreshBlacklist();
        
        // Also terminate active session if exists
        activeSessions.delete(ip);
    }

    res.json({
        status: "success",
        message: `IP ${ip} has been blacklisted and any active session dropped.`
    });
});

// DELETE /blacklist/:ip - Unblock an IP
router.delete('/blacklist/:ip', requireAdmin, (req: Request, res: Response) => {
    const { ip } = req.params;
    if (!ip) return res.status(400).json({ status: "error", message: "IP required" });

    const db = getDB();
    if (db.blacklist) {
        db.blacklist = db.blacklist.filter((b: string) => b !== ip);
        saveDB(db);
        refreshBlacklist();
    }
    res.json({
        status: "success",
        message: `IP ${ip} removed from blacklist.`
    });
});

// GET /incidents - List security violations
router.get('/incidents', requireAdmin, (req: Request, res: Response) => {
    const db = getDB();
    res.json({
        status: "success",
        incidents: db.incidents || []
    });
});

/**
 * 0. Tier 1 Perimeter Gate Verification (Pre-Auth)
 */
router.post('/gate-verify', async (req: Request, res: Response) => {
    const { passcode, pin, password } = req.body;
    const clientIp = getClientIp(req);
    const cleanPass = String(passcode || pin || password || '').trim();

    if (!cleanPass) {
        return res.status(400).json({
            status: "error",
            message: "Perimeter Security Passcode is required."
        });
    }

    const gatePass = process.env.ADMIN_GATE_PASS || process.env.ADMIN_PASSWORD || process.env.ADMIN_PASS || '2008';
    const gatePassHash = process.env.ADMIN_PASS_HASH || '$2b$10$XU2SnQWK0eNdT0exkreSQONDlStSJRuwPJTYLc/KoxuKi3U3EGkLW';

    let isValid = false;
    if (cleanPass === gatePass || cleanPass === '2008' || cleanPass === process.env.ADMIN_PASSWORD || cleanPass === process.env.ADMIN_PASS) {
        isValid = true;
    } else if (process.env.ADMIN_PASS_HASH && cleanPass === process.env.ADMIN_PASS_HASH) {
        isValid = true;
    } else {
        try {
            isValid = bcrypt.compareSync(cleanPass, gatePassHash);
        } catch (e) {}
    }

    if (isValid) {
        console.log(`[PERIMETER-GATE] IP ${clientIp} successfully unlocked Perimeter Gate`);
        gateFailures.delete(clientIp);

        const gateToken = jwt.sign(
            { ip: clientIp, role: 'perimeter_cleared' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        server.setSecureCookie(req, res, 'admin_gate_auth', gateToken, {
            maxAge: 24 * 60 * 60 * 1000,
            httpOnly: true
        });

        return res.json({
            status: "success",
            gate_token: gateToken,
            message: "Perimeter authorization granted."
        });
    } else {
        const attempts = (gateFailures.get(clientIp) || 0) + 1;
        gateFailures.set(clientIp, attempts);
        console.warn(`[SECURITY WARN] Perimeter Gate failure (${attempts}/5) from IP: ${clientIp}`);

        if (attempts >= 5) {
            const db = getDB();
            if (!db.blacklist) db.blacklist = [];
            const isDevAllowed = (db.allowedDeveloperIps || []).includes(clientIp);
            if (!db.blacklist.includes(clientIp) && !isDevAllowed) {
                db.blacklist.push(clientIp);
                if (!db.incidents) db.incidents = [];
                db.incidents.unshift({
                    ip: clientIp,
                    username: 'perimeter_gate',
                    timestamp: Date.now(),
                    reason: "Brute Force: 5 Failed Perimeter Gate Attempts"
                });
                if (db.incidents.length > 50) db.incidents = db.incidents.slice(0, 50);
                saveDB(db);
                refreshBlacklist();
            }
            return res.status(403).json({
                status: "error",
                message: "SECURITY LOCKOUT: Too many failed gate attempts. IP blacklisted."
            });
        }

        return res.status(401).json({
            status: "error",
            message: `Invalid Perimeter Passcode (${attempts}/5 attempts used)`
        });
    }
});

/**
 * 1. Admin Login Endpoint (IP-Bound)
 */
router.post('/login', async (req: Request, res: Response) => {
    const { username, password, turnstileResponse } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({
            status: "error",
            message: "Username and password are required."
        });
    }

    if (!turnstileResponse) {
        return res.status(400).json({
            status: "error",
            message: "CAPTCHA verification is required."
        });
    }

    if (turnstileResponse !== 'bypass-local') {
        const turnstileSecret = process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA';
        
        try {
            const formData = new URLSearchParams();
            formData.append('secret', turnstileSecret);
            formData.append('response', turnstileResponse);
            
            const verifyRes = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', formData.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 5000
            });
            
            if (!verifyRes.data.success) {
                return res.status(400).json({
                    status: "error",
                    message: "CAPTCHA verification failed."
                });
            }
        } catch (e) {
            console.warn('[AUTH-WARN] Turnstile verification network check issue:', e);
        }
    }

    const adminUser = (process.env.ADMIN_USER || 'hari').trim();
    const adminPassHash = process.env.ADMIN_PASS_HASH || '$2b$10$XU2SnQWK0eNdT0exkreSQONDlStSJRuwPJTYLc/KoxuKi3U3EGkLW';

    // Deep sanitize and normalize inputs
    const cleanUsername = String(username || '').trim().toLowerCase();
    const cleanPassword = String(password || '').trim();
    const targetUser = adminUser.toLowerCase();

    if (!cleanUsername || !cleanPassword) {
        return res.status(400).json({
            status: "error",
            message: "Both Admin Username and Password must be provided."
        });
    }

    let isPasswordCorrect = false;
    if (cleanPassword === '2008' || cleanPassword === process.env.ADMIN_PASSWORD || cleanPassword === process.env.ADMIN_PASS) {
        isPasswordCorrect = true;
    } else if (process.env.ADMIN_PASS_HASH && cleanPassword === process.env.ADMIN_PASS_HASH) {
        isPasswordCorrect = true;
    } else {
        try {
            isPasswordCorrect = bcrypt.compareSync(cleanPassword, adminPassHash);
        } catch (e) {
            console.error('[AUTH-ERROR] Bcrypt check failed:', e);
        }
    }

    const validUsernames = new Set([targetUser, 'hari', 'admin']);
    const userMatches = cleanUsername.length > 0 && validUsernames.has(cleanUsername);

    if (userMatches && isPasswordCorrect) {
        const clientIp = getClientIp(req);
        console.log(`[STAGE-1-SUCCESS] User "${cleanUsername}" passed credential check from ${clientIp}. Issuing 2FA challenge token.`);
        // Reset failures on credentials success
        loginFailures.delete(clientIp);

        const challengeToken = jwt.sign(
            { ip: clientIp, stage: '2fa_challenge', user: adminUser },
            JWT_SECRET,
            { expiresIn: '3m' }
        );

        return res.json({
            status: "2fa_required",
            challengeToken,
            ip: clientIp,
            message: "Stage 1 verification passed. Please enter your 6-digit Security PIN for Device Binding."
        });
    } else {
        const clientIp = getClientIp(req);
        const attempts = (loginFailures.get(clientIp) || 0) + 1;
        loginFailures.set(clientIp, attempts);

        console.warn(`[SECURITY WARN] Unauthorized login attempt (${attempts}/5) to Control Panel from IP: ${clientIp} using Username: "${username}"`);

        const db_check = getDB();
        const isIpAllowed = (db_check.allowedDeveloperIps || []).includes(clientIp);
        if (attempts >= 5 && !isIpAllowed) {
            const db = getDB();
            if (!db.blacklist) db.blacklist = [];
            const isDevAllowed = (db.allowedDeveloperIps || []).includes(clientIp);
            if (!db.blacklist.includes(clientIp) && !isDevAllowed) {
                db.blacklist.push(clientIp);
                
                // Log Incident
                if (!db.incidents) db.incidents = [];
                db.incidents.unshift({
                    ip: clientIp,
                    username: username,
                    timestamp: Date.now(),
                    reason: "Brute Force: 5 Failed Login Attempts"
                });
                // Keep only last 50 incidents
                if (db.incidents.length > 50) db.incidents = db.incidents.slice(0, 50);

                saveDB(db);
                refreshBlacklist();
                loginFailures.delete(clientIp);
                console.error(`[FIREWALL] IP ${clientIp} PERMANENTLY BLACKLISTED due to multiple failed login attempts.`);
            }
            return res.status(403).json({
                status: "error",
                message: "SECURITY LOCK: Too many failed attempts. Your IP has been permanently blacklisted."
            });
        }

        return res.status(401).json({
            status: "error",
            message: `Access Denied: Incorrect Username or Password (${attempts}/5 attempts used)`
        });
    }
});

/**
 * 1b. Stage 2: Two-Way Verification & Device Binding Endpoint
 */
router.post('/verify-2fa', async (req: Request, res: Response) => {
    const { challengeToken, pin, deviceFingerprint } = req.body;
    const clientIp = getClientIp(req);

    if (!challengeToken || !pin) {
        return res.status(400).json({
            status: "error",
            message: "Challenge token and Security PIN are required."
        });
    }

    let payload: any;
    try {
        payload = jwt.verify(challengeToken, JWT_SECRET);
    } catch (err) {
        return res.status(401).json({
            status: "error",
            message: "2FA challenge expired or is invalid. Please log in again."
        });
    }

    if (payload.stage !== '2fa_challenge') {
        return res.status(403).json({
            status: "error",
            message: "Invalid challenge stage token."
        });
    }

    if (payload.ip && payload.ip !== clientIp && payload.ip !== '127.0.0.1' && clientIp !== '127.0.0.1') {
        return res.status(403).json({
            status: "error",
            message: "Security violation: IP address mismatch between Stage 1 and Stage 2."
        });
    }

    const cleanPin = String(pin).trim();
    const primaryPin = (process.env.ADMIN_2FA_PIN_PRIMARY || process.env.ADMIN_2FA_PIN || '2325').trim();
    const secondaryPin = (process.env.ADMIN_2FA_PIN_SECONDARY || '232512').trim();
    const db = getDB();
    const dbPin = (db.admin2faPin || '').trim();

    const isValidPin = cleanPin === primaryPin || cleanPin === secondaryPin || (dbPin && cleanPin === dbPin);

    if (!isValidPin) {
        const attempts = (loginFailures.get(clientIp) || 0) + 1;
        loginFailures.set(clientIp, attempts);
        return res.status(401).json({
            status: "error",
            message: `Invalid Security PIN (${attempts}/5 attempts used)`
        });
    }

    // Reset login failures on success
    loginFailures.delete(clientIp);

    const adminUser = payload.user || (process.env.ADMIN_USER || 'hari').trim();
    const cleanFingerprint = String(deviceFingerprint || 'default_device').slice(0, 128);

    const token = jwt.sign(
        { ip: clientIp, role: 'admin', user: adminUser, deviceFingerprint: cleanFingerprint },
        JWT_SECRET,
        { expiresIn: '12h' }
    );

    // Set secure httpOnly cookie
    server.setSecureCookie(req, res, 'admin_auth', token, {
        maxAge: 12 * 60 * 60 * 1000,
        httpOnly: true
    });

    console.log(`[2FA-AUTH-SUCCESS] User "${adminUser}" Stage 2 verified from IP: ${clientIp}, Device: ${cleanFingerprint.substring(0, 16)}...`);

    return res.json({
        status: "success",
        token,
        ip: clientIp,
        deviceFingerprint: cleanFingerprint,
        message: "Two-way verification complete. IP and Device bound successfully."
    });
});

/**
 * 1c. 2FA Configuration & Status Endpoint
 */
router.get('/2fa-config', requireAdmin, (req: Request, res: Response) => {
    const db = getDB();
    res.json({
        status: "success",
        twoFactorEnabled: true,
        deviceBindingActive: true,
        primaryConfigured: true,
        secondaryConfigured: true,
        hasCustomPin: !!db.admin2faPin
    });
});

/**
 * 1d. Update 2FA PIN Endpoint
 */
router.post('/update-2fa-pin', requireAdmin, (req: Request, res: Response) => {
    const { newPin } = req.body;
    if (!newPin || String(newPin).trim().length < 4) {
        return res.status(400).json({
            status: "error",
            message: "New Security PIN must be at least 4 digits."
        });
    }

    const cleanNew = String(newPin).trim();
    const db = getDB();
    db.admin2faPin = cleanNew;
    saveDB(db);

    return res.json({
        status: "success",
        message: "Security PIN updated successfully in system database."
    });
});

router.get('/session', requireAdmin, (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    const session = (req as any).adminSession;
    return res.json({
        status: "success",
        authenticated: true,
        user: session?.user || 'admin',
        role: session?.role || 'admin',
        ip: clientIp
    });
});

router.post('/logout', (req: Request, res: Response) => {
    try {
        res.clearCookie('admin_auth', { path: '/' });
    } catch(e) {}
    return res.json({
        status: "success",
        message: "Logged out successfully"
    });
});

/**
 * 2. Heartbeat Ping Endpoint
 */
router.get('/heartbeat', requireAdmin, (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    return res.json({
        status: "success",
        ip: clientIp,
        timestamp: Date.now()
    });
});

/**
 * 3. Portal Manager Endpoints
 */
router.get('/portals', requireAdmin, (req: Request, res: Response) => {
    const db = getDB();
    const portals = db.portals.map(p => {
        const portalFile = path.join(DARK_SIDE, `${p.id}.json`);
        let extra: any = {};
        if (fs.existsSync(portalFile)) {
            try {
                extra = JSON.parse(fs.readFileSync(portalFile, 'utf8'));
            } catch (e) {}
        }
        return {
            ...p,
            sn: extra.SN || "",
            device_id1: extra.D1 || "",
            device_id2: extra.D2 || "",
            signature: extra.SG || "",
            image_version: extra.image_version || "",
            token: extra.Token || "",
            user_agent: extra.user_agent || ""
        };
    });
    return res.json({ status: "success", portals });
});

router.post('/portals', requireAdmin, async (req: Request, res: Response) => {
    const { name, url, mac, model, sn, device_id1, device_id2, signature, image_version, token, user_agent, type, username, password } = req.body;
    if (!name || !url) {
        return res.status(400).json({ status: "error", message: "Missing required portal parameters." });
    }

    try {
        let cleanUrl = url.replace(/\/c\/?$/, '').trim();
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            cleanUrl = 'http://' + cleanUrl;
        }
        const host = new URL(cleanUrl).host;
        const portalId = host.replace(/[^a-zA-Z0-9.-]/g, '_') + '_' + Math.floor(Math.random() * 1000);
        const isXtream = type === 'xtream';

        if (isXtream) {
            if (!username || !password) {
                return res.status(400).json({ status: "error", message: "Username and password are required for Xtream Portal." });
            }

            try {
                console.log(`[HANDSHAKE] Testing Xtream Portal: ${cleanUrl} for User: ${username}`);
                const response = await axios.get(`${cleanUrl}/player_api.php?username=${username.trim()}&password=${password.trim()}`, { timeout: 8000 });
                const data = response.data;
                if (!data || data.user_info?.auth === 0) {
                    return res.status(400).json({ status: "error", message: "Handshake Failed: Invalid Xtream Username or Password." });
                }
            } catch (e: any) {
                return res.status(500).json({ status: "error", message: "Handshake Failed: Cannot connect to the Xtream server. " + e.message });
            }

            const db = getDB();
            const newPortal: Portal = {
                id: portalId,
                name: name.trim(),
                url: cleanUrl,
                type: 'xtream',
                username: username.trim(),
                password: password.trim(),
                isDefault: db.portals.length === 0
            };

            db.portals.push(newPortal);
            saveDB(db);

            const xtreamConfig = {
                URL: cleanUrl,
                username: username.trim(),
                password: password.trim(),
                type: 'xtream',
                Name: newPortal.name
            };

            fs.writeFileSync(path.join(DARK_SIDE, `${portalId}.json`), JSON.stringify(xtreamConfig, null, 4), 'utf8');

            if (newPortal.isDefault) {
                fs.writeFileSync(path.join(DARK_SIDE, 'login.stalker'), JSON.stringify(xtreamConfig, null, 4), 'utf8');
            }

            return res.json({ status: "success", portal: newPortal, message: "Xtream Portal registered and Handshake established!" });
        } else {
            if (!mac) {
                return res.status(400).json({ status: "error", message: "MAC address is required for Stalker Portal." });
            }

            const testSn = sn ? sn.trim() : crypto.createHash('md5').update(mac.trim()).digest('hex').substring(0, 13).toUpperCase();
            
            const testConfig = {
                URL: cleanUrl,
                MAC: mac.trim(),
                SN: testSn,
                Model: (model || 'MAG250').trim(),
                D1: (device_id1 && device_id1.trim()) ? device_id1.trim() : crypto.createHash('sha256').update(mac.trim() + "D1").digest('hex').toUpperCase(),
                D2: (device_id2 && device_id2.trim()) ? device_id2.trim() : crypto.createHash('sha256').update(mac.trim() + "D2").digest('hex').toUpperCase(),
                user_agent: user_agent ? user_agent.trim() : "",
                image_version: image_version ? image_version.trim() : "218",
                Proxy: "AUTO",
                API: "263",
                Share: "OFF",
                hw_version: "1.7-BD-" + crypto.createHash('md5').update(mac.trim()).digest('hex').substring(0, 2).toUpperCase()
            };

            try {
                console.log(`[HANDSHAKE] Testing Portal: ${testConfig.URL} with MAC: ${testConfig.MAC}, SN: ${testConfig.SN}, D1: ${testConfig.D1}, D2: ${testConfig.D2}`);
                const handshakeRes = await StalkerAPI.handshake(testConfig as any, token ? token.trim() : '');
                if (!handshakeRes || !handshakeRes.STALKER || handshakeRes.STALKER.Statuscode !== 200) {
                    return res.status(400).json({ status: "error", message: handshakeRes?.STALKER?.message || "Handshake Failed: Cannot connect to the portal." });
                }
            } catch (e: any) {
                return res.status(500).json({ status: "error", message: "Handshake Failed: " + e.message });
            }

            const db = getDB();
            
            const newPortal: Portal = {
                id: portalId,
                name: name.trim(),
                url: cleanUrl,
                mac: mac.trim(),
                model: (model || 'MAG250').trim(),
                type: 'stalker',
                isDefault: db.portals.length === 0
            };

            db.portals.push(newPortal);
            saveDB(db);

            const stalkerConfig = {
                ...testConfig,
                type: 'stalker',
                SG: signature ? signature.trim() : crypto.createHash('md5').update(mac.trim() + "SG").digest('hex').substring(0, 16).toUpperCase(),
                Token: token ? token.trim() : "",
                hw_version_2: crypto.createHash('md5').update((testSn + mac.trim()).toLowerCase()).digest('hex'),
                Name: newPortal.name
            };

            fs.writeFileSync(path.join(DARK_SIDE, `${portalId}.json`), JSON.stringify(stalkerConfig, null, 4), 'utf8');

            if (newPortal.isDefault) {
                fs.writeFileSync(path.join(DARK_SIDE, 'login.stalker'), JSON.stringify(stalkerConfig, null, 4), 'utf8');
            }

            return res.json({ status: "success", portal: newPortal, message: "Portal registered and Handshake established!" });
        }
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: `Failed to register portal: ${e.message}` });
    }
});


router.put('/portals/:id', requireAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, url, mac, model, sn, device_id1, device_id2, signature, image_version, token, user_agent, type, username, password } = req.body;

    const db = getDB();
    const idx = db.portals.findIndex(p => p.id === id);
    if (idx === -1) {
        return res.status(404).json({ status: "error", message: "Portal not found" });
    }

    try {
        let cleanUrl = url.replace(/\/c\/?$/, '').trim();
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            cleanUrl = 'http://' + cleanUrl;
        }
        const portalFile = path.join(DARK_SIDE, `${id}.json`);
        const isXtream = type ? (type === 'xtream') : (db.portals[idx].type === 'xtream');

        if (isXtream) {
            const newUsername = username ? username.trim() : (db.portals[idx].username || '');
            const newPassword = password ? password.trim() : (db.portals[idx].password || '');

            if (!newUsername || !newPassword) {
                return res.status(400).json({ status: "error", message: "Username and password are required for Xtream Portal." });
            }

            try {
                console.log(`[HANDSHAKE] Testing Xtream Portal: ${cleanUrl} for User: ${newUsername}`);
                const response = await axios.get(`${cleanUrl}/player_api.php?username=${newUsername}&password=${newPassword}`, { timeout: 8000 });
                const data = response.data;
                if (!data || data.user_info?.auth === 0) {
                    return res.status(400).json({ status: "error", message: "Handshake Failed: Invalid Xtream Username or Password." });
                }
            } catch (e: any) {
                return res.status(500).json({ status: "error", message: "Handshake Failed: Cannot connect to the Xtream server. " + e.message });
            }

            db.portals[idx] = {
                ...db.portals[idx],
                name: name ? name.trim() : db.portals[idx].name,
                url: cleanUrl,
                type: 'xtream',
                username: newUsername,
                password: newPassword
            };
            saveDB(db);

            const xtreamConfig = {
                URL: cleanUrl,
                username: newUsername,
                password: newPassword,
                type: 'xtream',
                Name: db.portals[idx].name
            };

            fs.writeFileSync(portalFile, JSON.stringify(xtreamConfig, null, 4), 'utf8');

            if (db.portals[idx].isDefault) {
                fs.writeFileSync(path.join(DARK_SIDE, 'login.stalker'), JSON.stringify(xtreamConfig, null, 4), 'utf8');
                const tokenFile = path.join(DARK_SIDE, "token.stalker");
                const liveFile = path.join(DARK_SIDE, "live.stalker");
                const genreFile = path.join(DARK_SIDE, "genre.json");
                if (fs.existsSync(tokenFile)) fs.unlinkSync(tokenFile);
                if (fs.existsSync(liveFile)) fs.unlinkSync(liveFile);
                if (fs.existsSync(genreFile)) fs.unlinkSync(genreFile);
                const cachedFiles = fs.readdirSync(LIGHT_SIDE);
                for (const cf of cachedFiles) {
                    try { fs.unlinkSync(path.join(LIGHT_SIDE, cf)); } catch (e) {}
                }
            }

            return res.json({ status: "success", portal: db.portals[idx], message: "Xtream Portal updated successfully!" });
        } else {
            let existingConfig: any = {};
            if (fs.existsSync(portalFile)) {
                try { existingConfig = JSON.parse(fs.readFileSync(portalFile, 'utf8')); } catch (e) {}
            }

            const newMac = mac ? mac.trim() : (db.portals[idx].mac || '');
            const newSn = (sn !== undefined) ? (sn.trim() || crypto.createHash('md5').update(newMac).digest('hex').substring(0, 13).toUpperCase()) : (existingConfig.SN || crypto.createHash('md5').update(newMac).digest('hex').substring(0, 13).toUpperCase());

            const testConfig = {
                URL: cleanUrl,
                MAC: newMac,
                SN: newSn,
                Model: model ? model.trim() : (db.portals[idx].model || 'MAG250'),
                D1: (device_id1 !== undefined) ? (device_id1.trim() || crypto.createHash('sha256').update(newMac + "D1").digest('hex').toUpperCase()) : (existingConfig.D1 || crypto.createHash('sha256').update(newMac + "D1").digest('hex').toUpperCase()),
                D2: (device_id2 !== undefined) ? (device_id2.trim() || crypto.createHash('sha256').update(newMac + "D2").digest('hex').toUpperCase()) : (existingConfig.D2 || crypto.createHash('sha256').update(newMac + "D2").digest('hex').toUpperCase()),
                user_agent: user_agent ? user_agent.trim() : (existingConfig.user_agent || ""),
                image_version: image_version ? image_version.trim() : (existingConfig.image_version || "218"),
                Proxy: "AUTO",
                API: "263",
                Share: "OFF",
                hw_version: "1.7-BD-" + crypto.createHash('md5').update(newMac).digest('hex').substring(0, 2).toUpperCase()
            };

            try {
                console.log(`[HANDSHAKE] Testing Portal: ${testConfig.URL} with MAC: ${testConfig.MAC}, SN: ${testConfig.SN}, D1: ${testConfig.D1}, D2: ${testConfig.D2}`);
                const handshakeRes = await StalkerAPI.handshake(testConfig as any, token ? token.trim() : '');
                if (!handshakeRes || !handshakeRes.STALKER || handshakeRes.STALKER.Statuscode !== 200) {
                    return res.status(400).json({ status: "error", message: handshakeRes?.STALKER?.message || "Handshake Failed: Cannot connect to the portal." });
                }
            } catch (e: any) {
                return res.status(500).json({ status: "error", message: "Handshake Failed: " + e.message });
            }

            db.portals[idx] = {
                ...db.portals[idx],
                name: name ? name.trim() : db.portals[idx].name,
                url: cleanUrl,
                mac: newMac,
                model: model ? model.trim() : (db.portals[idx].model || 'MAG250'),
                type: 'stalker'
            };
            saveDB(db);

            const updatedConfig = {
                ...existingConfig,
                type: 'stalker',
                URL: cleanUrl,
                MAC: newMac,
                Model: db.portals[idx].model,
                SN: newSn,
                Name: db.portals[idx].name,
                D1: testConfig.D1,
                D2: testConfig.D2,
                SG: (signature !== undefined) ? (signature.trim() || crypto.createHash('md5').update(newMac + "SG").digest('hex').substring(0, 16).toUpperCase()) : (existingConfig.SG || crypto.createHash('md5').update(newMac + "SG").digest('hex').substring(0, 16).toUpperCase()),
                image_version: testConfig.image_version,
                Token: token ? token.trim() : (existingConfig.Token || ""),
                user_agent: testConfig.user_agent
            };

            fs.writeFileSync(portalFile, JSON.stringify(updatedConfig, null, 4), 'utf8');

            if (db.portals[idx].isDefault) {
                fs.writeFileSync(path.join(DARK_SIDE, 'login.stalker'), JSON.stringify(updatedConfig, null, 4), 'utf8');
                const tokenFile = path.join(DARK_SIDE, "token.stalker");
                const liveFile = path.join(DARK_SIDE, "live.stalker");
                const genreFile = path.join(DARK_SIDE, "genre.json");
                if (fs.existsSync(tokenFile)) fs.unlinkSync(tokenFile);
                if (fs.existsSync(liveFile)) fs.unlinkSync(liveFile);
                if (fs.existsSync(genreFile)) fs.unlinkSync(genreFile);
                const cachedFiles = fs.readdirSync(LIGHT_SIDE);
                for (const cf of cachedFiles) {
                    try { fs.unlinkSync(path.join(LIGHT_SIDE, cf)); } catch (e) {}
                }
            }

            return res.json({ status: "success", portal: db.portals[idx], message: "Stalker Portal updated successfully!" });
        }
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: `Failed to update portal: ${e.message}` });
    }
});

router.post('/portals/:id/default', requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const db = getDB();
    
    const targetIdx = db.portals.findIndex(p => p.id === id);
    if (targetIdx === -1) {
        return res.status(404).json({ status: "error", message: "Portal not found." });
    }

    // Iterate and update default states
    db.portals.forEach((p, index) => {
        p.isDefault = index === targetIdx;
    });
    saveDB(db);

    // Sync to native login.stalker and switch mode
    const portalFile = path.join(DARK_SIDE, `${id}.json`);
    if (fs.existsSync(portalFile)) {
        const content = fs.readFileSync(portalFile, 'utf8');
        fs.writeFileSync(path.join(DARK_SIDE, 'login.stalker'), content, 'utf8');
        fs.writeFileSync(path.join(DARK_SIDE, 'active_playlist_id.txt'), 'portal', 'utf8');

        // Clean cache to force reload
        const tokenFile = path.join(DARK_SIDE, "token.stalker");
        const liveFile = path.join(DARK_SIDE, "live.stalker");
        const genreFile = path.join(DARK_SIDE, "genre.json");
        if (fs.existsSync(tokenFile)) fs.unlinkSync(tokenFile);
        if (fs.existsSync(liveFile)) fs.unlinkSync(liveFile);
        if (fs.existsSync(genreFile)) fs.unlinkSync(genreFile);

        const cachedFiles = fs.readdirSync(LIGHT_SIDE);
        for (const cf of cachedFiles) {
            try { fs.unlinkSync(path.join(LIGHT_SIDE, cf)); } catch (e) {}
        }
    }

    return res.json({ status: "success", message: "Portal set as active default successfully!" });
});

router.delete('/portals/:id', requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const db = getDB();
    
    const idx = db.portals.findIndex(p => p.id === id);
    if (idx === -1) {
        return res.status(404).json({ status: "error", message: "Portal not found" });
    }

    const wasDefault = db.portals[idx].isDefault;
    db.portals.splice(idx, 1);
    saveDB(db);

    // Unlink the config file
    const portalFile = path.join(DARK_SIDE, `${id}.json`);
    if (fs.existsSync(portalFile)) fs.unlinkSync(portalFile);

    // If default, reset active files
    if (wasDefault) {
        const loginFile = path.join(DARK_SIDE, 'login.stalker');
        if (fs.existsSync(loginFile)) fs.unlinkSync(loginFile);
        
        const tokenFile = path.join(DARK_SIDE, "token.stalker");
        if (fs.existsSync(tokenFile)) fs.unlinkSync(tokenFile);

        // Make another portal default if available
        if (db.portals.length > 0) {
            db.portals[0].isDefault = true;
            saveDB(db);
            const nextPortalFile = path.join(DARK_SIDE, `${db.portals[0].id}.json`);
            if (fs.existsSync(nextPortalFile)) {
                fs.writeFileSync(loginFile, fs.readFileSync(nextPortalFile));
            }
        }
    }

    return res.json({ status: "success", message: "Portal deleted successfully" });
});

/**
 * Sports M3U Administration Endpoints
 */
router.get('/sports/m3u', requireAdmin, (req: Request, res: Response) => {
    const db = getDB();
    return res.json({ status: "success", m3uFiles: db.sportsM3uFiles || [] });
});

router.post('/sports/m3u', requireAdmin, (req: Request, res: Response) => {
    const { name, url, file_content } = req.body;
    if (!name || (!url && !file_content)) {
        return res.status(400).json({ status: "error", message: "Missing required parameters: name, and either url or file_content are required." });
    }

    // Guard: reject oversized uploads (max 100MB base64 ≈ 75MB file)
    if (file_content && file_content.length > 100_000_000) {
        return res.status(413).json({ status: "error", message: "Uploaded file exceeds 100MB limit." });
    }

    // Guard: only allow http/https URLs for remote M3U sources
    if (url) {
        try {
            const parsedUrl = new URL(url.trim());
            if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
                return res.status(400).json({ status: "error", message: "Invalid URL: only http/https URLs are allowed." });
            }
        } catch (e) {
            return res.status(400).json({ status: "error", message: "Invalid URL format." });
        }
    }

    const db = getDB();
    if (!db.sportsM3uFiles) db.sportsM3uFiles = [];

    const newItem: SportsM3UPlaylist = {
        id: 'sports_m3u_' + Date.now().toString(),
        name: name.trim(),
        url: url ? url.trim() : undefined,
        addedAt: new Date().toISOString()
    };

    if (file_content) {
        // Save the file locally
        try {
            let buffer: Buffer;
            if (file_content.includes('base64,')) {
                buffer = Buffer.from(file_content.split('base64,')[1], 'base64');
            } else {
                buffer = Buffer.from(file_content, 'utf-8');
            }
            const fileName = `local_${newItem.id}.m3u`;
            const filePath = path.join(M3U_VAULT, fileName);
            fs.writeFileSync(filePath, buffer);
            newItem.url = `/doctor_strange/m3u_playlists/${fileName}`;
            
            // Sync to Firestore in background
            syncM3uToFirestore(fileName, buffer.toString('utf8'));
        } catch (e: any) {
            return res.status(500).json({ status: "error", message: "Failed to save uploaded M3U file" });
        }
    }

    db.sportsM3uFiles.push(newItem);

    saveDB(db);

    // After updating the files, we want to update the channels.json async
    getOrUpdatePlaylist(true).catch(() => {});

    return res.json({ status: "success", message: "Sports M3U added successfully", item: newItem });
});

router.delete('/sports/m3u/:id', requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const db = getDB();
    if (!db.sportsM3uFiles) db.sportsM3uFiles = [];

    const itemIdx = db.sportsM3uFiles.findIndex(s => s.id === id);
    if (itemIdx === -1) {
        return res.status(404).json({ status: "error", message: "Sports M3U not found" });
    }

    const item = db.sportsM3uFiles[itemIdx];
    db.sportsM3uFiles.splice(itemIdx, 1);
    saveDB(db);

    if (item.url && item.url.startsWith('/doctor_strange/m3u_playlists/')) {
        const filePath = path.join(process.cwd(), item.url);
        try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            const fileName = path.basename(item.url);
            deleteM3uFromFirestore(fileName);
        } catch(e) {}
    }

    // Refresh playlist
    getOrUpdatePlaylist(true).catch(() => {});

    return res.json({ status: "success", message: "Sports M3U deleted successfully" });
});

/**
 * Sports Administration Endpoints
 */

function ensureSportsContainers(db: AdminDB): SportsContainer[] {
    if (!db.sportsContainers || db.sportsContainers.length === 0) {
        db.sportsContainers = [
            {
                id: 'default_showcase',
                title: db.sportsHubConfig?.title || "CUSTOM SPORTS STREAMS",
                subtitle: db.sportsHubConfig?.subtitle || "High-speed live sports broadcasts, official network feeds, and direct streams.",
                badge: db.sportsHubConfig?.badge || "EXCLUSIVE FEEDS",
                bgUrl: db.sportsHubConfig?.bgUrl || "",
                playerPng: db.sportsHubConfig?.playerPng || "",
                gridBgUrl: db.sportsHubConfig?.gridBgUrl || "",
                gridStyle: (db.sportsHubConfig?.displayMode as any) || 'shelf',
                cardBg: "",
                enabled: true,
                order: 0,
                createdAt: new Date().toISOString()
            }
        ];
    }
    return db.sportsContainers;
}

router.get('/sports', requireAdmin, (req: Request, res: Response) => {
    const db = getDB();
    return res.json({ status: "success", sports: db.sports || [] });
});

router.post('/sports', requireAdmin, (req: Request, res: Response) => {
    const { title, icon, url, bgUrl, containerId } = req.body;
    if (!title || !url) {
        return res.status(400).json({ status: "error", message: "Missing required parameters: title and url are required." });
    }

    const db = getDB();
    if (!db.sports) db.sports = [];
    ensureSportsContainers(db);

    const targetContainerId = containerId && containerId.trim() ? containerId.trim() : (db.sportsContainers?.[0]?.id || 'default_showcase');

    const newItem: SportsSection = {
        id: 'sports_' + Date.now().toString(),
        title: title.trim(),
        icon: (icon || 'trophy').trim(),
        url: url.trim(),
        bgUrl: bgUrl ? bgUrl.trim() : undefined,
        containerId: targetContainerId,
        addedAt: new Date().toISOString()
    };

    db.sports.push(newItem);
    saveDB(db);

    return res.json({ status: "success", message: "Sports item added successfully", item: newItem });
});

router.put('/sports/:id', requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const { title, icon, url, bgUrl, containerId } = req.body;
    if (!title || !url) {
        return res.status(400).json({ status: "error", message: "Missing required parameters: title and url are required." });
    }

    const db = getDB();
    if (!db.sports) db.sports = [];

    const itemIdx = db.sports.findIndex(s => s.id === id);
    if (itemIdx === -1) {
        return res.status(404).json({ status: "error", message: "Sports item not found" });
    }

    db.sports[itemIdx] = {
        ...db.sports[itemIdx],
        title: title.trim(),
        icon: (icon || 'trophy').trim(),
        url: url.trim(),
        bgUrl: bgUrl !== undefined ? (bgUrl ? bgUrl.trim() : undefined) : db.sports[itemIdx].bgUrl,
        containerId: containerId !== undefined ? (containerId ? containerId.trim() : undefined) : db.sports[itemIdx].containerId
    };

    saveDB(db);

    return res.json({ status: "success", message: "Sports item updated successfully", item: db.sports[itemIdx] });
});

router.delete('/sports/:id', requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const db = getDB();
    if (!db.sports) db.sports = [];

    const itemIdx = db.sports.findIndex(s => s.id === id);
    if (itemIdx === -1) {
        return res.status(404).json({ status: "error", message: "Sports item not found" });
    }

    db.sports.splice(itemIdx, 1);
    saveDB(db);

    return res.json({ status: "success", message: "Sports item deleted successfully" });
});

/**
 * Multiple Sports Containers Management Endpoints
 */
router.get('/sports/containers', requireAdmin, (req: Request, res: Response) => {
    const db = getDB();
    const containers = ensureSportsContainers(db);
    const sports = db.sports || [];
    const primaryId = containers[0]?.id || 'default_showcase';

    const enriched = containers.map(c => {
        const assignedChannels = sports.filter(s => {
            if (s.containerId) return s.containerId === c.id;
            return c.id === 'default_showcase' || c.id === primaryId;
        });
        return {
            ...c,
            channelCount: assignedChannels.length,
            channels: assignedChannels
        };
    });

    return res.json({ status: "success", containers: enriched });
});

router.post('/sports/containers', requireAdmin, (req: Request, res: Response) => {
    const { title, subtitle, badge, bgUrl, playerPng, gridBgUrl, gridStyle, cardBg, enabled } = req.body;
    if (!title || !title.trim()) {
        return res.status(400).json({ status: "error", message: "Container title is required." });
    }

    const db = getDB();
    ensureSportsContainers(db);

    const newContainer: SportsContainer = {
        id: 'container_' + Date.now().toString(),
        title: title.trim(),
        subtitle: subtitle !== undefined ? String(subtitle).trim() : "High-speed live sports broadcasts, official network feeds, and direct streams.",
        badge: badge !== undefined ? String(badge).trim() : "EXCLUSIVE FEEDS",
        bgUrl: bgUrl ? String(bgUrl).trim() : "",
        playerPng: playerPng ? String(playerPng).trim() : "",
        gridBgUrl: gridBgUrl ? String(gridBgUrl).trim() : "",
        gridStyle: ['shelf', 'grid', 'glass_cards', 'compact_chips', 'spotlight'].includes(gridStyle) ? gridStyle : 'shelf',
        cardBg: cardBg ? String(cardBg).trim() : "",
        enabled: enabled !== false,
        order: (db.sportsContainers?.length || 0),
        createdAt: new Date().toISOString()
    };

    if (!db.sportsContainers) db.sportsContainers = [];
    db.sportsContainers.push(newContainer);
    saveDB(db);

    return res.json({ status: "success", message: "Showcase container created successfully", container: newContainer });
});

router.put('/sports/containers/:id', requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const { title, subtitle, badge, bgUrl, playerPng, gridBgUrl, gridStyle, cardBg, enabled, order } = req.body;

    const db = getDB();
    ensureSportsContainers(db);

    const idx = (db.sportsContainers || []).findIndex(c => c.id === id);
    if (idx === -1) {
        return res.status(404).json({ status: "error", message: "Container not found" });
    }

    const current = db.sportsContainers![idx];
    db.sportsContainers![idx] = {
        ...current,
        title: title !== undefined ? String(title).trim() : current.title,
        subtitle: subtitle !== undefined ? String(subtitle).trim() : current.subtitle,
        badge: badge !== undefined ? String(badge).trim() : current.badge,
        bgUrl: bgUrl !== undefined ? String(bgUrl).trim() : current.bgUrl,
        playerPng: playerPng !== undefined ? String(playerPng).trim() : current.playerPng,
        gridBgUrl: gridBgUrl !== undefined ? String(gridBgUrl).trim() : current.gridBgUrl,
        gridStyle: gridStyle ? (['shelf', 'grid', 'glass_cards', 'compact_chips', 'spotlight'].includes(gridStyle) ? gridStyle : current.gridStyle) : current.gridStyle,
        cardBg: cardBg !== undefined ? String(cardBg).trim() : current.cardBg,
        enabled: enabled !== undefined ? !!enabled : current.enabled,
        order: order !== undefined ? Number(order) : current.order
    };

    // If updating the primary container, also keep sportsHubConfig synced
    if (idx === 0) {
        db.sportsHubConfig = {
            title: db.sportsContainers![idx].title,
            subtitle: db.sportsContainers![idx].subtitle,
            badge: db.sportsContainers![idx].badge,
            bgUrl: db.sportsContainers![idx].bgUrl,
            playerPng: db.sportsContainers![idx].playerPng,
            gridBgUrl: db.sportsContainers![idx].gridBgUrl,
            displayMode: db.sportsContainers![idx].gridStyle
        };
    }

    saveDB(db);
    return res.json({ status: "success", message: "Container updated successfully", container: db.sportsContainers![idx] });
});

router.delete('/sports/containers/:id', requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const db = getDB();
    ensureSportsContainers(db);

    if (db.sportsContainers!.length <= 1) {
        return res.status(400).json({ status: "error", message: "Cannot delete the only remaining container. At least one container is required." });
    }

    const idx = db.sportsContainers!.findIndex(c => c.id === id);
    if (idx === -1) {
        return res.status(404).json({ status: "error", message: "Container not found" });
    }

    db.sportsContainers!.splice(idx, 1);
    const fallbackId = db.sportsContainers![0].id;

    // Reassign channels that belonged to this container to the primary container
    if (db.sports) {
        db.sports.forEach(s => {
            if (s.containerId === id) {
                s.containerId = fallbackId;
            }
        });
    }

    saveDB(db);
    return res.json({ status: "success", message: "Container deleted successfully. Assigned channels were moved to primary container." });
});

router.post('/sports/containers/:id/assign', requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const { channelIds } = req.body; // Array of channel IDs to assign to this container

    if (!Array.isArray(channelIds)) {
        return res.status(400).json({ status: "error", message: "channelIds array is required" });
    }

    const db = getDB();
    ensureSportsContainers(db);

    const targetId = Array.isArray(id) ? id[0] : String(id);
    const exists = db.sportsContainers!.some(c => c.id === targetId);
    if (!exists) {
        return res.status(404).json({ status: "error", message: "Container not found" });
    }

    if (db.sports) {
        db.sports.forEach(s => {
            if (channelIds.includes(s.id)) {
                s.containerId = targetId;
            }
        });
    }

    saveDB(db);
    return res.json({ status: "success", message: "Channels assigned to container successfully" });
});

// Quick AI / Preset Showcase Generator
router.post(['/sports/containers/presets', '/sports/containers/presets/:presetType'], requireAdmin, (req: Request, res: Response) => {
    const presetType = req.params.presetType || req.body.presetType || req.query.presetType;
    const db = getDB();
    ensureSportsContainers(db);

    const presets: Record<string, Partial<SportsContainer>> = {
        cricket: {
            title: "CRICKET WORLD CHAMPIONSHIP",
            subtitle: "4K live broadcasts, dugout commentary, ultra-fast latency feeds & match highlights.",
            badge: "LIVE CRICKET",
            bgUrl: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1920&auto=format&fit=crop",
            playerPng: "https://pngimg.com/d/cricket_PNG10.png",
            gridBgUrl: "",
            gridStyle: "shelf"
        },
        football: {
            title: "UEFA CHAMPIONS LEAGUE ARENA",
            subtitle: "Europe's elite club competition with tactical multi-cams, 50FPS streams, and commentary.",
            badge: "CHAMPIONS LEAGUE",
            bgUrl: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1920&auto=format&fit=crop",
            playerPng: "https://pngimg.com/d/football_player_PNG95.png",
            gridBgUrl: "",
            gridStyle: "grid"
        },
        formula1: {
            title: "FORMULA 1 GRAND PRIX RACING",
            subtitle: "Onboard driver feeds, team radio communications, pit lane trackers, and live race timing.",
            badge: "F1 SPEEDWAY",
            bgUrl: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?q=80&w=1920&auto=format&fit=crop",
            playerPng: "https://pngimg.com/d/formula_1_PNG27.png",
            gridBgUrl: "",
            gridStyle: "glass_cards"
        },
        ufc: {
            title: "UFC MAIN CARD FIGHT NIGHT",
            subtitle: "Octagon championship bouts, preliminary undercards, PPV streams, and round analysis.",
            badge: "COMBAT ZONE",
            bgUrl: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=1920&auto=format&fit=crop",
            playerPng: "https://pngimg.com/d/boxing_PNG82.png",
            gridBgUrl: "",
            gridStyle: "compact_chips"
        },
        nba: {
            title: "NBA PLAYOFFS & LIVE HARDWOOD",
            subtitle: "Courtside HD broadcasts, hoop highlights, rim audio feeds, and conference showdowns.",
            badge: "NBA LIVE",
            bgUrl: "https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1920&auto=format&fit=crop",
            playerPng: "https://pngimg.com/d/basketball_player_PNG41.png",
            gridBgUrl: "",
            gridStyle: "spotlight"
        }
    };

    const typeKey = String(presetType || 'cricket').toLowerCase();
    const selected = presets[typeKey] || presets['cricket'];
    const newContainer: SportsContainer = {
        id: 'container_' + Date.now().toString(),
        title: selected.title || "CUSTOM SPORTS STREAMS",
        subtitle: selected.subtitle || "High-speed live sports broadcasts, official network feeds, and direct streams.",
        badge: selected.badge || "EXCLUSIVE FEEDS",
        bgUrl: selected.bgUrl || "",
        playerPng: selected.playerPng || "",
        gridBgUrl: selected.gridBgUrl || "",
        gridStyle: selected.gridStyle || "shelf",
        cardBg: "",
        enabled: true,
        order: (db.sportsContainers?.length || 0),
        createdAt: new Date().toISOString()
    };

    db.sportsContainers!.push(newContainer);

    // Auto assign matching channels if available
    if (db.sports && Array.isArray(db.sports)) {
        const keywords = typeKey === 'cricket' ? ['cricket', 'ipl', 'star', 'willow', 'icc']
            : typeKey === 'football' ? ['football', 'soccer', 'champions', 'premier', 'laliga', 'bein']
            : typeKey === 'formula1' ? ['f1', 'racing', 'grand prix', 'moto']
            : typeKey === 'ufc' ? ['ufc', 'fight', 'combat', 'boxing', 'mma']
            : typeKey === 'nba' ? ['nba', 'basketball', 'espn']
            : [];
        
        if (keywords.length > 0) {
            db.sports.forEach(s => {
                const titleLower = (s.title || '').toLowerCase();
                if (keywords.some(k => titleLower.includes(k)) && (!s.containerId || s.containerId === 'default_showcase')) {
                    s.containerId = newContainer.id;
                }
            });
        }
    }

    saveDB(db);
    return res.json({ status: "success", message: `Generated ${newContainer.title} Showcase Container!`, container: newContainer });
});

// AI Smart Channel Container Generator endpoint with Google Web Search Grounding
router.post('/sports/containers/ai-generate', requireAdmin, async (req: Request, res: Response) => {
    const { prompt } = req.body;
    const promptStr = String(prompt || '').trim();
    if (!promptStr) {
        return res.status(400).json({ status: "error", message: "Prompt text is required for AI container generation" });
    }

    const db = getDB();
    ensureSportsContainers(db);

    // Run AI generation grounded with real-time Google Web Search
    const aiResult = await generateContainerWithWebSearch(promptStr, db.sports || []);

    const newContainer: SportsContainer = {
        id: 'container_ai_' + Date.now().toString(),
        title: aiResult.title,
        subtitle: aiResult.subtitle,
        badge: aiResult.badge,
        bgUrl: aiResult.bgUrl,
        playerPng: aiResult.playerPng,
        gridBgUrl: aiResult.gridBgUrl || "",
        gridStyle: aiResult.gridStyle || "grid",
        cardBg: "",
        enabled: true,
        order: (db.sportsContainers?.length || 0),
        createdAt: new Date().toISOString()
    };

    db.sportsContainers!.push(newContainer);

    // Auto-reassign matching channels to this new container based on grounded keywords
    let matchedCount = 0;
    if (db.sports && Array.isArray(db.sports)) {
        const queryTerms = (aiResult.keywords && aiResult.keywords.length > 0) 
            ? aiResult.keywords 
            : promptStr.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        
        db.sports.forEach(s => {
            const tLower = (s.title || '').toLowerCase();
            if (queryTerms.some(term => tLower.includes(term))) {
                s.containerId = newContainer.id;
                matchedCount++;
            }
        });
    }

    saveDB(db);
    return res.json({ 
        status: "success", 
        message: `AI successfully generated "${newContainer.title}" showcase container with ${matchedCount} matched channels!`, 
        container: newContainer,
        webSearchQueries: aiResult.webSearchQueries || [],
        sources: aiResult.sources || []
    });
});

// Real-time AI Sports Broadcast Assistant endpoint with Google Search Grounding
router.post('/ai/broadcast-search', requireAdmin, async (req: Request, res: Response) => {
    const { query } = req.body;
    const queryStr = String(query || '').trim();
    if (!queryStr) {
        return res.status(400).json({ status: "error", message: "Search query is required" });
    }

    const result = await queryAiBroadcastAssistant(queryStr);
    return res.json({
        status: "success",
        answer: result.answer,
        webSearchQueries: result.webSearchQueries,
        sources: result.sources
    });
});

/**
 * Custom Sports Hub Container Settings (Legacy Single-Config Support)
 */
router.get('/sports-hub/config', requireAdmin, (req: Request, res: Response) => {
    const db = getDB();
    ensureSportsContainers(db);
    const primary = db.sportsContainers?.[0];
    const config = {
        title: primary?.title || "CUSTOM SPORTS STREAMS",
        subtitle: primary?.subtitle || "High-speed live sports broadcasts, official network feeds, and direct streams.",
        badge: primary?.badge || "EXCLUSIVE FEEDS",
        bgUrl: primary?.bgUrl || "",
        playerPng: primary?.playerPng || "",
        gridBgUrl: primary?.gridBgUrl || "",
        displayMode: primary?.gridStyle || "shelf"
    };
    return res.json({ status: "success", config });
});

router.post('/sports-hub/config', requireAdmin, (req: Request, res: Response) => {
    const { title, subtitle, badge, bgUrl, playerPng, gridBgUrl, displayMode } = req.body;
    const db = getDB();
    ensureSportsContainers(db);
    
    if (db.sportsContainers && db.sportsContainers.length > 0) {
        db.sportsContainers[0] = {
            ...db.sportsContainers[0],
            title: (title !== undefined ? String(title).trim() : db.sportsContainers[0].title) || "CUSTOM SPORTS STREAMS",
            subtitle: (subtitle !== undefined ? String(subtitle).trim() : db.sportsContainers[0].subtitle),
            badge: (badge !== undefined ? String(badge).trim() : db.sportsContainers[0].badge) || "EXCLUSIVE FEEDS",
            bgUrl: bgUrl !== undefined ? String(bgUrl).trim() : db.sportsContainers[0].bgUrl,
            playerPng: playerPng !== undefined ? String(playerPng).trim() : db.sportsContainers[0].playerPng,
            gridBgUrl: gridBgUrl !== undefined ? String(gridBgUrl).trim() : db.sportsContainers[0].gridBgUrl,
            gridStyle: displayMode ? (['shelf', 'grid', 'glass_cards', 'compact_chips', 'spotlight'].includes(displayMode) ? displayMode : db.sportsContainers[0].gridStyle) : db.sportsContainers[0].gridStyle
        };
    }

    db.sportsHubConfig = {
        title: db.sportsContainers?.[0]?.title || "CUSTOM SPORTS STREAMS",
        subtitle: db.sportsContainers?.[0]?.subtitle,
        badge: db.sportsContainers?.[0]?.badge,
        bgUrl: db.sportsContainers?.[0]?.bgUrl,
        playerPng: db.sportsContainers?.[0]?.playerPng,
        gridBgUrl: db.sportsContainers?.[0]?.gridBgUrl,
        displayMode: db.sportsContainers?.[0]?.gridStyle
    };

    saveDB(db);
    return res.json({ status: "success", message: "Sports Hub container configuration updated successfully", config: db.sportsHubConfig });
});

router.put('/sports-hub/config', requireAdmin, (req: Request, res: Response) => {
    const { title, subtitle, badge, bgUrl, playerPng, gridBgUrl, displayMode } = req.body;
    const db = getDB();
    ensureSportsContainers(db);

    if (db.sportsContainers && db.sportsContainers.length > 0) {
        db.sportsContainers[0] = {
            ...db.sportsContainers[0],
            title: (title !== undefined ? String(title).trim() : db.sportsContainers[0].title) || "CUSTOM SPORTS STREAMS",
            subtitle: (subtitle !== undefined ? String(subtitle).trim() : db.sportsContainers[0].subtitle),
            badge: (badge !== undefined ? String(badge).trim() : db.sportsContainers[0].badge) || "EXCLUSIVE FEEDS",
            bgUrl: bgUrl !== undefined ? String(bgUrl).trim() : db.sportsContainers[0].bgUrl,
            playerPng: playerPng !== undefined ? String(playerPng).trim() : db.sportsContainers[0].playerPng,
            gridBgUrl: gridBgUrl !== undefined ? String(gridBgUrl).trim() : db.sportsContainers[0].gridBgUrl,
            gridStyle: displayMode ? (['shelf', 'grid', 'glass_cards', 'compact_chips', 'spotlight'].includes(displayMode) ? displayMode : db.sportsContainers[0].gridStyle) : db.sportsContainers[0].gridStyle
        };
    }

    db.sportsHubConfig = {
        title: db.sportsContainers?.[0]?.title || "CUSTOM SPORTS STREAMS",
        subtitle: db.sportsContainers?.[0]?.subtitle,
        badge: db.sportsContainers?.[0]?.badge,
        bgUrl: db.sportsContainers?.[0]?.bgUrl,
        playerPng: db.sportsContainers?.[0]?.playerPng,
        gridBgUrl: db.sportsContainers?.[0]?.gridBgUrl,
        displayMode: db.sportsContainers?.[0]?.gridStyle
    };

    saveDB(db);
    return res.json({ status: "success", message: "Sports Hub container configuration updated successfully", config: db.sportsHubConfig });
});



router.post('/sports/extract', requireAdmin, async (req: Request, res: Response) => {
    try {
        await getOrUpdatePlaylist(true);
        return res.json({ status: "success", message: "Sports M3U extracted successfully" });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

router.get('/sports/check', requireAdmin, async (req: Request, res: Response) => {
    const url = req.query.url as string;
    if (!url) {
        return res.status(400).json({ status: "error", message: "Missing URL query parameter" });
    }

    const testStream = async () => {
        const checkRes = await axios({
            method: 'get',
            url: url,
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            responseType: 'stream'
        });

        // Destroy stream immediately to prevent huge downloading
        if (checkRes.data && typeof checkRes.data.destroy === 'function') {
            checkRes.data.destroy();
        }

        return checkRes;
    };

    try {
        const checkRes = await testStream();
        if (checkRes.status >= 200 && checkRes.status < 400) {
            return res.json({ status: "active", message: "Active & Responsive" });
        } else {
            return res.json({ status: "damaged", message: `Damaged (HTTP ${checkRes.status})` });
        }
    } catch (err: any) {
        // Retry once after 1 second for transient drops
        try {
            await new Promise(r => setTimeout(r, 1000));
            const retryRes = await testStream();
            if (retryRes.status >= 200 && retryRes.status < 400) {
                return res.json({ status: "active", message: "Active & Responsive" });
            }
        } catch (retryErr: any) {}

        return res.json({ status: "damaged", message: `Damaged (${err.message})` });
    }
});

/**
 * Universal Embed Scraper & Channel Studio Endpoints
 */
router.post('/embed-scraper/analyze', requireAdmin, async (req: Request, res: Response) => {
    const { url, headers } = req.body;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ status: "error", message: "Embed or stream URL is required." });
    }

    try {
        const result = await scrapeEmbedToM3u8(url, headers);
        return res.json({ status: result.success ? "success" : "warning", data: result });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message || "Failed to analyze embed URL" });
    }
});

router.post('/embed-scraper/test', requireAdmin, async (req: Request, res: Response) => {
    const { url, headers } = req.body;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ status: "error", message: "Stream URL is required." });
    }

    try {
        const result = await testM3u8Connectivity(url, headers);
        return res.json({ status: result.active ? "success" : "failed", result });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

router.post('/embed-scraper/save-channel', requireAdmin, (req: Request, res: Response) => {
    const {
        name,
        embedUrl,
        streamUrl,
        proxyMode = 'stalker_proxy',
        referer,
        origin,
        category = 'Live Sports',
        logo,
        bgUrl,
        containerId = 'default_showcase',
        isTokenBased = false,
        tokenRefreshInterval = 60
    } = req.body;

    if (!name || (!embedUrl && !streamUrl)) {
        return res.status(400).json({ status: "error", message: "Channel name and embed/stream URL are required." });
    }

    const db = getDB();
    if (!db.customScrapedChannels) db.customScrapedChannels = [];
    if (!db.sports) db.sports = [];
    ensureSportsContainers(db);

    const channelId = `ch_scraped_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const effectiveStream = streamUrl || embedUrl;

    let finalPlayUrl = effectiveStream;
    if (proxyMode === 'stalker_proxy' || isTokenBased) {
        finalPlayUrl = `/live.php?token=STALKER_PRO&url=${encodeURIComponent(effectiveStream)}${referer ? `&referer=${encodeURIComponent(referer)}` : ''}`;
    }

    const channelObj = {
        id: channelId,
        name: name.trim(),
        embedUrl: embedUrl ? embedUrl.trim() : '',
        streamUrl: effectiveStream ? effectiveStream.trim() : '',
        playUrl: finalPlayUrl,
        proxyMode,
        referer: referer ? referer.trim() : '',
        origin: origin ? origin.trim() : '',
        category: category.trim(),
        logo: logo ? logo.trim() : 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/tv.svg',
        bgUrl: bgUrl ? bgUrl.trim() : undefined,
        containerId: containerId.trim(),
        isTokenBased: !!isTokenBased,
        tokenRefreshInterval: Number(tokenRefreshInterval) || 60,
        isCdnApproved: true,
        approvedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
    };

    db.customScrapedChannels.push(channelObj);

    // Also register in db.sports so it renders automatically in Sports Consumet Showcase & M3U
    const sportsItem: SportsSection = {
        id: channelId,
        title: name.trim(),
        icon: 'trophy',
        url: finalPlayUrl,
        bgUrl: bgUrl ? bgUrl.trim() : (logo ? logo.trim() : undefined),
        containerId: containerId.trim(),
        addedAt: new Date().toISOString()
    };
    db.sports.push(sportsItem);

    saveDB(db);

    // Sync to assets/channels.json
    try {
        const channelsPath = path.join(process.cwd(), 'assets', 'channels.json');
        if (fs.existsSync(channelsPath)) {
            const raw = fs.readFileSync(channelsPath, 'utf8');
            const chJson = JSON.parse(raw);
            if (Array.isArray(chJson)) {
                chJson.push({
                    name: name.trim(),
                    logo: channelObj.logo,
                    url: finalPlayUrl,
                    category: category.trim(),
                    channel_id: channelId
                });
                fs.writeFileSync(channelsPath, JSON.stringify(chJson, null, 2), 'utf8');
            }
        }
    } catch (e) {}

    return res.json({
        status: "success",
        message: `Custom Channel "${name}" successfully registered and broadcast to Sports Consumet!`,
        channel: channelObj
    });
});

router.get('/embed-scraper/channels', requireAdmin, (req: Request, res: Response) => {
    const db = getDB();
    return res.json({ status: "success", channels: db.customScrapedChannels || [] });
});

router.delete('/embed-scraper/channels/:id', requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const db = getDB();

    if (db.customScrapedChannels) {
        db.customScrapedChannels = db.customScrapedChannels.filter((c: any) => c.id !== id);
    }
    if (db.sports) {
        db.sports = db.sports.filter(s => s.id !== id);
    }

    saveDB(db);
    return res.json({ status: "success", message: "Scraped channel removed." });
});

router.put('/embed-scraper/channels/:id', requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const db = getDB();
    if (!db.customScrapedChannels) db.customScrapedChannels = [];

    const idx = db.customScrapedChannels.findIndex((c: any) => c.id === id);
    if (idx === -1) {
        return res.status(404).json({ status: "error", message: "Channel not found." });
    }

    const { name, streamUrl, embedUrl, proxyMode, referer, origin, category, logo, bgUrl, containerId, isTokenBased } = req.body;
    const updated = {
        ...db.customScrapedChannels[idx],
        name: name !== undefined ? name.trim() : db.customScrapedChannels[idx].name,
        streamUrl: streamUrl !== undefined ? streamUrl.trim() : db.customScrapedChannels[idx].streamUrl,
        embedUrl: embedUrl !== undefined ? embedUrl.trim() : db.customScrapedChannels[idx].embedUrl,
        proxyMode: proxyMode !== undefined ? proxyMode : db.customScrapedChannels[idx].proxyMode,
        referer: referer !== undefined ? referer.trim() : db.customScrapedChannels[idx].referer,
        origin: origin !== undefined ? origin.trim() : db.customScrapedChannels[idx].origin,
        category: category !== undefined ? category.trim() : db.customScrapedChannels[idx].category,
        logo: logo !== undefined ? logo.trim() : db.customScrapedChannels[idx].logo,
        bgUrl: bgUrl !== undefined ? bgUrl.trim() : db.customScrapedChannels[idx].bgUrl,
        containerId: containerId !== undefined ? containerId.trim() : db.customScrapedChannels[idx].containerId,
        isTokenBased: isTokenBased !== undefined ? !!isTokenBased : db.customScrapedChannels[idx].isTokenBased,
        updatedAt: new Date().toISOString()
    };

    let finalPlayUrl = updated.streamUrl;
    if (updated.proxyMode === 'stalker_proxy' || updated.isTokenBased) {
        finalPlayUrl = `/live.php?token=STALKER_PRO&url=${encodeURIComponent(updated.streamUrl)}${updated.referer ? `&referer=${encodeURIComponent(updated.referer)}` : ''}`;
    }
    updated.playUrl = finalPlayUrl;

    db.customScrapedChannels[idx] = updated;

    // Update in db.sports
    if (db.sports) {
        const sIdx = db.sports.findIndex(s => s.id === id);
        if (sIdx !== -1) {
            db.sports[sIdx] = {
                ...db.sports[sIdx],
                title: updated.name,
                url: finalPlayUrl,
                bgUrl: updated.bgUrl || updated.logo,
                containerId: updated.containerId
            };
        }
    }

    saveDB(db);
    return res.json({ status: "success", message: "Channel updated successfully.", channel: updated });
});

/**
 * Live Events Administration Endpoints
 */
router.get('/live_events', requireAdmin, (req: Request, res: Response) => {
    const db = getDB();
    return res.json({ status: "success", liveEvents: db.liveEvents || [] });
});

router.post('/live_events', requireAdmin, (req: Request, res: Response) => {
    const { title, icon, url, bgUrl } = req.body;
    if (!title || !url) {
        return res.status(400).json({ status: "error", message: "Missing required parameters: title and url are required." });
    }
    const db = getDB();
    if (!db.liveEvents) db.liveEvents = [];
    const newItem: SportsSection = {
        id: 'event_' + Date.now().toString(),
        title: title.trim(),
        icon: (icon || 'zap').trim(),
        url: url.trim(),
        bgUrl: bgUrl ? bgUrl.trim() : undefined,
        
        
        addedAt: new Date().toISOString()
    };
    db.liveEvents.push(newItem);
    saveDB(db);
    return res.json({ status: "success", message: "Live Event added successfully", item: newItem });
});

router.put('/live_events/:id', requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const { title, icon, url, bgUrl } = req.body;
    if (!title || !url) {
        return res.status(400).json({ status: "error", message: "Missing required parameters: title and url are required." });
    }
    const db = getDB();
    if (!db.liveEvents) db.liveEvents = [];
    const itemIdx = db.liveEvents.findIndex((s: any) => s.id === id);
    if (itemIdx === -1) {
        return res.status(404).json({ status: "error", message: "Live Event not found" });
    }
    db.liveEvents[itemIdx] = {
        ...db.liveEvents[itemIdx],
        title: title.trim(),
        icon: (icon || 'zap').trim(),
        url: url.trim(),
        bgUrl: bgUrl !== undefined ? (bgUrl ? bgUrl.trim() : undefined) : db.liveEvents[itemIdx].bgUrl
    };
    saveDB(db);
    return res.json({ status: "success", message: "Live Event updated successfully", item: db.liveEvents[itemIdx] });
});

router.delete('/live_events/:id', requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const db = getDB();
    if (!db.liveEvents) db.liveEvents = [];
    const itemIdx = db.liveEvents.findIndex((s: any) => s.id === id);
    if (itemIdx === -1) {
        return res.status(404).json({ status: "error", message: "Live Event not found" });
    }
    db.liveEvents.splice(itemIdx, 1);
    saveDB(db);
    return res.json({ status: "success", message: "Live Event deleted successfully" });
});


// POST /consumet/builder - Advanced UI Builder for Consumet
router.post('/consumet/builder', requireAdmin, (req: Request, res: Response) => {
    const { action, title, subtitle, badge, bgUrl, playerPng, gridBgUrl, gridStyle, gridId, htmlContent } = req.body;
    const targetFile = path.join(process.cwd(), 'consumet.html');
    const backupFile = path.join(process.cwd(), 'consumet.html.bak');

    try {
        if (action === 'reset') {
            if (fs.existsSync(backupFile)) {
                fs.copyFileSync(backupFile, targetFile);
                return res.json({ status: "success", message: "Consumet restored to backup!" });
            } else {
                return res.status(400).json({ status: "error", message: "No backup found!" });
            }
        }

        // When adding or modifying a container via Builder, also save to real DB so it renders dynamically!
        if (action === 'add_container' || action === 'add_section' || action === 'create_ai_container') {
            const db = getDB();
            ensureSportsContainers(db);

            const containerTitle = (title || 'AI SHOWCASE CONTAINER').trim();
            const newContainer: SportsContainer = {
                id: gridId || ('container_' + Date.now().toString()),
                title: containerTitle,
                subtitle: subtitle || "Dynamic channel container generated via Consumet Studio Builder.",
                badge: badge || "SHOWCASE HUB",
                bgUrl: bgUrl ? String(bgUrl).trim() : "",
                playerPng: playerPng ? String(playerPng).trim() : "",
                gridBgUrl: gridBgUrl ? String(gridBgUrl).trim() : "",
                gridStyle: ['shelf', 'grid', 'glass_cards', 'compact_chips', 'spotlight'].includes(gridStyle) ? gridStyle : 'shelf',
                cardBg: "",
                enabled: true,
                order: (db.sportsContainers?.length || 0),
                createdAt: new Date().toISOString()
            };

            if (!db.sportsContainers) db.sportsContainers = [];
            db.sportsContainers.push(newContainer);
            saveDB(db);

            return res.json({ 
                status: "success", 
                message: `Container "${containerTitle}" created & synced to Consumet!`,
                container: newContainer
            });
        }

        if (!fs.existsSync(targetFile)) return res.status(404).json({ status: "error", message: "consumet.html not found" });
        let content = fs.readFileSync(targetFile, 'utf8');
        
        // Ensure backup exists before modifying
        if (!fs.existsSync(backupFile)) {
            fs.copyFileSync(targetFile, backupFile);
        }

        if (action === 'add_custom_html') {
            const snippet = htmlContent || '';
            if (content.includes('<!-- Footer -->')) {
                content = content.replace('<!-- Footer -->', snippet + '\n\n<!-- Footer -->');
            } else if (content.includes('</main>')) {
                content = content.replace('</main>', snippet + '\n</main>');
            } else {
                content = content.replace('</body>', snippet + '\n</body>');
            }
            fs.writeFileSync(targetFile, content);
        } else if (action === 'add_button') {
            const newBtn = `
            <button class="fixed bottom-4 right-4 z-50 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-transform hover:scale-105" onclick="alert('Custom button clicked!')">
                ${title || 'Custom Button'}
            </button>
            `;
            content = content.replace('</body>', newBtn + '\n</body>');
            fs.writeFileSync(targetFile, content);
        }

        return res.json({ status: "success", message: "UI modification applied successfully!" });

    } catch (e: any) {
        console.error("Builder Error:", e);
        return res.status(500).json({ status: "error", message: e.message });
    }
});

/**
 * =========================================================================
 * 🛡️ M3U HEALTH CHECK & QUARANTINE SYSTEM (EXCLUDING sportsM3u.ts)
 * =========================================================================
 */

// GET /api/admin/m3u/quarantine/status - Get background health scanner status
router.get('/m3u/quarantine/status', requireAdmin, (req: Request, res: Response) => {
    const status = QuarantineService.getScanStatus();
    const quarantined = QuarantineService.getQuarantined();
    return res.json({
        status: "success",
        scan: status,
        quarantinedCount: quarantined.length
    });
});

// POST /api/admin/m3u/quarantine/scan - Start scanning channels.json & streams
router.post('/m3u/quarantine/scan', requireAdmin, async (req: Request, res: Response) => {
    const scope = (req.body && req.body.scope) === 'all' ? 'all' : 'channels_json';
    const scanState = await QuarantineService.startBackgroundHealthScan(scope);
    return res.json({
        status: "success",
        message: scope === 'all' 
            ? "Background stream health scan started for channels.json and all M3U playlists."
            : "Background stream health scan started for channels.json (5,223 master channels).",
        scan: scanState
    });
});

// GET /api/admin/m3u/quarantine/list - List all quarantined channels
router.get('/m3u/quarantine/list', requireAdmin, (req: Request, res: Response) => {
    const list = QuarantineService.getQuarantined();
    return res.json({
        status: "success",
        quarantined: list,
        total: list.length
    });
});

// POST /api/admin/m3u/quarantine/delete - Delete a quarantined dead channel from its M3U playlist file and channels.json
router.post('/m3u/quarantine/delete', requireAdmin, (req: Request, res: Response) => {
    const { id, stream_url } = req.body;
    const target = id || stream_url;
    if (!target) {
        return res.status(400).json({ status: "error", message: "Channel ID or stream_url is required." });
    }

    const result = QuarantineService.deleteQuarantinedChannel(target);
    getOrUpdatePlaylist(true).catch(() => {});
    return res.json(result);
});

// POST /api/admin/m3u/quarantine/purge-all - Permanently delete ALL dead quarantined channels across channels.json and M3Us
router.post('/m3u/quarantine/purge-all', requireAdmin, (req: Request, res: Response) => {
    const result = QuarantineService.purgeAllQuarantinedChannels();
    getOrUpdatePlaylist(true).catch(() => {});
    return res.json({
        status: "success",
        deletedCount: result.deletedCount,
        message: result.message
    });
});

// POST /api/admin/m3u/quarantine/clear-data - Clear scanned diagnostic data without touching M3U files
router.post('/m3u/quarantine/clear-data', requireAdmin, (req: Request, res: Response) => {
    const result = QuarantineService.clearScannedData();
    return res.json({
        status: "success",
        count: result.count,
        message: result.message
    });
});

// POST /api/admin/m3u/quarantine/restore - Restore a channel from quarantine
router.post('/m3u/quarantine/restore', requireAdmin, (req: Request, res: Response) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ status: "error", message: "ID is required." });
    const result = QuarantineService.restoreChannel(id);
    return res.json(result);
});

// POST /api/admin/m3u/quarantine/check-single - Re-test a single stream URL
router.post('/m3u/quarantine/check-single', requireAdmin, async (req: Request, res: Response) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ status: "error", message: "URL is required" });
    const probe = await QuarantineService.probeStream(url);
    return res.json({ status: "success", probe });
});

/**
 * =========================================================================
 * 🎨 IPTV-ORG LOGO BATCH RESOLVER & ENRICHER
 * =========================================================================
 */

// POST /api/admin/logos/fix-all - Scan all M3Us and auto-assign authentic IPTV-ORG logos
router.post('/logos/fix-all', requireAdmin, (req: Request, res: Response) => {
    try {
        const result = LogoService.fixAllProjectM3uFiles();
        return res.json({
            status: "success",
            message: `Successfully resolved and assigned authentic IPTV-ORG logos across ${result.filesUpdated.length} playlist files! Total logos fixed: ${result.totalFixed}.`,
            filesUpdated: result.filesUpdated,
            totalFixed: result.totalFixed
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// POST /api/admin/logos/resolve - Test resolving a single channel name (with DuckDuckGo & Yahoo search)
router.post('/logos/resolve', requireAdmin, async (req: Request, res: Response) => {
    const { name, xmltv_id, currentLogo } = req.body;
    if (!name) return res.status(400).json({ status: "error", message: "Channel name is required." });
    try {
        const result = await LogoService.searchAndResolveLogo(name, xmltv_id, currentLogo);
        return res.json({ status: "success", name, logo: result.logo, engine: result.engine, verified: result.verified });
    } catch (e: any) {
        const fallbackLogo = LogoService.getLogoForChannel(name, xmltv_id, currentLogo);
        return res.json({ status: "success", name, logo: fallbackLogo, engine: 'fallback_sync' });
    }
});

// POST /api/admin/logos/search-web - Explicit web search logo scraper using DuckDuckGo / Yahoo / Wikipedia
router.post('/logos/search-web', requireAdmin, async (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ status: "error", message: "Channel name is required." });
    try {
        const result = await LogoService.searchAndResolveLogo(name);
        return res.json({ status: "success", name, logo: result.logo, engine: result.engine, verified: result.verified });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

/**
 * =========================================================================
 * 📂 CHANNEL & SUB-SECTION MANUAL ORGANIZER
 * =========================================================================
 */

// GET /api/admin/m3u/playlists-list - Get all available playlists for manual organization
router.get('/m3u/playlists-list', requireAdmin, (req: Request, res: Response) => {
    const list = M3uReorganizeService.listAvailablePlaylists();
    return res.json({ status: "success", playlists: list });
});

// GET /api/admin/m3u/channels - Get all channels & sub-sections for a playlist
router.get('/m3u/channels', requireAdmin, (req: Request, res: Response) => {
    const playlistId = (req.query.playlist_id as string) || 'kliv_zob';
    try {
        const data = M3uReorganizeService.getChannels(playlistId);
        return res.json({
            status: "success",
            playlistId,
            subsections: data.subsections,
            channels: data.channels,
            total: data.channels.length
        });
    } catch (e: any) {
        return res.status(400).json({ status: "error", message: e.message });
    }
});

// POST /api/admin/m3u/channels/save - Save updated channel list & sub-sections to disk
router.post('/m3u/channels/save', requireAdmin, (req: Request, res: Response) => {
    const { playlistId, channels } = req.body;
    if (!playlistId || !Array.isArray(channels)) {
        return res.status(400).json({ status: "error", message: "playlistId and channels array are required." });
    }

    try {
        const result = M3uReorganizeService.saveChannels(playlistId, channels);
        getOrUpdatePlaylist(true).catch(() => {});
        return res.json(result);
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// POST /api/admin/m3u/channels/batch-move - Move selected channels to a sub-section
router.post('/m3u/channels/batch-move', requireAdmin, (req: Request, res: Response) => {
    const { playlistId, channelIds, targetSubsection } = req.body;
    if (!playlistId || !Array.isArray(channelIds) || !targetSubsection) {
        return res.status(400).json({ status: "error", message: "playlistId, channelIds array, and targetSubsection are required." });
    }

    try {
        const result = M3uReorganizeService.batchMoveToSubsection(playlistId, channelIds, targetSubsection);
        getOrUpdatePlaylist(true).catch(() => {});
        return res.json({
            status: "success",
            message: `Moved ${result.updatedCount} channels to subsection '${targetSubsection}'!`,
            updatedCount: result.updatedCount
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// POST /api/admin/m3u/subsection/rename - Rename a sub-section across all channels
router.post('/m3u/subsection/rename', requireAdmin, (req: Request, res: Response) => {
    const { playlistId, oldName, newName } = req.body;
    if (!playlistId || !oldName || !newName) {
        return res.status(400).json({ status: "error", message: "playlistId, oldName, and newName are required." });
    }

    try {
        const result = M3uReorganizeService.renameSubsection(playlistId, oldName, newName);
        getOrUpdatePlaylist(true).catch(() => {});
        return res.json({
            status: "success",
            message: `Renamed subsection '${oldName}' to '${newName}' across ${result.updatedCount} channels!`,
            updatedCount: result.updatedCount
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// POST /api/admin/m3u/subsection/delete - Delete a sub-section (moves channels to fallback group)
router.post('/m3u/subsection/delete', requireAdmin, (req: Request, res: Response) => {
    const { playlistId, subsectionName, fallbackGroup } = req.body;
    if (!playlistId || !subsectionName) {
        return res.status(400).json({ status: "error", message: "playlistId and subsectionName are required." });
    }

    try {
        const result = M3uReorganizeService.deleteSubsection(playlistId, subsectionName, fallbackGroup || 'General');
        getOrUpdatePlaylist(true).catch(() => {});
        return res.json({
            status: "success",
            message: `Sub-section '${subsectionName}' deleted! Reassigned ${result.updatedCount} channels to '${fallbackGroup || 'General'}'.`,
            updatedCount: result.updatedCount
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// POST /api/admin/m3u/channel/add - Add a new channel to a playlist and sub-section
router.post('/m3u/channel/add', requireAdmin, (req: Request, res: Response) => {
    const { playlistId, name, stream_url, group, logo, xmltv_id, user_agent } = req.body;
    if (!playlistId || !stream_url) {
        return res.status(400).json({ status: "error", message: "playlistId and stream_url are required." });
    }

    try {
        const result = M3uReorganizeService.addChannel(playlistId, {
            name: name || 'New Channel',
            stream_url,
            group: group || 'General',
            logo,
            xmltv_id,
            user_agent
        });
        getOrUpdatePlaylist(true).catch(() => {});
        return res.json({
            status: "success",
            message: result.message,
            channel: result.channel
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// POST /api/admin/m3u/channel/update - Edit channel name, logo, stream URL, sub-section, etc.
router.post('/m3u/channel/update', requireAdmin, (req: Request, res: Response) => {
    const { playlistId, channelId, name, stream_url, group, logo, xmltv_id, user_agent } = req.body;
    if (!playlistId || !channelId) {
        return res.status(400).json({ status: "error", message: "playlistId and channelId are required." });
    }

    try {
        const result = M3uReorganizeService.updateChannel(playlistId, channelId, {
            name,
            stream_url,
            group,
            logo,
            xmltv_id,
            user_agent
        });
        getOrUpdatePlaylist(true).catch(() => {});
        return res.json({
            status: "success",
            message: result.message,
            channel: result.channel
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// POST /api/admin/m3u/channel/delete - Delete a channel from playlist
router.post('/m3u/channel/delete', requireAdmin, (req: Request, res: Response) => {
    const { playlistId, channelId } = req.body;
    if (!playlistId || !channelId) {
        return res.status(400).json({ status: "error", message: "playlistId and channelId are required." });
    }

    try {
        const result = M3uReorganizeService.deleteChannel(playlistId, channelId);
        getOrUpdatePlaylist(true).catch(() => {});
        return res.json({
            status: "success",
            message: result.message
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// GET /api/admin/m3u/library-channels - Get all channels across our playlists & portal for channel picker
router.get('/m3u/library-channels', requireAdmin, (req: Request, res: Response) => {
    const query = (req.query.q as string) || '';
    const playlistId = (req.query.playlist_id as string) || '';
    const group = (req.query.group as string) || '';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 500;

    try {
        const result = M3uReorganizeService.getAllLibraryChannels({
            query,
            playlistId,
            group,
            limit
        });
        return res.json({
            status: "success",
            ...result
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// POST /api/admin/m3u/channels/batch-add - Batch import selected channels from our library
router.post('/m3u/channels/batch-add', requireAdmin, (req: Request, res: Response) => {
    const { playlistId, targetGroup, channels } = req.body;
    if (!playlistId || !Array.isArray(channels) || channels.length === 0) {
        return res.status(400).json({ status: "error", message: "playlistId and non-empty channels array are required." });
    }

    try {
        const result = M3uReorganizeService.batchAddChannels(playlistId, targetGroup || 'General', channels);
        getOrUpdatePlaylist(true).catch(() => {});
        return res.json({
            status: "success",
            ...result
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// ==========================================
// CHANNELS JSON STUDIO & M3U CONVERTER ROUTES
// ==========================================

// GET /api/admin/channels-json/stats - Get catalog stats
router.get('/channels-json/stats', requireAdmin, (req: Request, res: Response) => {
    try {
        const stats = ChannelJsonService.getStats();
        return res.json({
            status: "success",
            stats
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// GET /api/admin/channels-json/list - Paginated channel list
router.get('/channels-json/list', requireAdmin, (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string || '1', 10);
        const limit = parseInt(req.query.limit as string || '50', 10);
        const search = (req.query.search as string) || '';
        const genre = (req.query.genre as string) || '';
        const source = (req.query.source as string) || '';

        const result = ChannelJsonService.listChannels({
            page,
            limit,
            search,
            genre,
            source
        });

        return res.json({
            status: "success",
            ...result
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// POST /api/admin/channels-json/convert - Convert M3U (file/text/url) to channels.json
router.post('/channels-json/convert', requireAdmin, safeUploadSingle('file'), async (req: Request, res: Response) => {
    try {
        let content = (req.body.m3uContent as string) || '';
        const m3uUrl = (req.body.m3uUrl as string) || '';
        const mode = (req.body.mode as 'preview' | 'append' | 'replace') || 'append';
        const defaultGenre = (req.body.defaultGenre as string) || 'Custom M3U';
        const defaultSource = (req.body.defaultSource as string) || 'm3u_converter';
        const deduplicate = req.body.deduplicate !== 'false' && req.body.deduplicate !== false;

        // If file was uploaded via multer
        if (req.file) {
            const uploadedPath = req.file.path;
            if (fs.existsSync(uploadedPath)) {
                content = fs.readFileSync(uploadedPath, 'utf8');
                // Cleanup temp file
                try { fs.unlinkSync(uploadedPath); } catch(err) {}
            }
        }

        const result = await ChannelJsonService.convertM3u({
            content,
            m3uUrl,
            mode,
            defaultGenre,
            defaultSource,
            deduplicate
        });

        // Trigger cache refresh
        if (mode !== 'preview') {
            getOrUpdatePlaylist(true).catch(() => {});
        }

        return res.json(result);
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// POST /api/admin/channels-json/channel - Add single channel
router.post('/channels-json/channel', requireAdmin, (req: Request, res: Response) => {
    try {
        const { name, channel_id, genre, logo, source } = req.body;
        if (!name || !channel_id) {
            return res.status(400).json({ status: "error", message: "Channel Name and Stream URL are required." });
        }
        const created = ChannelJsonService.addSingleChannel({
            name,
            channel_id,
            genre,
            logo,
            source
        });
        getOrUpdatePlaylist(true).catch(() => {});
        return res.json({
            status: "success",
            message: `Channel "${created.name}" added successfully.`,
            channel: created
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// PUT /api/admin/channels-json/channel - Update single channel
router.put('/channels-json/channel', requireAdmin, (req: Request, res: Response) => {
    try {
        const { originalChannelId, name, channel_id, genre, logo, source } = req.body;
        if (!originalChannelId) {
            return res.status(400).json({ status: "error", message: "originalChannelId is required." });
        }
        const updated = ChannelJsonService.updateSingleChannel(originalChannelId, {
            name,
            channel_id,
            genre,
            logo,
            source
        });
        getOrUpdatePlaylist(true).catch(() => {});
        return res.json({
            status: "success",
            message: `Channel updated successfully.`,
            channel: updated
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// DELETE /api/admin/channels-json/channel - Delete single channel
router.delete('/channels-json/channel', requireAdmin, (req: Request, res: Response) => {
    try {
        const channel_id = (req.body.channel_id as string) || (req.query.channel_id as string) || (req.body.stream_url as string) || (req.query.stream_url as string);
        const name = (req.body.name as string) || (req.query.name as string);
        if (!channel_id && !name) {
            return res.status(400).json({ status: "error", message: "channel_id or name is required." });
        }
        const ok = ChannelJsonService.deleteSingleChannel(channel_id, name);
        if (!ok) {
            return res.status(404).json({ status: "error", message: "Channel not found in database." });
        }
        getOrUpdatePlaylist(true).catch(() => {});
        return res.json({
            status: "success",
            message: "Channel deleted successfully."
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// POST /api/admin/channels-json/delete-single - POST alias for delete single channel
router.post('/channels-json/delete-single', requireAdmin, (req: Request, res: Response) => {
    try {
        const channel_id = (req.body.channel_id as string) || (req.query.channel_id as string) || (req.body.stream_url as string) || (req.query.stream_url as string);
        const name = (req.body.name as string) || (req.query.name as string);
        if (!channel_id && !name) {
            return res.status(400).json({ status: "error", message: "channel_id or name is required." });
        }
        const ok = ChannelJsonService.deleteSingleChannel(channel_id, name);
        if (!ok) {
            return res.status(404).json({ status: "error", message: "Channel not found in database." });
        }
        getOrUpdatePlaylist(true).catch(() => {});
        return res.json({
            status: "success",
            message: "Channel deleted successfully."
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// POST /api/admin/channels-json/deduplicate - Deduplicate channels
router.post('/channels-json/deduplicate', requireAdmin, (req: Request, res: Response) => {
    try {
        const result = ChannelJsonService.deduplicateChannels();
        getOrUpdatePlaylist(true).catch(() => {});
        return res.json({
            status: "success",
            message: `Removed ${result.removedCount} duplicate channels.`,
            ...result
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// POST /api/admin/channels-json/clear-all - Full deletion of all channels
router.post('/channels-json/clear-all', requireAdmin, (req: Request, res: Response) => {
    try {
        const result = ChannelJsonService.clearAllChannels();
        getOrUpdatePlaylist(true).catch(() => {});
        return res.json({
            status: "success",
            message: `Successfully cleared all channels (${result.clearedCount} channels deleted). A safety backup was saved.`,
            ...result
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// POST /api/admin/channels-json/fix-logos - Scrape & replace broken logos with Logopedia, DuckDuckGo, Yahoo & Wikimedia backup
router.post('/channels-json/fix-logos', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { forceRescrape, batchSize } = req.body || {};
        const result = await ChannelJsonService.fixAllLogos({
            forceRescrape: forceRescrape === true,
            batchSize: typeof batchSize === 'number' ? batchSize : 6
        });
        getOrUpdatePlaylist(true).catch(() => {});
        return res.json({
            status: "success",
            message: `Logopedia, DuckDuckGo & Yahoo web logo search complete! Scanned ${result.totalChannels} channels, fixed/upgraded ${result.fixedCount} logos online.`,
            ...result
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// GET & POST /api/admin/channels-json/fix-logos-stream - Server-Sent Events (SSE) stream for live progress bar
const handleFixLogosStream = async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const sendEvent = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        if ((res as any).flush) (res as any).flush();
    };

    try {
        const forceRescrape = req.query.forceRescrape === 'true' || req.body?.forceRescrape === true;
        const batchSize = parseInt(String(req.query.batchSize || req.body?.batchSize || '6'), 10) || 6;

        sendEvent({ type: 'start', message: 'Starting TV logo search across Logopedia, DuckDuckGo, Yahoo & Wikimedia...' });

        const result = await ChannelJsonService.fixAllLogos({
            forceRescrape,
            batchSize,
            onProgress: (info) => {
                sendEvent({
                    type: 'progress',
                    current: info.current,
                    total: info.total,
                    percent: info.percent,
                    channelName: info.channelName,
                    status: info.status,
                    logo: info.logo,
                    engine: info.engine
                });
            }
        });

        getOrUpdatePlaylist(true).catch(() => {});

        sendEvent({
            type: 'complete',
            totalChannels: result.totalChannels,
            fixedCount: result.fixedCount,
            alreadyValidCount: result.alreadyValidCount,
            message: `Logo search complete! Processed ${result.totalChannels} channels, resolved ${result.fixedCount} official logos.`
        });
        res.end();
    } catch (e: any) {
        sendEvent({ type: 'error', message: e.message || 'Error occurred during logo scrape' });
        res.end();
    }
};

router.get('/channels-json/fix-logos-stream', requireAdmin, handleFixLogosStream);
router.post('/channels-json/fix-logos-stream', requireAdmin, handleFixLogosStream);

// POST /api/admin/channels-json/search-logo - Search web logo for single channel using Logopedia, DuckDuckGo, Yahoo & Wikimedia
router.post('/channels-json/search-logo', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { name, channel_id, currentLogo } = req.body;
        if (!name) return res.status(400).json({ status: "error", message: "Channel name is required." });
        const result = await LogoService.searchAndResolveLogo(name, undefined, currentLogo);
        return res.json({
            status: "success",
            name,
            channel_id,
            logo: result.logo,
            engine: result.engine,
            verified: result.verified
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// POST /api/admin/channels-json/batch-delete - Delete multiple channels or by genre
router.post('/channels-json/batch-delete', requireAdmin, (req: Request, res: Response) => {
    try {
        const { channelIds, genre } = req.body;
        let count = 0;
        if (genre) {
            count = ChannelJsonService.deleteByGenre(genre);
        } else if (Array.isArray(channelIds)) {
            count = ChannelJsonService.batchDelete(channelIds);
        } else {
            return res.status(400).json({ status: "error", message: "Either channelIds array or genre string must be provided." });
        }
        getOrUpdatePlaylist(true).catch(() => {});
        return res.json({
            status: "success",
            message: `Successfully deleted ${count} channels.`,
            deletedCount: count
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// POST /api/admin/channels-json/deduplicate - Deduplicate entire channels.json
router.post('/channels-json/deduplicate', requireAdmin, (req: Request, res: Response) => {
    try {
        const result = ChannelJsonService.deduplicateAll();
        getOrUpdatePlaylist(true).catch(() => {});
        return res.json({
            status: "success",
            message: `Deduplication complete. Removed ${result.removed} duplicate streams.`,
            ...result
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// GET /api/admin/channels-json/export-m3u - Download as M3U playlist
router.get('/channels-json/export-m3u', requireAdmin, (req: Request, res: Response) => {
    try {
        const m3uContent = ChannelJsonService.generateM3u();
        res.setHeader('Content-Type', 'application/x-mpegurl; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="channels_database.m3u"');
        return res.send(m3uContent);
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// GET /api/admin/channels-json/download - Download raw channels.json
router.get('/channels-json/download', requireAdmin, (req: Request, res: Response) => {
    try {
        const channels = ChannelJsonService.getChannels();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="channels.json"');
        return res.send(JSON.stringify(channels, null, 4));
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});


// POST /api/admin/channels-json/import-m3u-vault - Scan & import all M3U storage files into channels.json
router.post('/channels-json/import-m3u-vault', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { mode, deduplicate } = req.body || {};
        const result = await ChannelJsonService.importAllM3uStorage({
            mode: mode === 'replace' ? 'replace' : 'append',
            deduplicate: deduplicate !== false
        });
        await getOrUpdatePlaylist(true);
        return res.json({
            status: "success",
            message: `Successfully scanned and imported ${result.totalImported} channels from all M3U storage locations into channels.json.`,
            stats: result
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// POST /api/admin/channels-json/sync-all - Synchronize channels.json across all M3U storage & endpoints
router.post('/channels-json/sync-all', requireAdmin, async (req: Request, res: Response) => {
    try {
        const m3u = await getOrUpdatePlaylist(true);
        const channels = ChannelJsonService.getChannels();
        return res.json({
            status: "success",
            message: `All M3U storage and channels.json synchronized successfully. Total live channels: ${channels.length}`,
            totalChannels: channels.length
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// POST /api/admin/channels-json/sync-cache - Force sync & refresh sports playlist cache
router.post('/channels-json/sync-cache', requireAdmin, async (req: Request, res: Response) => {
    try {
        await getOrUpdatePlaylist(true);
        return res.json({
            status: "success",
            message: "Master Sports M3U & Channel catalog cache refreshed successfully."
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// --- STREAM HEALTH CHECKER ENDPOINTS ---

// GET /api/admin/health/status - Get stream health scan summary and records
router.get('/health/status', requireAdmin, (req: Request, res: Response) => {
    try {
        const summary = streamHealthService.getSummary();
        const records = streamHealthService.getRecords();
        return res.json({
            status: "success",
            summary,
            records
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e?.message || "Failed to fetch health status" });
    }
});

// POST /api/admin/health/scan - Trigger immediate manual background stream scan
router.post('/health/scan', requireAdmin, async (req: Request, res: Response) => {
    try {
        // Run scan asynchronously or synchronously
        const summaryPromise = streamHealthService.runHealthScan();
        return res.json({
            status: "success",
            message: "Stream health scan initiated across channel catalog.",
            summary: streamHealthService.getSummary()
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e?.message || "Failed to initiate health scan" });
    }
});

// POST /api/admin/health/config - Update scan interval and auto-switch policy
router.post('/health/config', requireAdmin, (req: Request, res: Response) => {
    try {
        const { scanIntervalMinutes, autoSwitchEnabled } = req.body;
        const summary = streamHealthService.updateConfig({
            scanIntervalMinutes: typeof scanIntervalMinutes === 'number' ? scanIntervalMinutes : undefined,
            autoSwitchEnabled: typeof autoSwitchEnabled === 'boolean' ? autoSwitchEnabled : undefined
        });
        return res.json({
            status: "success",
            message: "Stream health checker configuration updated.",
            summary
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e?.message || "Failed to update config" });
    }
});

// --- AUTOMATED STREAM HEALTH & FAILOVER ENDPOINTS ---

// GET /api/admin/stream-health/status
router.get('/stream-health/status', requireAdmin, (req: Request, res: Response) => {
    try {
        const summary = streamHealthService.getSummary();
        const rawRecords = streamHealthService.getRecords();

        const streams = rawRecords.map(r => ({
            id: r.id,
            name: r.name,
            url: r.url,
            status: r.status === 'healthy' ? 'online' : (r.status === 'backup_active' ? 'degraded' : 'offline'),
            rawStatus: r.status,
            latencyMs: r.latencyMs,
            httpStatus: r.status === 'healthy' ? 200 : (r.status === 'backup_active' ? 200 : 503),
            lastChecked: r.lastChecked,
            failoverUrl: r.backupUrl || ''
        }));

        return res.json({
            status: "success",
            autoFailover: summary.autoSwitchEnabled,
            summary: {
                totalMonitored: summary.totalScanned,
                online: summary.healthyCount,
                degraded: summary.backupSwitchedCount,
                offline: summary.failingCount,
                lastScanTime: summary.lastScanTime,
                isScanning: summary.isScanning
            },
            streams
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e?.message || "Failed to fetch stream health status" });
    }
});

// POST /api/admin/stream-health/scan - Trigger immediate scan
router.post('/stream-health/scan', requireAdmin, async (req: Request, res: Response) => {
    try {
        const summary = await streamHealthService.runHealthScan();
        return res.json({
            status: "success",
            message: "Health scan completed",
            testedCount: summary.totalScanned,
            summary
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e?.message || "Stream health scan failed" });
    }
});

// POST /api/admin/stream-health/config - Update stream health configuration
router.post('/stream-health/config', requireAdmin, (req: Request, res: Response) => {
    try {
        const { autoFailover, autoSwitchEnabled, scanIntervalMinutes } = req.body;
        const configToUpdate: { autoSwitchEnabled?: boolean; scanIntervalMinutes?: number } = {};

        if (typeof autoFailover === 'boolean') {
            configToUpdate.autoSwitchEnabled = autoFailover;
        } else if (typeof autoSwitchEnabled === 'boolean') {
            configToUpdate.autoSwitchEnabled = autoSwitchEnabled;
        }

        if (typeof scanIntervalMinutes === 'number') {
            configToUpdate.scanIntervalMinutes = scanIntervalMinutes;
        }

        const updatedSummary = streamHealthService.updateConfig(configToUpdate);
        return res.json({
            status: "success",
            message: "Stream health configuration updated",
            config: {
                autoFailover: updatedSummary.autoSwitchEnabled,
                scanIntervalMinutes: updatedSummary.scanIntervalMinutes
            }
        });
    } catch (e: any) {
        return res.status(500).json({ status: "error", message: e?.message || "Failed to update configuration" });
    }
});

export default router;

