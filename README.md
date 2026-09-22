# ⚡ Stalker Pro & Quantum OTT Streaming Platform

[![Version](https://img.shields.io/badge/version-2.5.0-cyan.svg)](https://github.com/hariqwert/hl3-ott-player)
[![Engine](https://img.shields.io/badge/engine-TorrServer%20%2B%20Xtream%20%2B%20Stalker-emerald.svg)](https://github.com/hariqwert/hl3-ott-player)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

An enterprise-grade, high-performance multimedia streaming suite and IPTV/Torrent portal. Powered by TypeScript, Node.js, Express, Three.js, TorrServer, and Web Audio API.

---

## 🌟 Highlights & Major Features

### 🎬 1. Modernized Consumet Portal (`consumet.html`)
- **16:9 Widescreen Sports Cards**: Sleek widescreen layout replacing vertical cards with high-contrast badge overlays.
- **Real-Time Live Indicators**: Animated emerald pulse dot with automatic stream resolution parsing (`HD`, `FHD`, `4K`).
- **Lag-Free Grid Pagination**: Dynamic 60-item chunked pagination with IntersectionObserver lazy rendering across 3,540+ live TV channels.
- **EPG Integration & Favorites**: Quick-access EPG modal with channel favoriting stored locally.

### ⚡ 2. Buffer-Free Streaming Proxy & Xtream Engine (`src/proxy.ts`, `src/xtream/`)
- **Direct Socket Piping**: Instant zero-memory upstream buffer proxying (`upstreamRes.pipe(res)`).
- **fMP4 & `#EXT-X-MAP` Support**: Automatic initialization map URI rewriting for modern HLS fMP4 and fragmented MP4 live streams.
- **Continuous Xtream Keep-Alive**: Background keep-alive loop maintaining active Xtream credentials without drops.

### 🚀 3. High-Speed BitTorrent Engine (`public/torrent.html`, `src/routes/torrent.ts`)
- **Ultra-Fast Search**: Parallel `Promise.allSettled` queries searching PirateBay, YTS, Nyaa, and Torrentio in under 3.5 seconds (returning 150+ streams).
- **Glitch-Free Seeking**: Debounced seeking controls preventing timeline jump glitches.
- **1-Click Download**: Integrated media download button for active torrent and direct video streams.

### 🌌 4. Quantum Maintenance Mode & 3D Audio Lounge (`server.ts`)
- **Audio-Reactive 3D Visualizer**: Real-time Three.js scene featuring a pulsing Crystalline Quantum Core, 4 rotating orbital gimbal rings, and a 1,200-particle vortex nebula.
- **Spacetime Matrix Plane**: Bass-responsive wireframe wave displacement with mouse gravity warp and click ripple physics.
- **Dynamic Cyber-Neon Color Shift**: Scene colors shift across cyan, violet, magenta, amber, and emerald in sync with audio frequency energy.
- **Embedded Audio Engine**: Full-featured audio player supporting JioSaavn and YouTube streaming with automatic playlist synchronization configured via `hari.html`.
- **Live Watchdog Sync**: Real-time status detection updating all connected browser clients within 2 seconds without reload loops.

### 🔒 5. Unified Admin Security Panel (`hari.html`)
- **Master Admin Password `2008`**: Unified authentication for `admin` and `hari` across Stalker API and Admin REST endpoints.
- **Single-Prompt Verification**: Streamlined single-stage admin login without duplicate password prompts.
- **Sports M3U Manager**: Direct upload, inspection, and channel synchronization for custom M3U playlists.

### 🐧 6. Cross-Platform Cloud Deployment (`src/routes/youtube.js`)
- Universal yt-dlp binary resolver supporting Windows (`yt-dlp.exe`), Linux (`/usr/local/bin/yt-dlp`), and Google Cloud Run containers.

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) v18+ or v20+
- PowerShell (Windows) or Bash (Linux/macOS)

### 1-Click Launch (Windows)
Double-click **`start_server.bat`** or run:
```bat
start_server.bat
```

### Manual Launch (Command Line)
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or start directly with tsx
npx tsx server.ts
```

---

## 🌐 Web Endpoints & UI Portals

| Portal | URL | Description |
| :--- | :--- | :--- |
| 🎬 **Consumet UI** | `http://localhost:3000/consumet.html` | Modern OTT Catalog & Sports Shelves |
| 🚀 **Torrent Engine** | `http://localhost:3000/torrent.html` | High-Speed Torrent Streamer & Downloader |
| 🔒 **Admin Console** | `http://localhost:3000/hari.html` | System Settings, M3U Upload, Maintenance (Pass: `2008`) |
| 📺 **Sports Feed** | `http://localhost:3000/sports.m3u` | Raw M3U playlist of all 3,540 verified live channels |
| 🎵 **Music Portal** | `http://localhost:3000/music.html` | Lossless music player and radio streamer |
| 📚 **Books Library** | `http://localhost:3000/books.html` | Dark sepia reader for literature and comics |

---

## 📁 Repository Architecture

```
├── assets/                  # 3,540 Verified Channels & 400+ SVG Logos
│   ├── channels.json        # Unified channel database
│   └── logos/               # High-definition channel brand icons
├── bin/                     # Standalone streaming server binaries
├── doctor_strange/          # Admin state and configuration JSON database
├── public/                  # Static frontend assets, players, scripts
│   ├── consumet.html        # Main OTT catalog interface
│   ├── torrent.html         # BitTorrent player interface
│   ├── torrent.js           # Fast torrent seek & search controller
│   ├── hari.html            # Administrator dashboard
│   ├── hari.js              # Admin control logic & M3U manager
│   └── watchdog.js          # Real-time client maintenance sync
├── src/                     # Backend TypeScript source files
│   ├── routes/              # Express API routers (admin, torrent, youtube, sports)
│   ├── xtream/              # Xtream Codes proxy, agent, and keep-alive
│   └── proxy.ts             # Direct socket video proxy & manifest rewriter
├── server.ts                # Main Express server & Quantum Maintenance engine
├── start_server.bat         # 1-Click launcher batch script
└── package.json             # Dependencies and build configuration
```

---

## 📜 License
MIT License © 2026 Stalker Pro Project
