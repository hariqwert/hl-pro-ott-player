<?php
$stream_url = isset($_GET['url']) ? $_GET['url'] : (isset($_GET['id']) ? $_GET['id'] : '');
$name = isset($_GET['name']) ? $_GET['name'] : 'Live Stream';
$source = isset($_GET['source']) ? $_GET['source'] : 'consumet.html';
?>
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta name="robots" content="noindex">
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
    <title><?php echo htmlspecialchars($name); ?> | Stalker Pro Pure HLS Player</title>
    <!-- Anti-Inspect / DevTools Blocker: Immediately redirects to about:blank if DevTools or inspect is opened -->
    <script>
    (function() {
        'use strict';
        var isLocked = false;
        function isExempt() {
            try {
                return document.cookie.indexOf('admin_auth=') !== -1 || !!localStorage.getItem('admin_token');
            } catch(e) { return false; }
        }
        function triggerLock(reason) {
            if (isLocked || isExempt()) return;
            isLocked = true;
            try { window.stop && window.stop(); } catch(e) {}
            try {
                var v = document.querySelector('video');
                if (v) { v.pause(); v.src = ''; }
            } catch(e) {}
            try { document.documentElement.innerHTML = ''; } catch(e) {}
            try {
                window.location.replace('about:blank');
            } catch (e) {
                window.location.href = 'about:blank';
            }
        }
        window.addEventListener('keydown', function(e) {
            var k = e.key ? e.key.toUpperCase() : '';
            var c = e.keyCode || e.which;
            if (k === 'F12' || c === 123) { e.preventDefault(); e.stopPropagation(); triggerLock('F12'); return false; }
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (k === 'I' || c === 73 || k === 'J' || c === 74 || k === 'C' || c === 67)) {
                e.preventDefault(); e.stopPropagation(); triggerLock('Shortcut'); return false;
            }
            if ((e.ctrlKey || e.metaKey) && (k === 'U' || c === 85)) {
                e.preventDefault(); e.stopPropagation(); triggerLock('ViewSource'); return false;
            }
        }, true);
        document.addEventListener('contextmenu', function(e) {
            if (isExempt()) return;
            var t = e.target ? e.target.tagName : '';
            if (t === 'INPUT' || t === 'TEXTAREA') return;
            e.preventDefault();
            e.stopPropagation();
            return false;
        }, true);
        function checkWindow() {
            if (isExempt()) return;
            if (window.outerWidth - window.innerWidth > 100 || window.outerHeight - window.innerHeight > 100) {
                triggerLock('DockedDevTools');
            }
        }
        window.addEventListener('resize', checkWindow);
        setInterval(checkWindow, 250);
        setInterval(function() {
            if (isExempt()) return;
            var t0 = performance.now();
            (function() { var f = new Function('debugger'); f(); })();
            if (performance.now() - t0 > 40) {
                triggerLock('Debugger');
            }
        }, 250);
        var probe = new Image();
        Object.defineProperty(probe, 'id', {
            get: function() { triggerLock('ConsoleProbe'); return 'probe'; }
        });
        setInterval(function() {
            if (isExempt()) return;
            try { console.log('%c', probe); console.clear(); } catch(e) {}
        }, 500);
        checkWindow();
    })();
    </script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest" crossorigin></script>
    <!-- Plyr, Hls.js & mpegts.js Libraries -->
    <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />
    <script src="https://cdn.plyr.io/3.7.8/plyr.polyfilled.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@1"></script>
    <script src="https://cdn.jsdelivr.net/npm/mpegts.js@1.7.3/dist/mpegts.min.js" crossorigin></script>
    <script src="https://cdn.jsdelivr.net/npm/dashjs@4.7.4/dist/dash.all.min.js" crossorigin></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.11/shaka-player.compiled.js"></script>
    <style>
        * { -webkit-tap-highlight-color: transparent !important; }
        body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background-color: #000;
            font-family: 'Plus Jakarta Sans', sans-serif;
            color: #fff;
        }
        #player-container {
            position: relative;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000;
        }
        .plyr {
            width: 100% !important;
            height: 100% !important;
            max-height: 100vh !important;
            --plyr-color-main: #ef4444;
        }
        /* High-Precision Smooth Touch Responsive Timeline & Seeking */

        /* Subtitle Visual Controller Variables & Typography */
        :root {
            --sub-font-size: 1.15rem;
            --sub-color: #ffffff;
            --sub-bg: rgba(0, 0, 0, 0.78);
            --sub-shadow: 0 2px 5px rgba(0, 0, 0, 0.95);
        }

        /* Force native captions to show & respect visual typography */
        ::cue {
            font-size: var(--sub-font-size) !important;
            color: var(--sub-color) !important;
            background-color: var(--sub-bg) !important;
            text-shadow: var(--sub-shadow) !important;
            line-height: 1.4 !important;
            border-radius: 6px !important;
        }
        .plyr__captions .plyr__caption {
            font-size: var(--sub-font-size) !important;
            color: var(--sub-color) !important;
            background: var(--sub-bg) !important;
            text-shadow: var(--sub-shadow) !important;
            line-height: 1.4 !important;
            border-radius: 6px !important;
            padding: 4px 10px !important;
            backdrop-filter: blur(4px) !important;
        }
        .plyr--video video::-webkit-media-text-track-container {
            display: block !important;
            opacity: 1 !important;
            visibility: visible !important;
        }
        .plyr--video video::-webkit-media-text-track-display {
            display: inline-block !important;
            opacity: 1 !important;
            visibility: visible !important;
        }

        .plyr__progress {
            position: relative !important;
            touch-action: none !important;
            padding: 10px 0 !important;
            cursor: pointer !important;
            user-select: none !important;
            -webkit-user-select: none !important;
            min-height: 28px !important;
            display: flex !important;
            align-items: center !important;
        }
        .plyr__progress input[type="range"] {
            position: relative !important;
            height: 28px !important;
            cursor: pointer !important;
            touch-action: none !important;
            margin: 0 !important;
            padding: 0 !important;
            z-index: 10 !important;
        }
        /* Progress track */
        .plyr--video .plyr__progress__buffer,
        .plyr--video .plyr__progress input[type="range"]::-webkit-slider-runnable-track,
        .plyr--video .plyr__progress input[type="range"]::-moz-range-track {
            height: 6px !important;
            border-radius: 9999px !important;
            transition: height 0.15s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        /* Smooth Expand on hover, active, touch or scrubbing */
        .plyr__progress:hover .plyr__progress__buffer,
        .plyr__progress:active .plyr__progress__buffer,
        .plyr__progress:hover input[type="range"]::-webkit-slider-runnable-track,
        .plyr__progress:active input[type="range"]::-webkit-slider-runnable-track,
        .plyr__progress.is-scrubbing .plyr__progress__buffer,
        .plyr__progress.is-scrubbing input[type="range"]::-webkit-slider-runnable-track {
            height: 9px !important;
        }
        /* Scrubber thumb - smooth glowing & enlarged touch radius */
        .plyr--video input[type="range"]::-webkit-slider-thumb {
            width: 15px !important;
            height: 15px !important;
            background: #ef4444 !important;
            border: 2px solid #ffffff !important;
            box-shadow: 0 0 10px rgba(239, 68, 68, 0.8), 0 2px 6px rgba(0,0,0,0.6) !important;
            border-radius: 50% !important;
            transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease !important;
            margin-top: -4.5px !important;
            cursor: pointer !important;
        }
        .plyr--video input[type="range"]:active::-webkit-slider-thumb,
        .plyr--video input[type="range"]:focus::-webkit-slider-thumb,
        .plyr__progress.is-scrubbing input[type="range"]::-webkit-slider-thumb {
            transform: scale(1.45) !important;
            background: #ff3b30 !important;
            box-shadow: 0 0 20px rgba(239, 68, 68, 1), 0 0 0 7px rgba(239, 68, 68, 0.35) !important;
        }
        .plyr--video input[type="range"]::-moz-range-thumb {
            width: 15px !important;
            height: 15px !important;
            background: #ef4444 !important;
            border: 2px solid #ffffff !important;
            box-shadow: 0 0 10px rgba(239, 68, 68, 0.8), 0 2px 6px rgba(0,0,0,0.6) !important;
            border-radius: 50% !important;
            transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease !important;
        }
        .plyr--video input[type="range"]:active::-moz-range-thumb,
        .plyr__progress.is-scrubbing input[type="range"]::-moz-range-thumb {
            transform: scale(1.45) !important;
            box-shadow: 0 0 20px rgba(239, 68, 68, 1), 0 0 0 7px rgba(239, 68, 68, 0.35) !important;
        }
        .plyr__tooltip {
            font-family: 'Plus Jakarta Sans', system-ui, sans-serif !important;
            font-weight: 800 !important;
            font-size: 11px !important;
            letter-spacing: 0.04em !important;
            border-radius: 8px !important;
            padding: 5px 9px !important;
            background: rgba(10, 10, 15, 0.95) !important;
            border: 1px solid rgba(255, 255, 255, 0.2) !important;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8) !important;
            backdrop-filter: blur(12px) !important;
            color: #ffffff !important;
        }
        /* Touch Seek HUD overlay */
        .touch-seek-hud {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.95);
            background: rgba(10, 10, 15, 0.92);
            border: 1px solid rgba(239, 68, 68, 0.4);
            box-shadow: 0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(239, 68, 68, 0.2);
            color: #fff;
            padding: 16px 28px;
            border-radius: 24px;
            font-size: 14px;
            font-weight: 800;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.18s ease, transform 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            z-index: 10002;
            backdrop-filter: blur(16px);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            min-width: 200px;
        }
        .touch-seek-hud.active {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }
        .touch-seek-hud .hud-time {
            font-size: 20px;
            font-weight: 900;
            letter-spacing: 0.05em;
            color: #fff;
        }
        .touch-seek-hud .hud-diff {
            font-size: 13px;
            font-weight: 800;
            color: #ef4444;
        }
        .touch-seek-hud .hud-bar {
            width: 100%;
            height: 5px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 9999px;
            overflow: hidden;
            margin-top: 6px;
        }
        .touch-seek-hud .hud-bar-fill {
            height: 100%;
            background: #ef4444;
            border-radius: 9999px;
            transition: width 0.05s linear;
        }
        .plyr__video-wrapper {
            height: 100% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        }
        video {
            width: 100% !important;
            height: 100% !important;
            object-fit: contain;
            transition: transform 0.3s ease, object-fit 0.3s ease;
        }
        video.fit-cover {
            object-fit: cover !important;
        }
        video.fit-fill {
            object-fit: fill !important;
        }
        video.zoom-120 {
            transform: scale(1.2) !important;
        }
        /* Minimal Loading Screen */
        #loading {
            position: fixed;
            inset: 0;
            background: #000;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            transition: opacity 0.3s;
        }
        .loading-text {
            font-size: 1.5rem;
            font-weight: 800;
            letter-spacing: 0.1em;
            display: flex;
            gap: 4px;
            color: #fff;
        }
        .loading-text span {
            animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }
        /* Fallback buttons */
        .apple-glass-btn {
            display: flex; align-items: center; gap: 8px;
            padding: 9px 20px;
            background: rgba(255,255,255,0.07);
            border: 1px solid rgba(255,255,255,0.13);
            color: #ffffff; font-size: 12px; font-weight: 700;
            border-radius: 9999px; backdrop-filter: blur(20px);
            cursor: pointer; letter-spacing: 0.02em;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .apple-glass-btn:hover { background: rgba(255,255,255,0.16); border-color: rgba(255,255,255,0.25); transform: scale(1.04); }
        /* Legacy aliases used by JS */
        .apple-tv-ambient-glow { display: none; }
        .apple-tv-loading-card { display: contents; }
        .apple-spinner-wrapper,.apple-spinner-outer,.apple-spinner-inner,.apple-spinner-core { display: none; }
        .apple-badge { font-size:9px;font-weight:900;letter-spacing:0.1em;color:rgba(255,255,255,0.65);background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.13);padding:3px 9px;border-radius:5px;backdrop-filter:blur(8px); }
        .apple-status-ticker { display: none !important; }
        .apple-status-dot,.apple-badge { display: none; }
        @keyframes appleDotPulse { 0%,100%{opacity:1;}50%{opacity:0.4;} }
        /* Apple TV Floating HUD Indicator */
        #zoom-indicator {
            position: absolute;
            top: 2rem;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(18, 18, 24, 0.85);
            color: #fff;
            padding: 0.55rem 1.4rem;
            border-radius: 9999px;
            font-size: 0.825rem;
            font-weight: 700;
            border: 1px solid rgba(255, 255, 255, 0.18);
            backdrop-filter: blur(25px);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s;
            z-index: 10000;
        }
        /* Apple TV Skip Intro Pill Button */
        .apple-skip-btn {
            position: absolute;
            bottom: 85px;
            right: 25px;
            z-index: 9999;
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(20, 20, 26, 0.82);
            border: 1px solid rgba(255, 255, 255, 0.22);
            color: #ffffff;
            padding: 10px 22px;
            border-radius: 9999px;
            font-weight: 800;
            font-size: 13px;
            cursor: pointer;
            backdrop-filter: blur(25px);
            box-shadow: 0 12px 35px rgba(0, 0, 0, 0.65), 0 0 20px rgba(255, 255, 255, 0.08);
            transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s, box-shadow 0.2s;
        }
        .apple-skip-btn:hover {
            transform: scale(1.05);
            background: rgba(255, 255, 255, 0.18);
            border-color: rgba(255, 255, 255, 0.4);
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(255, 255, 255, 0.15);
        }
        .apple-skip-btn:active {
            transform: scale(0.97);
        }
        #gesture-ripple {
            position: absolute;
            width: 120px;
            height: 120px;
            border-radius: 50%;
            background: rgba(239, 68, 68, 0.3);
            pointer-events: none;
            transform: scale(0);
            opacity: 0;
            transition: transform 0.4s ease-out, opacity 0.4s ease-out;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 900;
            font-size: 1.25rem;
            color: #fff;
        }
        /* Sleep Timer Indicator */
        #sleep-indicator {
            position: absolute;
            top: 1rem;
            right: 1rem;
            background: rgba(0, 0, 0, 0.75);
            border: 1px solid rgba(239, 68, 68, 0.4);
            padding: 0.35rem 0.85rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 800;
            color: #ef4444;
            display: none;
            align-items: center;
            gap: 0.4rem;
            z-index: 9999;
            backdrop-filter: blur(8px);
        }
        /* Disable TV spatial navigation borders */
    *:focus, *:focus-visible, *:-webkit-direct-focus, *:focus-within { 
        outline: none !important; 
        outline-width: 0 !important;
        box-shadow: none !important; 
        -webkit-tap-highlight-color: transparent !important;
    }
    ::-moz-focus-inner {
        border: 0;
    }
    .tv-focus-disabled {
        outline: none !important;
    }
</style>
    <style>
        .plyr { touch-action: pan-y pinch-zoom !important; }
        /* Smooth, anti-flicker control bar transitions on touch & mobile */
        .plyr__controls {
            transition: opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1), transform 0.28s cubic-bezier(0.16, 1, 0.3, 1) !important;
            will-change: opacity, transform;
            -webkit-tap-highlight-color: transparent !important;
        }
        .plyr--hide-controls .plyr__controls {
            opacity: 0 !important;
            pointer-events: none !important;
            transform: translateY(8px) !important;
        }
        .plyr:not(.plyr--hide-controls) .plyr__controls {
            opacity: 1 !important;
            pointer-events: auto !important;
            transform: translateY(0) !important;
        }
        #top-controls {
            transition: opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1) !important;
            will-change: opacity;
            -webkit-tap-highlight-color: transparent !important;
        }
    </style>
    <link rel="icon" type="image/png" href="stalker_pro_infinity.svg">
    <link rel="stylesheet" href="assets/local-ai.css?v=2.0">
</head>
<body>
    <div id="loading">
        <div class="loading-text">
            <span style="animation-delay: 0s">L</span><span style="animation-delay: 0.1s">O</span><span style="animation-delay: 0.2s">A</span><span style="animation-delay: 0.3s">D</span><span style="animation-delay: 0.4s">I</span><span style="animation-delay: 0.5s">N</span><span style="animation-delay: 0.6s">G</span>
        </div>
        <div style="margin-top: 1rem; color: #888; font-size: 0.85rem;" id="apple-loading-status">
            Resolving feed...
        </div>
    </div>

    <!-- Floating Indicators -->
    <div id="zoom-indicator">Fit to Screen</div>
    <div id="gesture-ripple"></div>
    <div id="sleep-indicator">
        <i data-lucide="clock" class="w-3.5 h-3.5 animate-pulse"></i>
        <span id="sleep-time">00:00</span>
    </div>
    <!-- Main Player Canvas -->
    <div id="player-container">
        <video id="player" autoplay playsinline crossorigin="anonymous"></video>
    </div>
    <!-- Sleep Timer Modal -->
    <div id="sleepModal" class="hidden fixed inset-0 z-[10001] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-2 sm:p-4 transition-all">
        <div class="bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 w-full max-w-sm shadow-2xl text-center relative flex flex-col max-h-[85vh] overflow-y-auto">
            <button onclick="closeSleepModal()" class="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-red-600 hover:text-white border border-white/20 text-zinc-300 flex items-center justify-center cursor-pointer transition-all shadow-lg active:scale-95" title="Close Sleep Timer">
                <i data-lucide="x" class="w-5 h-5"></i>
            </button>
            <div class="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-red-500/20 text-red-500">
                <i data-lucide="clock" class="w-6 h-6"></i>
            </div>
            <h3 class="text-lg font-bold text-white mb-1">Set Sleep Timer</h3>
            <p class="text-xs text-zinc-400 mb-5">Playback will pause automatically when timer expires.</p>
            <div class="grid grid-cols-2 gap-3 mb-5">
                <button onclick="setSleepTimer(15)" class="py-3 bg-zinc-800 hover:bg-red-600 hover:text-white text-zinc-300 font-bold text-xs rounded-xl transition-all border border-zinc-700 active:scale-95">15 Minutes</button>
                <button onclick="setSleepTimer(30)" class="py-3 bg-zinc-800 hover:bg-red-600 hover:text-white text-zinc-300 font-bold text-xs rounded-xl transition-all border border-zinc-700 active:scale-95">30 Minutes</button>
                <button onclick="setSleepTimer(45)" class="py-3 bg-zinc-800 hover:bg-red-600 hover:text-white text-zinc-300 font-bold text-xs rounded-xl transition-all border border-zinc-700 active:scale-95">45 Minutes</button>
                <button onclick="setSleepTimer(60)" class="py-3 bg-zinc-800 hover:bg-red-600 hover:text-white text-zinc-300 font-bold text-xs rounded-xl transition-all border border-zinc-700 active:scale-95">60 Minutes</button>
            </div>
            <div class="flex gap-3">
                <button onclick="setSleepTimer(0)" class="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold text-xs rounded-xl transition-all active:scale-95">Turn Off</button>
                <button onclick="closeSleepModal()" class="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all active:scale-95">Cancel</button>
            </div>
        </div>
    </div>
    <!-- Apple TV+ Standard Audio & Language Modal -->
    <div id="audioModal" class="hidden fixed inset-0 z-[10002] bg-black/85 backdrop-blur-xl flex items-end sm:items-center justify-center p-2 sm:p-4 transition-all">
        <div class="bg-[#141419]/95 border border-white/15 rounded-t-3xl sm:rounded-[28px] p-5 sm:p-7 w-full max-w-md shadow-2xl backdrop-blur-3xl flex flex-col max-h-[85vh] overflow-y-auto">
            <div class="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-white shadow-inner">
                        <i data-lucide="headphones" class="w-5 h-5 text-white"></i>
                    </div>
                    <div>
                        <h3 class="text-base font-bold text-white tracking-tight">Audio & Languages</h3>
                        <p class="text-[11px] text-zinc-400 font-medium">Apple TV+ Spatial Audio & Dubbed Feeds</p>
                    </div>
                </div>
                <button onclick="closeAudioModal()" class="w-10 h-10 rounded-full bg-white/10 hover:bg-red-600 hover:text-white border border-white/20 text-zinc-200 flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95 shrink-0" title="Close Audio Menu">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            <div id="audio-tracks-list" class="space-y-2.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                <p class="text-xs text-zinc-500 text-center py-4">Standard Default Audio Active</p>
            </div>
        </div>
    </div>
    <!-- Subtitles Modal with Visual & Sync Controller -->
    <div id="subtitleModal" class="hidden fixed inset-0 z-[10002] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4">
        <div class="bg-[#141419]/95 border border-white/10 rounded-[28px] p-5 sm:p-6 w-full max-w-lg shadow-[0_30px_80px_rgba(0,0,0,0.85)] flex flex-col max-h-[90vh]">
            <div class="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                <div class="flex items-center gap-2.5">
                    <div class="w-9 h-9 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                        <i data-lucide="subtitles" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <h3 class="text-sm sm:text-base font-bold text-white leading-tight">Subtitles & Visual Controller</h3>
                        <p class="text-[11px] text-zinc-400">Captions track selector, typography & audio sync</p>
                    </div>
                </div>
                <button onclick="closeSubtitleModal()" class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-zinc-400 hover:text-white transition cursor-pointer">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <!-- Tabs: Tracks vs Visual Appearance -->
            <div class="flex rounded-xl bg-white/5 p-1 mb-3">
                <button id="sub-tab-tracks" type="button" onclick="window.switchSubTab('tracks')" class="flex-1 py-1.5 text-xs font-bold rounded-lg transition-all bg-red-600 text-white shadow cursor-pointer">
                    Language Tracks
                </button>
                <button id="sub-tab-visual" type="button" onclick="window.switchSubTab('visual')" class="flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-zinc-400 hover:text-white cursor-pointer">
                    Visual & Audio Sync
                </button>
            </div>

            <!-- Tab 1: Tracks List -->
            <div id="sub-tab-content-tracks" class="flex-1 flex flex-col min-h-0">
                <div id="subtitle-tracks-list" class="space-y-1.5 max-h-56 overflow-y-auto mb-3 pr-1 custom-scrollbar flex-1">
                    <p class="text-xs text-zinc-500 text-center py-2">No embedded captions found</p>
                </div>
                <div class="border-t border-white/10 pt-3 mt-auto">
                    <label class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Upload Custom Subtitles (.srt, .vtt)</label>
                    <input type="file" id="sub-file-input" accept=".srt,.vtt" class="block w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-red-600 file:text-white hover:file:bg-red-700 cursor-pointer"/>
                </div>
            </div>

            <!-- Tab 2: Visual Controller & Audio Sync -->
            <div id="sub-tab-content-visual" class="hidden flex-1 overflow-y-auto pr-1 space-y-3.5 custom-scrollbar">
                <!-- Live Preview Card -->
                <div class="p-3 bg-black/60 rounded-2xl border border-white/10 text-center">
                    <div class="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-2">Live Preview</div>
                    <div id="sub-preview-box" class="py-2.5 px-3 rounded-lg inline-block transition-all" style="font-size: var(--sub-font-size, 1.15rem); color: var(--sub-color, #ffffff); background-color: var(--sub-bg, rgba(0,0,0,0.78)); text-shadow: var(--sub-shadow, 0 2px 4px rgba(0,0,0,0.95)); font-weight: 600;">
                        The quick brown fox jumps over the lazy dog
                    </div>
                </div>

                <!-- Font Size Controls -->
                <div>
                    <label class="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">Font Size</label>
                    <div class="grid grid-cols-4 gap-1.5">
                        <button type="button" onclick="window.setSubtitleFontSize('0.85rem')" id="sub-font-small" class="sub-font-btn py-1.5 px-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-semibold text-zinc-300 transition cursor-pointer">75% Small</button>
                        <button type="button" onclick="window.setSubtitleFontSize('1.15rem')" id="sub-font-medium" class="sub-font-btn py-1.5 px-2 bg-red-600 text-white rounded-xl text-xs font-semibold transition cursor-pointer">100% Normal</button>
                        <button type="button" onclick="window.setSubtitleFontSize('1.45rem')" id="sub-font-large" class="sub-font-btn py-1.5 px-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-semibold text-zinc-300 transition cursor-pointer">125% Large</button>
                        <button type="button" onclick="window.setSubtitleFontSize('1.75rem')" id="sub-font-xlarge" class="sub-font-btn py-1.5 px-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-semibold text-zinc-300 transition cursor-pointer">150% Huge</button>
                    </div>
                </div>

                <!-- Text Color Controls -->
                <div>
                    <label class="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">Text Color</label>
                    <div class="grid grid-cols-4 gap-2">
                        <button type="button" onclick="window.setSubtitleColor('#ffffff')" class="sub-color-btn py-2 px-2 rounded-xl border border-white/20 flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-white/10 hover:bg-white/20 transition cursor-pointer" data-color="#ffffff">
                            <span class="w-3.5 h-3.5 rounded-full bg-white border border-black/30"></span> White
                        </button>
                        <button type="button" onclick="window.setSubtitleColor('#facc15')" class="sub-color-btn py-2 px-2 rounded-xl border border-yellow-400/30 flex items-center justify-center gap-1.5 text-xs font-bold text-yellow-300 bg-yellow-400/10 hover:bg-yellow-400/20 transition cursor-pointer" data-color="#facc15">
                            <span class="w-3.5 h-3.5 rounded-full bg-yellow-400"></span> Yellow
                        </button>
                        <button type="button" onclick="window.setSubtitleColor('#38bdf8')" class="sub-color-btn py-2 px-2 rounded-xl border border-sky-400/30 flex items-center justify-center gap-1.5 text-xs font-bold text-sky-300 bg-sky-400/10 hover:bg-sky-400/20 transition cursor-pointer" data-color="#38bdf8">
                            <span class="w-3.5 h-3.5 rounded-full bg-sky-400"></span> Cyan
                        </button>
                        <button type="button" onclick="window.setSubtitleColor('#4ade80')" class="sub-color-btn py-2 px-2 rounded-xl border border-emerald-400/30 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-400/10 hover:bg-emerald-400/20 transition cursor-pointer" data-color="#4ade80">
                            <span class="w-3.5 h-3.5 rounded-full bg-emerald-400"></span> Green
                        </button>
                    </div>
                </div>

                <!-- Background Style -->
                <div>
                    <label class="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">Background & Outline</label>
                    <div class="grid grid-cols-3 gap-2">
                        <button type="button" onclick="window.setSubtitleBg('rgba(0, 0, 0, 0.78)')" id="sub-bg-translucent" class="sub-bg-btn py-2 px-2 rounded-xl bg-white/20 border border-white/40 text-xs font-bold text-white transition cursor-pointer">
                            Translucent
                        </button>
                        <button type="button" onclick="window.setSubtitleBg('#000000')" id="sub-bg-solid" class="sub-bg-btn py-2 px-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-300 transition cursor-pointer">
                            Solid Black
                        </button>
                        <button type="button" onclick="window.setSubtitleBg('transparent')" id="sub-bg-none" class="sub-bg-btn py-2 px-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-300 transition cursor-pointer">
                            No Box (Shadow)
                        </button>
                    </div>
                </div>

                <!-- Live Audio/Subtitle Timing Sync Stepper -->
                <div class="p-3 bg-white/5 rounded-2xl border border-white/10">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                            <i data-lucide="timer" class="w-3.5 h-3.5 text-red-400"></i> Audio / Subtitle Sync Offset
                        </span>
                        <span id="sub-offset-display" class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[11px] font-bold">
                            0.00s (Synced)
                        </span>
                    </div>
                    <p class="text-[10px] text-zinc-400 mb-2.5">Delay or advance subtitle text timing to match spoken voice</p>
                    <div class="grid grid-cols-5 gap-1.5">
                        <button type="button" onclick="window.adjustSubtitleSync(-1.0)" class="py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition cursor-pointer">-1.0s</button>
                        <button type="button" onclick="window.adjustSubtitleSync(-0.25)" class="py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition cursor-pointer">-0.25s</button>
                        <button type="button" onclick="window.resetSubtitleSync()" class="py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition cursor-pointer">Reset 0s</button>
                        <button type="button" onclick="window.adjustSubtitleSync(0.25)" class="py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition cursor-pointer">+0.25s</button>
                        <button type="button" onclick="window.adjustSubtitleSync(1.0)" class="py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition cursor-pointer">+1.0s</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <!-- 4K & 8K Resolution Quality Selector Modal -->
    <div id="qualityModal" class="hidden fixed inset-0 z-[10002] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-2 sm:p-4 transition-all">
        <div class="bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 w-full max-w-sm shadow-2xl flex flex-col max-h-[85vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-base font-bold text-white flex items-center gap-2">
                    <i data-lucide="sparkles" class="w-5 h-5 text-red-500"></i> Stream Quality (4K/8K)
                </h3>
                <button onclick="closeQualityModal()" class="w-10 h-10 rounded-full bg-white/10 hover:bg-red-600 hover:text-white border border-white/20 text-zinc-200 flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95 shrink-0" title="Close Quality Menu">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            <div id="quality-tracks-list" class="space-y-2 max-h-60 overflow-y-auto pr-1">
                <p class="text-xs text-zinc-500 text-center py-4">Detecting video resolution levels...</p>
            </div>
        </div>
    </div>

    <!-- Live Stream Error Overlay -->
    <div id="player-error" class="hidden fixed inset-0 z-[10001] bg-black/95 flex flex-col items-center justify-center p-6 text-center">
        <div class="max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl flex flex-col items-center">
            <div class="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20 text-red-500">
                <i data-lucide="tv" class="w-8 h-8 animate-pulse"></i>
            </div>
            <h3 class="text-xl font-bold text-white mb-2">Live Stream Interrupted</h3>
            <p id="error-message-text" class="text-zinc-400 text-sm mb-6 leading-relaxed">The live broadcast feed is buffering or temporarily unreachable. Attempting auto-reconnect...</p>
            <div class="flex flex-col gap-2.5 w-full">
                <div class="flex gap-2.5 w-full">
                    <button onclick="triggerAutoReconnect()" class="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 cursor-pointer">
                        <i data-lucide="rotate-ccw" class="w-4 h-4"></i> Reconnect
                    </button>
                    <button onclick="location.reload()" class="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-sm rounded-xl transition-all border border-zinc-700 flex items-center justify-center gap-2 cursor-pointer">
                        <i data-lucide="refresh-cw" class="w-4 h-4"></i> Reload
                    </button>
                </div>
                <button onclick="window.history.back()" class="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-medium text-xs rounded-xl transition-all border border-zinc-800 flex items-center justify-center gap-2 cursor-pointer">
                    <i data-lucide="arrow-left" class="w-4 h-4"></i> Back to Channels
                </button>
            </div>
        </div>
    </div>
    <script>
        window.currentRotation = 0;
        window.originalContainerStyles = null;
        window.toggleRotation = function() {
            if (screen.orientation && screen.orientation.lock) {
                const currentType = screen.orientation.type;
                if (currentType.startsWith('portrait')) {
                    screen.orientation.lock('landscape').catch(e => {
                        console.warn("Screen orientation lock failed:", e);
                        fallbackRotation();
                    });
                } else {
                    screen.orientation.lock('portrait').catch(e => {
                        console.warn("Screen orientation lock failed:", e);
                        fallbackRotation();
                    });
                }
            } else {
                fallbackRotation();
            }
            function fallbackRotation() {
                const playerContainer = document.getElementById('player-container');
                if (!playerContainer) return;
                if (!window.originalContainerStyles) {
                    window.originalContainerStyles = {
                        position: playerContainer.style.position || window.getComputedStyle(playerContainer).position,
                        width: playerContainer.style.width || window.getComputedStyle(playerContainer).width,
                        height: playerContainer.style.height || window.getComputedStyle(playerContainer).height,
                        top: playerContainer.style.top || window.getComputedStyle(playerContainer).top,
                        left: playerContainer.style.left || window.getComputedStyle(playerContainer).left,
                        zIndex: playerContainer.style.zIndex || window.getComputedStyle(playerContainer).zIndex
                    };
                }
                window.currentRotation = (window.currentRotation + 90) % 360;
                if (window.currentRotation === 90 || window.currentRotation === 270) {
                    playerContainer.style.width = window.innerHeight + 'px';
                    playerContainer.style.height = window.innerWidth + 'px';
                    playerContainer.style.position = 'fixed';
                    playerContainer.style.top = '50%';
                    playerContainer.style.left = '50%';
                    playerContainer.style.transform = `translate(-50%, -50%) rotate(${window.currentRotation}deg)`;
                    playerContainer.style.zIndex = '9999';
                } else {
                    playerContainer.style.width = window.originalContainerStyles.width;
                    playerContainer.style.height = window.originalContainerStyles.height;
                    playerContainer.style.position = window.originalContainerStyles.position;
                    playerContainer.style.top = window.originalContainerStyles.top;
                    playerContainer.style.left = window.originalContainerStyles.left;
                    playerContainer.style.transform = `rotate(${window.currentRotation}deg)`;
                    playerContainer.style.zIndex = window.originalContainerStyles.zIndex;
                }
                const indicator = document.getElementById('zoom-indicator') || document.getElementById('indicator');
                if (indicator) {
                    indicator.textContent = 'Rotated ' + window.currentRotation + '°';
                    indicator.style.opacity = '1';
                    setTimeout(() => indicator.style.opacity = '0', 1500);
                }
            }
        };
        document.addEventListener("DOMContentLoaded", () => {
            document.addEventListener("fullscreenchange", () => {
                if (document.fullscreenElement) {
                    if (screen.orientation && screen.orientation.lock) {
                        screen.orientation.lock("landscape").catch(() => {});
                    }
                } else {
                    if (screen.orientation && screen.orientation.unlock) {
                        screen.orientation.unlock();
                    }
                }
            });
            if (typeof lucide !== 'undefined') lucide.createIcons();
            let src = "<?php echo htmlspecialchars($stream_url); ?>";
            let name = "<?php echo htmlspecialchars($name); ?>";
            let source = "<?php echo htmlspecialchars($source); ?>";
            const urlParams = new URLSearchParams(window.location.search);
            if (!src) {
                src = urlParams.get('url') || urlParams.get('id') || urlParams.get('stream') || '';
            }
            if (!name || name === 'Live Stream' || name === 'Live Channel') {
                name = urlParams.get('name') || urlParams.get('title') || name;
            }
            const video = document.getElementById('player');
            const loading = document.getElementById('loading');
            const zoomIndicator = document.getElementById('zoom-indicator');
            const sleepModal = document.getElementById('sleepModal');
            const sleepIndicator = document.getElementById('sleep-indicator');
            const sleepTimeLabel = document.getElementById('sleep-time');
            let hls = null;
            let mpegPlayer = null;
            let player = null;
            let isReconnecting = false;
            let watchdogTimer = null;
            let lastCurrentTime = -1;
            let lastProgressTime = Date.now();
            let sleepTimerInterval = null;
            let sleepTargetTime = null;
            // Aspect ratio state: 0=fit(contain), 1=fill(cover), 2=stretch(fill), 3=zoom-120
            let aspectState = 0;
            const aspectModes = ['Default (Fit)', 'Fill Screen', 'Stretch 16:9', 'Zoom 120%'];
            function showIndicator(text) {
                if (!zoomIndicator) return;
                zoomIndicator.innerHTML = `<span class="flex items-center gap-2">${text}</span>`;
                zoomIndicator.style.opacity = '1';
                zoomIndicator.style.transform = 'translateX(-50%) translateY(6px)';
                setTimeout(() => { 
                    zoomIndicator.style.opacity = '0';
                    zoomIndicator.style.transform = 'translateX(-50%) translateY(0)';
                }, 2400);
            }

            function setAppleLoadingStatus(msg) {
                const el = document.getElementById('apple-loading-status');
                if (el) el.textContent = msg;
            }

            function hideLoadingScreen() {
                if (!loading || loading.style.display === 'none') return;
                setAppleLoadingStatus('Ready • Starting Playback...');
                loading.style.opacity = '0';
                loading.style.pointerEvents = 'none';
                setTimeout(() => {
                    loading.style.display = 'none';
                }, 550);
            }

            if (video) {
                video.addEventListener('playing', () => { hideLoadingScreen(); });
                video.addEventListener('canplay', () => { hideLoadingScreen(); });
                video.addEventListener('loadeddata', () => { hideLoadingScreen(); });
            }

            function formatTimeMinutes(sec) {
                if (!sec || isNaN(sec)) return '0:00';
                const m = Math.floor(sec / 60);
                const s = Math.floor(sec % 60);
                return `${m}:${s < 10 ? '0' : ''}${s}`;
            }

            function toggleAspectRatio() {
                aspectState = (aspectState + 1) % aspectModes.length;
                video.classList.remove('fit-cover', 'fit-fill', 'zoom-120');
                if (aspectState === 1) video.classList.add('fit-cover');
                else if (aspectState === 2) video.classList.add('fit-fill');
                else if (aspectState === 3) video.classList.add('zoom-120');
                showIndicator(`<i data-lucide="scan" class="w-4 h-4 text-red-400"></i> Aspect Mode: ${aspectModes[aspectState]}`);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }

            // Apple TV+ Standard Audio & Language Modal
            window.toggleAudioModal = function() {
                const modal = document.getElementById('audioModal');
                const list = document.getElementById('audio-tracks-list');
                list.innerHTML = '';
                const video = document.getElementById('player');
                let internalAdded = false;
                
                // 1. Internal HLS Master Audio Tracks (Direct Multi-Audio Streams)
                if (window.hls && window.hls.audioTracks && window.hls.audioTracks.length > 0) {
                    internalAdded = true;
                    const groupTitle = document.createElement('div');
                    groupTitle.className = 'text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-2 mt-1 px-2 flex items-center justify-between';
                    groupTitle.innerHTML = `<span>Master HLS Audio Tracks</span> <span class="text-[9px] text-zinc-400 bg-white/10 px-2 py-0.5 rounded-full font-mono">${window.hls.audioTracks.length}</span>`;
                    list.appendChild(groupTitle);
                    
                    window.hls.audioTracks.forEach((track, idx) => {
                        const isActive = window.hls.audioTrack === idx;
                        const btn = document.createElement('button');
                        btn.className = `w-full text-left px-4 py-3 rounded-2xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-all mb-1.5 ${isActive ? 'bg-gradient-to-r from-red-600 to-purple-600 text-white shadow-lg shadow-red-500/25 border border-white/20' : 'bg-white/5 text-zinc-300 hover:bg-white/10 border border-white/5'}`;
                        const label = track.name || track.lang || ('Track ' + (idx + 1));
                        
                        // Apple TV Style Audio Format Badges
                        let badge = 'STEREO';
                        if (track.name && (track.name.includes('5.1') || track.name.includes('Surround'))) badge = 'DOLBY 5.1';
                        else if (track.name && track.name.includes('Atmos')) badge = 'DOLBY ATMOS';
                        else if (idx === 0) badge = 'ORIGINAL';

                        btn.innerHTML = `
                            <div class="flex items-center gap-2.5">
                                <i data-lucide="volume-2" class="w-4 h-4 ${isActive ? 'text-white' : 'text-zinc-400'}"></i>
                                <span>${label}</span>
                                <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${isActive ? 'bg-white/20 text-white' : 'bg-white/5 text-zinc-400 border border-white/10'}">${badge}</span>
                            </div>
                            ${isActive ? '<i data-lucide="check" class="w-4 h-4 text-white"></i>' : ''}
                        `;
                        btn.onclick = () => {
                            try {
                                if (window.hls) {
                                    window.hls.audioTrack = idx;
                                    const cur = video ? video.currentTime : 0;
                                    // Instant buffer flush for audio so user does not wait 30s for stale audio buffer
                                    try {
                                        if (typeof Hls !== 'undefined' && Hls.Events && Hls.Events.BUFFER_FLUSHING) {
                                            window.hls.trigger(Hls.Events.BUFFER_FLUSHING, { startOffset: cur, endOffset: Infinity, type: 'audio' });
                                        }
                                    } catch(flushErr) {
                                        console.warn('[HLS Audio Buffer Flush]', flushErr);
                                    }
                                    // Re-sync playhead
                                    if (video) {
                                        video.currentTime = cur;
                                        if (video.paused) video.play().catch(()=>{});
                                    }
                                }
                                // Synchronize native HTML5 audio tracks if available
                                if (video && video.audioTracks && video.audioTracks.length > idx) {
                                    for (let a = 0; a < video.audioTracks.length; a++) {
                                        video.audioTracks[a].enabled = (a === idx);
                                    }
                                }
                                showIndicator(`<i data-lucide="headphones" class="w-4 h-4 text-purple-400"></i> Audio: ${label} • ${badge}`);
                                if (typeof lucide !== 'undefined') lucide.createIcons();
                            } catch (e) {
                                console.warn('[Audio Track Switch Error]', e);
                            }
                            closeAudioModal();
                        };
                        list.appendChild(btn);
                    });
                }
                
                // 2. Multi-Source Dubbed Languages (Polaris s70 / Hakunaymatata)
                const languageSources = (window.bingrSources || []).filter(s => s.language || (s.label && s.label.includes('—')));
                if (languageSources.length > 0) {
                    if (internalAdded) {
                        const div = document.createElement('div');
                        div.className = 'h-px w-full bg-white/10 my-3';
                        list.appendChild(div);
                    }
                    const groupTitle = document.createElement('div');
                    groupTitle.className = 'text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-2 px-2 flex items-center justify-between';
                    groupTitle.innerHTML = `<span>Dubbed Regional Feeds (Polaris)</span> <span class="text-[9px] text-zinc-400 bg-white/10 px-2 py-0.5 rounded-full font-mono">${languageSources.length}</span>`;
                    list.appendChild(groupTitle);
                    
                    const scrollBox = document.createElement('div');
                    scrollBox.className = 'max-h-60 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar';
                    
                    languageSources.forEach((srcObj, idx) => {
                        const btn = document.createElement('button');
                        const isActive = (src === srcObj.url);
                        btn.className = `w-full text-left px-4 py-3 rounded-2xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${isActive ? 'bg-gradient-to-r from-red-600 to-purple-600 text-white shadow-lg shadow-red-500/25 border border-white/20' : 'bg-white/5 text-zinc-300 hover:bg-white/10 border border-white/5'}`;
                        const labelText = srcObj.language || srcObj.label || ('Language ' + (idx + 1));
                        
                        btn.innerHTML = `
                            <div class="flex items-center gap-2.5">
                                <i data-lucide="globe" class="w-4 h-4 ${isActive ? 'text-white' : 'text-zinc-400'}"></i>
                                <span>${labelText}</span>
                                <span class="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/10 text-zinc-300 font-mono">${srcObj.quality || '1080p'}</span>
                                <span class="text-[9px] font-bold text-amber-400 uppercase bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">DUB</span>
                            </div>
                            ${isActive ? '<i data-lucide="check" class="w-4 h-4 text-white"></i>' : ''}
                        `;
                        
                        // Apple TV Seamless Audio Switch with Playhead & State Preservation
                        btn.onclick = async () => {
                            const curTime = (window.plyrPlayer && typeof window.plyrPlayer.currentTime === 'number') 
                                ? window.plyrPlayer.currentTime 
                                : ((window.player && typeof window.player.currentTime === 'number') 
                                    ? window.player.currentTime 
                                    : (video ? video.currentTime : 0));
                            const wasPlaying = video && !video.paused;
                            const timeFmt = formatTimeMinutes(curTime);

                            showIndicator(`<i data-lucide="sparkles" class="w-4 h-4 text-purple-400"></i> Switching to ${labelText} (Resuming at ${timeFmt})...`);
                            if (typeof lucide !== 'undefined') lucide.createIcons();
                            closeAudioModal();

                            src = srcObj.url;
                            if (window.hls) {
                                try { window.hls.destroy(); video.src = ''; video.load(); } catch(e){}
                                window.hls = null;
                            }
                            if (typeof window.destroyMpegPlayer === 'function') window.destroyMpegPlayer();
                            initPlayer();

                            // Seamless Playhead & State Restoration with single-fire guard
                            let resumed = false;
                            const onResume = () => {
                                if (resumed) return;
                                resumed = true;
                                video.removeEventListener('loadedmetadata', onResume);
                                video.removeEventListener('canplay', onResume);
                                if (curTime > 0) {
                                    try {
                                        if (window.plyrPlayer) window.plyrPlayer.currentTime = curTime;
                                        if (window.player) window.player.currentTime = curTime;
                                        if (video) video.currentTime = curTime;
                                    } catch(e){}
                                }
                                if (wasPlaying && video && video.paused) {
                                    video.play().catch(()=>{});
                                }
                                showIndicator(`<i data-lucide="check-circle" class="w-4 h-4 text-emerald-400"></i> Audio: ${labelText} • Resumed at ${timeFmt}`);
                                if (typeof lucide !== 'undefined') lucide.createIcons();
                            };
                            video.addEventListener('loadedmetadata', onResume, { once: true });
                            video.addEventListener('canplay', onResume, { once: true });

                        };
                        scrollBox.appendChild(btn);
                    });
                    list.appendChild(scrollBox);
                }

                if (list.innerHTML === '') {
                    list.innerHTML = `
                        <div class="py-6 text-center space-y-2">
                            <div class="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-zinc-400">
                                <i data-lucide="volume-2" class="w-5 h-5"></i>
                            </div>
                            <p class="text-xs text-zinc-300 font-bold">Standard Single Audio Stream Active</p>
                            <p class="text-[11px] text-zinc-500">Decoded with Apple TV Spatial Sound passthrough.</p>
                        </div>
                    `;
                }

                if (typeof lucide !== 'undefined') lucide.createIcons();
                modal.classList.remove('hidden');
            };

            window.closeAudioModal = function() {
                document.getElementById('audioModal').classList.add('hidden');
            };

            window.toggleSubtitleModal = function() {
                const modal = document.getElementById('subtitleModal');
                const list = document.getElementById('subtitle-tracks-list');
                list.innerHTML = '';
                const video = document.getElementById('player');
                let hasSubs = false;

                // 1. Off / Disable Button
                let anyActive = false;
                if (video && video.textTracks) {
                    for (let i = 0; i < video.textTracks.length; i++) {
                        if (video.textTracks[i].mode === 'showing') anyActive = true;
                    }
                }
                if (window.hls && window.hls.subtitleTrack !== -1) anyActive = true;

                const offBtn = document.createElement('button');
                offBtn.className = `w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-all mb-3 ${!anyActive ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`;
                offBtn.innerHTML = `<span>Off (Disable Subtitles)</span> ${!anyActive ? '<i data-lucide="check" class="w-4 h-4"></i>' : ''}`;
                offBtn.onclick = () => { 
                    if (window.hls) window.hls.subtitleTrack = -1; 
                    if (video && video.textTracks) {
                        for (let i = 0; i < video.textTracks.length; i++) {
                            video.textTracks[i].mode = 'disabled';
                        }
                    }
                    if (window.player) {
                        try { window.player.currentTrack = -1; } catch(e){}
                    }
                    showIndicator('Subtitles: Disabled');
                    closeSubtitleModal(); 
                };
                list.appendChild(offBtn);

                // 2. Internal HLS Subtitle Tracks
                if (window.hls && window.hls.subtitleTracks && window.hls.subtitleTracks.length > 0) {
                    hasSubs = true;
                    const groupTitle = document.createElement('div');
                    groupTitle.className = 'text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2 mt-1 px-2';
                    groupTitle.textContent = 'Embedded HLS Captions';
                    list.appendChild(groupTitle);

                    window.hls.subtitleTracks.forEach((track, idx) => {
                        const isActive = window.hls.subtitleTrack === idx;
                        const btn = document.createElement('button');
                        btn.className = `w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-all mb-1 ${isActive ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`;
                        btn.innerHTML = `<span>${track.name || track.lang || 'Subtitle ' + (idx + 1)}</span> ${isActive ? '<i data-lucide="check" class="w-4 h-4"></i>' : ''}`;
                        btn.onclick = () => { 
                            window.hls.subtitleTrack = idx; 
                            if (video && video.textTracks) {
                                for (let j = 0; j < video.textTracks.length; j++) video.textTracks[j].mode = 'disabled';
                            }
                            showIndicator('Subtitles: ' + (track.name || track.lang));
                            closeSubtitleModal(); 
                        };
                        list.appendChild(btn);
                    });
                }

                // 3. Multi-Language External WebVTT Subtitles (Bingr / VDRK)
                const extSubs = window.bingrSubtitles || [];
                if (extSubs.length > 0 || (video && video.textTracks && video.textTracks.length > 0)) {
                    hasSubs = true;
                    const groupTitle = document.createElement('div');
                    groupTitle.className = 'text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2 mt-2 px-2 flex items-center justify-between';
                    groupTitle.innerHTML = `<span>Available Languages</span> <span class="text-[9px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">${Math.max(extSubs.length, video?.textTracks?.length || 0)}</span>`;
                    list.appendChild(groupTitle);

                    const scrollBox = document.createElement('div');
                    scrollBox.className = 'max-h-60 overflow-y-auto pr-1 space-y-1 custom-scrollbar';

                    extSubs.forEach((sub, idx) => {
                        const label = sub.label || sub.lang || ('Subtitle ' + (idx + 1));
                        let isShowing = false;
                        if (video && video.textTracks) {
                            for (let t = 0; t < video.textTracks.length; t++) {
                                if (video.textTracks[t].label === label && video.textTracks[t].mode === 'showing') {
                                    isShowing = true;
                                }
                            }
                        }
                        const btn = document.createElement('button');
                        btn.className = `w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${isShowing ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`;
                        btn.innerHTML = `<div class="flex items-center gap-2"><span>${label}</span> <span class="text-[9px] uppercase px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 font-mono">${(sub.lang || 'VTT').slice(0, 6)}</span></div> ${isShowing ? '<i data-lucide="check" class="w-4 h-4"></i>' : ''}`;
                        btn.onclick = () => {
                            let vttUrl = sub.url;
                            if (sub.url && sub.url.includes('.srt')) {
                                vttUrl = '/api/bingr/srt2vtt?url=' + encodeURIComponent(sub.url);
                            }
                            
                            // Find or inject track
                            let targetTrack = null;
                            let targetIdx = -1;
                            if (video && video.textTracks) {
                                for (let t = 0; t < video.textTracks.length; t++) {
                                    if (video.textTracks[t].label === label) {
                                        targetTrack = video.textTracks[t];
                                        targetIdx = t;
                                    }
                                }
                            }
                            
                            if (!targetTrack) {
                                const trackEl = document.createElement('track');
                                trackEl.kind = 'subtitles';
                                trackEl.label = label;
                                trackEl.srclang = (sub.lang || 'en').substring(0, 2);
                                trackEl.src = vttUrl;
                                trackEl.default = true;
                                video.appendChild(trackEl);
                                setTimeout(() => {
                                    for (let t = 0; t < video.textTracks.length; t++) {
                                        const isMatch = video.textTracks[t].label === label;
                                        video.textTracks[t].mode = isMatch ? 'showing' : 'disabled';
                                        if (isMatch && window.player) {
                                            try { window.player.currentTrack = t; } catch(e){}
                                        }
                                    }
                                }, 50);
                            } else {
                                for (let t = 0; t < video.textTracks.length; t++) {
                                    const isMatch = video.textTracks[t] === targetTrack;
                                    video.textTracks[t].mode = isMatch ? 'showing' : 'disabled';
                                    if (isMatch && window.player) {
                                        try { window.player.currentTrack = t; } catch(e){}
                                    }
                                }
                            }
                            if (window.hls) window.hls.subtitleTrack = -1;
                            showIndicator('Subtitles: ' + label);
                            closeSubtitleModal();
                        };
                        scrollBox.appendChild(btn);
                    });
                    list.appendChild(scrollBox);
                }

                if (!hasSubs) {
                    list.innerHTML = '<p class="text-xs text-zinc-500 text-center py-4">No subtitle tracks found for this stream</p>';
                }

                if (typeof lucide !== 'undefined') lucide.createIcons();
                modal.classList.remove('hidden');
            };

            window.closeSubtitleModal = function() {
                document.getElementById('subtitleModal').classList.add('hidden');
            };

            // -- SUBTITLE VISUAL & AUDIO SYNC CONTROLLER --
            let currentSubOffset = 0;
            let currentSubFontSize = localStorage.getItem('stalker_sub_font') || '1.15rem';
            let currentSubColor = localStorage.getItem('stalker_sub_color') || '#ffffff';
            let currentSubBg = localStorage.getItem('stalker_sub_bg') || 'rgba(0, 0, 0, 0.78)';

            window.switchSubTab = function(tab) {
                const tabTracks = document.getElementById('sub-tab-tracks');
                const tabVisual = document.getElementById('sub-tab-visual');
                const contentTracks = document.getElementById('sub-tab-content-tracks');
                const contentVisual = document.getElementById('sub-tab-content-visual');
                if (tab === 'tracks') {
                    if (tabTracks) tabTracks.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all bg-red-600 text-white shadow cursor-pointer';
                    if (tabVisual) tabVisual.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-zinc-400 hover:text-white cursor-pointer';
                    if (contentTracks) contentTracks.classList.remove('hidden');
                    if (contentVisual) contentVisual.classList.add('hidden');
                } else {
                    if (tabVisual) tabVisual.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all bg-red-600 text-white shadow cursor-pointer';
                    if (tabTracks) tabTracks.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-zinc-400 hover:text-white cursor-pointer';
                    if (contentVisual) contentVisual.classList.remove('hidden');
                    if (contentTracks) contentTracks.classList.add('hidden');
                    window.applySubtitleStyles();
                }
            };

            window.applySubtitleStyles = function() {
                document.documentElement.style.setProperty('--sub-font-size', currentSubFontSize);
                document.documentElement.style.setProperty('--sub-color', currentSubColor);
                document.documentElement.style.setProperty('--sub-bg', currentSubBg);
                const prev = document.getElementById('sub-preview-box');
                if (prev) {
                    prev.style.fontSize = currentSubFontSize;
                    prev.style.color = currentSubColor;
                    prev.style.backgroundColor = currentSubBg;
                    prev.style.textShadow = currentSubBg === 'transparent' ? '0 2px 4px rgba(0,0,0,1), 0 0 8px rgba(0,0,0,0.8)' : '0 2px 4px rgba(0,0,0,0.95)';
                }
                document.querySelectorAll('.plyr__caption').forEach(el => {
                    el.style.fontSize = currentSubFontSize;
                    el.style.color = currentSubColor;
                    el.style.background = currentSubBg;
                });
            };

            window.setSubtitleFontSize = function(size) {
                currentSubFontSize = size;
                window.applySubtitleStyles();
                try { localStorage.setItem('stalker_sub_font', size); } catch(e){}
                document.querySelectorAll('.sub-font-btn').forEach(btn => {
                    btn.classList.remove('bg-red-600', 'text-white');
                    btn.classList.add('bg-white/5', 'text-zinc-300');
                });
                if (size === '0.85rem') document.getElementById('sub-font-small')?.classList.replace('bg-white/5', 'bg-red-600');
                if (size === '1.15rem') document.getElementById('sub-font-medium')?.classList.replace('bg-white/5', 'bg-red-600');
                if (size === '1.45rem') document.getElementById('sub-font-large')?.classList.replace('bg-white/5', 'bg-red-600');
                if (size === '1.75rem') document.getElementById('sub-font-xlarge')?.classList.replace('bg-white/5', 'bg-red-600');
                showIndicator('Subtitle Size: ' + (size === '0.85rem' ? '75% Small' : size === '1.15rem' ? '100% Normal' : size === '1.45rem' ? '125% Large' : '150% Huge'));
            };

            window.setSubtitleColor = function(color) {
                currentSubColor = color;
                window.applySubtitleStyles();
                try { localStorage.setItem('stalker_sub_color', color); } catch(e){}
                showIndicator('Subtitle Color Updated');
            };

            window.setSubtitleBg = function(bg) {
                currentSubBg = bg;
                window.applySubtitleStyles();
                try { localStorage.setItem('stalker_sub_bg', bg); } catch(e){}
                document.querySelectorAll('.sub-bg-btn').forEach(btn => {
                    btn.classList.remove('bg-white/20', 'border-white/40');
                    btn.classList.add('bg-white/5', 'border-white/10');
                });
                if (bg === 'rgba(0, 0, 0, 0.78)') document.getElementById('sub-bg-translucent')?.classList.replace('bg-white/5', 'bg-white/20');
                if (bg === '#000000') document.getElementById('sub-bg-solid')?.classList.replace('bg-white/5', 'bg-white/20');
                if (bg === 'transparent') document.getElementById('sub-bg-none')?.classList.replace('bg-white/5', 'bg-white/20');
                showIndicator('Subtitle Style Updated');
            };

            window.adjustSubtitleSync = function(delta) {
                currentSubOffset += delta;
                updateSubtitleSyncUI();
                applyOffsetToTracks(delta);
                showIndicator(`Subtitle Sync: ${currentSubOffset >= 0 ? '+' : ''}${currentSubOffset.toFixed(2)}s`);
            };

            window.resetSubtitleSync = function() {
                const diff = -currentSubOffset;
                currentSubOffset = 0;
                updateSubtitleSyncUI();
                applyOffsetToTracks(diff);
                showIndicator('Subtitle Sync: Reset to 0s');
            };

            function updateSubtitleSyncUI() {
                const disp = document.getElementById('sub-offset-display');
                if (!disp) return;
                if (Math.abs(currentSubOffset) < 0.01) {
                    disp.textContent = '0.00s (Synced)';
                    disp.className = 'px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[11px] font-bold';
                } else {
                    disp.textContent = `${currentSubOffset > 0 ? '+' : ''}${currentSubOffset.toFixed(2)}s`;
                    disp.className = 'px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-mono text-[11px] font-bold';
                }
            }

            function applyOffsetToTracks(delta) {
                const video = document.getElementById('player');
                if (!video || !video.textTracks) return;
                for (let i = 0; i < video.textTracks.length; i++) {
                    const track = video.textTracks[i];
                    if (track.cues) {
                        for (let c = 0; c < track.cues.length; c++) {
                            const cue = track.cues[c];
                            cue.startTime = Math.max(0, cue.startTime + delta);
                            cue.endTime = Math.max(0, cue.endTime + delta);
                        }
                    }
                }
            }

            // Restore saved subtitle visual preferences
            setTimeout(() => {
                window.applySubtitleStyles();
            }, 300);
            // ---------------------------------------------
            // Quality Modal (4K / 8K / 1080p / Auto)
            window.toggleQualityModal = function() {
                const modal = document.getElementById('qualityModal');
                const list = document.getElementById('quality-tracks-list');
                list.innerHTML = '';
                if (window.hls && window.hls.levels && window.hls.levels.length > 0) {
                    // Auto Option
                    const autoBtn = document.createElement('button');
                    autoBtn.className = `w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${window.hls.currentLevel === -1 ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`;
                    autoBtn.innerHTML = `<span>Auto (Adaptive 4K/HD)</span> ${window.hls.currentLevel === -1 ? '<i data-lucide="check" class="w-4 h-4"></i>' : ''}`;
                    autoBtn.onclick = () => {
                        window.hls.currentLevel = -1;
                        showIndicator('Quality: Auto Adaptive');
                        closeQualityModal();
                    };
                    list.appendChild(autoBtn);
                    window.hls.levels.forEach((level, idx) => {
                        let label = `${level.height || 'SD'}p`;
                        let badge = '';
                        if (level.height >= 4320) {
                            label = '8K Ultra HD (7680x4320)';
                            badge = '<span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-black text-[10px] uppercase border border-amber-500/30">8K UHD</span>';
                        } else if (level.height >= 2160) {
                            label = '4K Ultra HD (3840x2160)';
                            badge = '<span class="px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-black text-[10px] uppercase border border-red-500/30">4K UHD</span>';
                        } else if (level.height >= 1440) {
                            label = '2K QHD (2560x1440)';
                            badge = '<span class="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-bold text-[10px]">2K</span>';
                        } else if (level.height >= 1080) {
                            label = '1080p Full HD';
                            badge = '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">FHD</span>';
                        } else if (level.height >= 720) {
                            label = '720p HD';
                            badge = '<span class="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold text-[10px]">HD</span>';
                        }
                        const btn = document.createElement('button');
                        btn.className = `w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${window.hls.currentLevel === idx ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`;
                        btn.innerHTML = `<div class="flex items-center gap-2"><span>${label}</span> ${badge}</div> ${window.hls.currentLevel === idx ? '<i data-lucide="check" class="w-4 h-4"></i>' : ''}`;
                        btn.onclick = () => {
                            window.hls.currentLevel = idx;
                            if (level.height >= 2160) {
                                window.hls.config.maxBufferLength = 60;
                                window.hls.config.maxMaxBufferLength = 300;
                            }
                            showIndicator('Quality: ' + label);
                            closeQualityModal();
                        };
                        list.appendChild(btn);
                    });
                } else if (window.shakaPlayer && typeof window.shakaPlayer.getVariantTracks === 'function' && window.shakaPlayer.getVariantTracks().length > 0) {
                    const tracks = window.shakaPlayer.getVariantTracks();
                    const isAbr = window.shakaPlayer.getConfiguration().abr.enabled;
                    const activeTrack = tracks.find(t => t.active);

                    const autoBtn = document.createElement('button');
                    autoBtn.className = `w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${isAbr ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`;
                    autoBtn.innerHTML = `<span>Auto (Adaptive 1080p/HD)</span> ${isAbr ? '<i data-lucide="check" class="w-4 h-4"></i>' : ''}`;
                    autoBtn.onclick = () => {
                        window.shakaPlayer.configure({ abr: { enabled: true } });
                        showIndicator('Quality: Auto Adaptive');
                        closeQualityModal();
                    };
                    list.appendChild(autoBtn);

                    const uniqueHeights = Array.from(new Set(tracks.map(t => t.height).filter(Boolean))).sort((a, b) => b - a);
                    uniqueHeights.forEach(h => {
                        const matchedTrack = tracks.find(t => t.height === h);
                        const isCurrent = !isAbr && activeTrack && activeTrack.height === h;
                        let label = `${h}p`;
                        let badge = '';
                        if (h >= 1080) {
                            label = '1080p Full HD';
                            badge = '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">FHD</span>';
                        } else if (h >= 720) {
                            label = '720p HD';
                            badge = '<span class="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold text-[10px]">HD</span>';
                        } else if (h >= 540) {
                            label = '540p qHD';
                            badge = '<span class="px-2 py-0.5 rounded bg-zinc-700 text-zinc-300 font-bold text-[10px]">SD</span>';
                        }
                        const btn = document.createElement('button');
                        btn.className = `w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${isCurrent ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`;
                        btn.innerHTML = `<div class="flex items-center gap-2"><span>${label}</span> ${badge}</div> ${isCurrent ? '<i data-lucide="check" class="w-4 h-4"></i>' : ''}`;
                        btn.onclick = () => {
                            window.shakaPlayer.configure({ abr: { enabled: false } });
                            window.shakaPlayer.selectVariantTrack(matchedTrack, true);
                            showIndicator('Quality: ' + label);
                            closeQualityModal();
                        };
                        list.appendChild(btn);
                    });
                } else if (window.dashPlayer && typeof window.dashPlayer.getBitrateInfoListFor === 'function') {
                    const bitrates = window.dashPlayer.getBitrateInfoListFor('video');
                    const autoSwitch = window.dashPlayer.getSettings()?.streaming?.abr?.autoSwitchBitrate?.video !== false;
                    const currentQual = window.dashPlayer.getQualityFor('video');

                    const autoBtn = document.createElement('button');
                    autoBtn.className = `w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${autoSwitch ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`;
                    autoBtn.innerHTML = `<span>Auto (Adaptive 1080p/HD)</span> ${autoSwitch ? '<i data-lucide="check" class="w-4 h-4"></i>' : ''}`;
                    autoBtn.onclick = () => {
                        window.dashPlayer.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: true } } } });
                        showIndicator('Quality: Auto Adaptive');
                        closeQualityModal();
                    };
                    list.appendChild(autoBtn);

                    bitrates.forEach((b, idx) => {
                        let label = `${b.height || 'SD'}p`;
                        let badge = '';
                        if (b.height >= 1080) {
                            label = '1080p Full HD';
                            badge = '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">FHD</span>';
                        } else if (b.height >= 720) {
                            label = '720p HD';
                            badge = '<span class="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold text-[10px]">HD</span>';
                        }
                        const isCurrent = !autoSwitch && currentQual === idx;
                        const btn = document.createElement('button');
                        btn.className = `w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${isCurrent ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`;
                        btn.innerHTML = `<div class="flex items-center gap-2"><span>${label}</span> ${badge}</div> ${isCurrent ? '<i data-lucide="check" class="w-4 h-4"></i>' : ''}`;
                        btn.onclick = () => {
                            window.dashPlayer.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: false } } } });
                            window.dashPlayer.setQualityFor('video', idx);
                            showIndicator('Quality: ' + label);
                            closeQualityModal();
                        };
                        list.appendChild(btn);
                    });
                } else {
                    list.innerHTML = `
                        <div class="space-y-2 py-2">
                            <p class="text-xs text-zinc-400 text-center font-bold">Standard Single Stream Active</p>
                            <div class="p-3 bg-zinc-800/80 rounded-xl border border-zinc-700/50 text-center">
                                <span class="px-2.5 py-1 rounded bg-red-600/30 text-red-400 font-black text-xs uppercase tracking-wider inline-block">4K / 8K Passthrough Ready</span>
                                <p class="text-[11px] text-zinc-400 mt-1">Hardware acceleration and native 4K/8K decoding enabled.</p>
                            </div>
                        </div>
                    `;
                }
                if (typeof lucide !== 'undefined') lucide.createIcons();
                modal.classList.remove('hidden');
            };
            window.closeQualityModal = function() {
                document.getElementById('qualityModal').classList.add('hidden');
            };
            // Custom Subtitle File Handling (.srt / .vtt)
            document.addEventListener('change', (e) => {
                if (e.target && e.target.id === 'sub-file-input') {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        let text = evt.target.result;
                        if (file.name.endsWith('.srt')) {
                            text = 'WEBVTT\n\n' + text.replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, '$1.$2');
                        }
                        const blob = new Blob([text], { type: 'text/vtt' });
                        const subUrl = URL.createObjectURL(blob);
                        const existingTracks = video.querySelectorAll('track');
                        existingTracks.forEach(t => t.remove());
                        const track = document.createElement('track');
                        track.kind = 'subtitles';
                        track.label = file.name;
                        track.srclang = 'custom';
                        track.src = subUrl;
                        track.default = true;
                        video.appendChild(track);
                        showIndicator('Subtitles Loaded: ' + file.name);
                        closeSubtitleModal();
                    };
                    reader.readAsText(file);
                }
            });
            // Sleep Timer
            window.toggleSleepTimer = function() {
                sleepModal.classList.remove('hidden');
            };
            window.closeSleepModal = function() {
                sleepModal.classList.add('hidden');
            };
            window.setSleepTimer = function(minutes) {
                closeSleepModal();
                if (sleepTimerInterval) clearInterval(sleepTimerInterval);
                if (minutes <= 0) {
                    sleepIndicator.style.display = 'none';
                    showIndicator('Sleep Timer Cancelled');
                    return;
                }
                sleepTargetTime = Date.now() + (minutes * 60 * 1000);
                sleepIndicator.style.display = 'flex';
                showIndicator(`Sleep Timer: ${minutes} Minutes`);
                sleepTimerInterval = setInterval(() => {
                    const remaining = Math.max(0, Math.floor((sleepTargetTime - Date.now()) / 1000));
                    if (remaining <= 0) {
                        clearInterval(sleepTimerInterval);
                        if (player) player.pause();
                        video.pause();
                        sleepIndicator.style.display = 'none';
                        showIndicator('Sleep Timer Expired: Stream Paused');
                    } else {
                        const m = Math.floor(remaining / 60);
                        const s = remaining % 60;
                        sleepTimeLabel.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                    }
                }, 1000);
            };
            function showPlayerError(msg) {
                document.getElementById('error-message-text').innerText = msg;
                document.getElementById('player-error').classList.remove('hidden');
                loading.style.display = 'none';
            }

            // Live Stream Routing & Helper Functions
            // If someone opened play_consumet.php with movie, TV series, or anime, redirect to dedicated player (play_bingr.php)
            const urlMediaId = urlParams.get('id') || urlParams.get('tmdbId') || urlParams.get('tmdb_id');
            const urlMediaType = (urlParams.get('type') || urlParams.get('media_type') || '').toLowerCase();
            const isMovieOrTvOrAnime = urlMediaType === 'movie' || urlMediaType === 'tv' || urlMediaType === 'series' || urlMediaType === 'anime' || urlParams.has('season') || urlParams.has('episode') || urlParams.has('s') || urlParams.has('e') || urlParams.has('malId') || urlParams.has('mal_id') || (urlMediaId && /^\d+$/.test(String(urlMediaId).trim()) && !urlParams.has('url') && !urlParams.get('name')?.toLowerCase().includes('tv'));
            if (isMovieOrTvOrAnime) {
                window.location.replace(`/play_bingr.php?${window.location.search.substring(1)}`);
                return;
            }





            window.copyCurrentStreamLink = function() {
                if (navigator.clipboard && src) {
                    navigator.clipboard.writeText(src).then(() => {
                        showIndicator('Live Stream URL Copied!');
                    }).catch(() => {
                        showIndicator(src);
                    });
                }
            };

            // Top Control Bar Overlay (Back, Title, Aspect, PiP, Sleep, Reconnect)
            function initTopControls(plyrInstance) {
                let topControls = document.getElementById('top-controls');
                if (!topControls) {
                    topControls = document.createElement('div');
                    topControls.id = 'top-controls';
                    topControls.className = 'absolute top-2 left-2 right-2 md:top-6 md:left-6 md:right-6 flex items-center justify-between transition-opacity duration-300 opacity-0 pointer-events-none gap-2';
                    topControls.style.zIndex = '2147483647';
                    // Left controls group
                    const leftGroup = document.createElement('div');
                    leftGroup.className = 'flex items-center gap-2 sm:gap-3 pointer-events-auto shrink-0';
                    // Back button
                    const backBtn = document.createElement('button');
                    backBtn.onclick = () => window.history.back();
                    backBtn.className = 'flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-black/60 hover:bg-red-600 text-white rounded-full transition-all duration-300 shadow-lg border border-white/10 backdrop-blur-md cursor-pointer';
                    backBtn.innerHTML = '<i data-lucide="arrow-left" class="w-5 h-5"></i>';
                    leftGroup.appendChild(backBtn);
                    // Title pill
                    const titlePill = document.createElement('div');
                    titlePill.className = 'flex items-center gap-2 bg-black/60 border border-white/10 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full backdrop-blur-md max-w-[120px] xs:max-w-[180px] sm:max-w-xs md:max-w-md truncate';
                    titlePill.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0"></span><span class="text-[10px] sm:text-xs md:text-sm font-bold text-white truncate">${name}</span>`;
                    leftGroup.appendChild(titlePill);
                    topControls.appendChild(leftGroup);
                    // Right controls group
                    const rightGroup = document.createElement('div');
                    rightGroup.className = 'flex items-center gap-1.5 sm:gap-3 pointer-events-auto overflow-x-auto max-w-[55vw] xs:max-w-[65vw] sm:max-w-none no-scrollbar py-1 shrink-0';
                    const btnClass = 'flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-black/70 hover:bg-zinc-800 text-white rounded-full transition-all duration-300 shadow-lg border border-white/15 backdrop-blur-md cursor-pointer shrink-0 active:scale-95';
                    
                    // Reconnect Button
                    const reconnectBtn = document.createElement('button');
                    reconnectBtn.title = "Force Reconnect Stream";
                    reconnectBtn.className = btnClass;
                    reconnectBtn.innerHTML = '<i data-lucide="rotate-ccw" class="w-4 h-4 sm:w-5 sm:h-5"></i>';
                    reconnectBtn.onclick = (e) => { e.stopPropagation(); triggerAutoReconnect(); };
                    rightGroup.appendChild(reconnectBtn);
                    // Aspect Ratio Button
                    const aspectBtn = document.createElement('button');
                    aspectBtn.title = "Toggle Aspect Ratio";
                    aspectBtn.className = btnClass;
                    aspectBtn.innerHTML = '<i data-lucide="maximize" class="w-4 h-4 sm:w-5 sm:h-5"></i>';
                    aspectBtn.onclick = (e) => { e.stopPropagation(); toggleAspectRatio(); };
                    rightGroup.appendChild(aspectBtn);
                    // Rotate Button
                    const rotateBtn = document.createElement('button');
                    rotateBtn.title = "Rotate View";
                    rotateBtn.className = btnClass;
                    rotateBtn.innerHTML = '<i data-lucide="smartphone" class="w-4 h-4 sm:w-5 sm:h-5"></i>';
                    rotateBtn.onclick = (e) => { e.stopPropagation(); window.toggleRotation(); };
                    rightGroup.appendChild(rotateBtn);
                    // Quality Selector Button (4K / 8K)
                    const qualityBtn = document.createElement('button');
                    qualityBtn.title = "Stream Quality (4K / 8K / HD)";
                    qualityBtn.className = btnClass;
                    qualityBtn.innerHTML = '<i data-lucide="sparkles" class="w-4 h-4 sm:w-5 sm:h-5 text-amber-400"></i>';
                    qualityBtn.onclick = (e) => { e.stopPropagation(); window.toggleQualityModal(); };
                    rightGroup.appendChild(qualityBtn);
                    // Audio Track Button
                    const audioBtn = document.createElement('button');
                    audioBtn.title = "Audio Tracks";
                    audioBtn.className = btnClass;
                    audioBtn.innerHTML = '<i data-lucide="volume-2" class="w-4 h-4 sm:w-5 sm:h-5"></i>';
                    audioBtn.onclick = (e) => { e.stopPropagation(); window.toggleAudioModal(); };
                    rightGroup.appendChild(audioBtn);
                    // Subtitle Button
                    const subBtn = document.createElement('button');
                    subBtn.title = "Subtitles & Captions";
                    subBtn.className = btnClass;
                    subBtn.innerHTML = '<i data-lucide="subtitles" class="w-4 h-4 sm:w-5 sm:h-5"></i>';
                    subBtn.onclick = (e) => { e.stopPropagation(); window.toggleSubtitleModal(); };
                    rightGroup.appendChild(subBtn);
                    // Sleep Timer Button
                    const sleepBtn = document.createElement('button');
                    sleepBtn.title = "Set Sleep Timer";
                    sleepBtn.className = btnClass;
                    sleepBtn.innerHTML = '<i data-lucide="clock" class="w-4 h-4 sm:w-5 sm:h-5"></i>';
                    sleepBtn.onclick = (e) => { e.stopPropagation(); window.toggleSleepTimer(); };
                    rightGroup.appendChild(sleepBtn);

                    // Watch Together (Party Mode) Button
                    const partyBtn = document.createElement('button');
                    partyBtn.id = 'party-mode-btn';
                    partyBtn.title = "Watch Together (Party Mode)";
                    partyBtn.className = 'flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-pink-600/40 hover:bg-pink-600 text-pink-300 hover:text-white rounded-full transition-all duration-300 shadow-lg border border-pink-500/50 backdrop-blur-md cursor-pointer shrink-0 active:scale-95';
                    partyBtn.innerHTML = '<i data-lucide="users" class="w-4 h-4 sm:w-5 sm:h-5"></i>';
                    partyBtn.onclick = (e) => { e.stopPropagation(); if (typeof window.togglePartyModal === 'function') window.togglePartyModal(true); };
                    rightGroup.appendChild(partyBtn);
                    // PiP Button
                    if (document.pictureInPictureEnabled || video.webkitSupportsPresentationMode) {
                        const pipBtn = document.createElement('button');
                        pipBtn.title = "Picture in Picture";
                        pipBtn.className = btnClass;
                        pipBtn.innerHTML = '<i data-lucide="picture-in-picture-2" class="w-4 h-4 sm:w-5 sm:h-5"></i>';
                        pipBtn.onclick = async (e) => {
                            e.stopPropagation();
                            try {
                                if (document.pictureInPictureElement) {
                                    await document.exitPictureInPicture();
                                } else {
                                    await video.requestPictureInPicture();
                                }
                            } catch(err) { console.warn("PiP failed:", err); }
                        };
                        rightGroup.appendChild(pipBtn);
                    }
                    topControls.appendChild(rightGroup);
                    const container = plyrInstance?.elements?.container || document.querySelector('.plyr') || document.getElementById('player-container');
                    if (container) {
                        container.appendChild(topControls);
                        ['sleepModal', 'audioModal', 'subtitleModal', 'qualityModal', 'player-error'].forEach(id => {
                            const modal = document.getElementById(id);
                            if (modal && modal.parentElement !== container) {
                                container.appendChild(modal);
                            }
                        });
                    } else {
                        document.body.appendChild(topControls);
                    }
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
                if (plyrInstance) {
                    plyrInstance.on('controlsshown', () => {
                        topControls.classList.remove('opacity-0', 'pointer-events-none');
                    });
                    plyrInstance.on('controlshidden', () => {
                        topControls.classList.add('opacity-0', 'pointer-events-none');
                    });
                }
                topControls.classList.remove('opacity-0', 'pointer-events-none');
            }
            // High-Precision Smooth Touch Timeline & Seeking Engine
            function initSmoothTouchTimeline(player, video) {
                const container = player.elements?.container || video.closest('.plyr') || document.getElementById('player-container');
                if (!container) return;
                const progressEl = container.querySelector('.plyr__progress');
                if (!progressEl) return;

                const rangeInput = progressEl.querySelector('input[type="range"]');
                let isScrubbing = false;
                let scrubTargetTime = 0;
                let wasPausedBeforeScrub = false;
                let rafId = null;

                function formatTime(secs) {
                    if (isNaN(secs) || secs < 0) secs = 0;
                    const h = Math.floor(secs / 3600);
                    const m = Math.floor((secs % 3600) / 60);
                    const s = Math.floor(secs % 60);
                    if (h > 0) {
                        return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
                    }
                    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
                }

                function updateScrubPosition(clientX) {
                    const rect = progressEl.getBoundingClientRect();
                    if (!rect.width) return;
                    let percent = (clientX - rect.left) / rect.width;
                    percent = Math.max(0, Math.min(1, percent));
                    
                    const duration = (player && player.duration > 0) ? player.duration : (video.duration > 0 ? video.duration : 0);
                    if (duration > 0) {
                        scrubTargetTime = percent * duration;
                        if (rangeInput) {
                            rangeInput.value = (percent * 100).toFixed(2);
                            rangeInput.style.setProperty('--value', `${(percent * 100).toFixed(1)}%`);
                        }
                        const curTimeEl = container.querySelector('.plyr__time--current');
                        if (curTimeEl) {
                            curTimeEl.textContent = formatTime(scrubTargetTime);
                        }
                    }
                }

                progressEl.addEventListener('touchstart', (e) => {
                    if (e.touches.length !== 1) return;
                    isScrubbing = true;
                    progressEl.classList.add('is-scrubbing');
                    wasPausedBeforeScrub = video.paused;
                    updateScrubPosition(e.touches[0].clientX);
                    e.stopPropagation();
                }, { passive: true });

                window.addEventListener('touchmove', (e) => {
                    if (!isScrubbing || e.touches.length !== 1) return;
                    if (rafId) cancelAnimationFrame(rafId);
                    rafId = requestAnimationFrame(() => {
                        updateScrubPosition(e.touches[0].clientX);
                    });
                    e.preventDefault();
                }, { passive: false });

                const endScrub = (e) => {
                    if (!isScrubbing) return;
                    isScrubbing = false;
                    progressEl.classList.remove('is-scrubbing');
                    if (rafId) cancelAnimationFrame(rafId);

                    const duration = (player && player.duration > 0) ? player.duration : (video.duration > 0 ? video.duration : 0);
                    if (duration > 0 && scrubTargetTime >= 0) {
                        try {
                            if (player) {
                                player.currentTime = scrubTargetTime;
                            } else {
                                video.currentTime = scrubTargetTime;
                            }
                        } catch(err) {
                            console.warn("Touch seek error:", err);
                        }
                    }
                    if (!wasPausedBeforeScrub && video.paused) {
                        video.play().catch(() => {});
                    }
                };

                window.addEventListener('touchend', endScrub, { passive: true });
                window.addEventListener('touchcancel', endScrub, { passive: true });
            }

            // Advanced Touch Gestures (Swipe Seek, Volume, Brightness, Double Tap -10s/+10s)
            function initAdvancedGestures(player, video) {
                const container = player.elements?.container || video.closest('.plyr') || document.getElementById('player-container');
                if (!container) return;

                // Create Touch Seek HUD element if not present
                let seekHud = document.getElementById('touchSeekHud');
                if (!seekHud) {
                    seekHud = document.createElement('div');
                    seekHud.id = 'touchSeekHud';
                    seekHud.className = 'touch-seek-hud';
                    seekHud.innerHTML = `
                        <div class="flex items-center gap-2">
                            <i data-lucide="fast-forward" class="w-5 h-5 text-red-500 hud-icon"></i>
                            <span class="hud-time">00:00</span>
                        </div>
                        <span class="hud-diff">+0s</span>
                        <div class="hud-bar"><div class="hud-bar-fill" style="width: 0%;"></div></div>
                    `;
                    container.appendChild(seekHud);
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }

                const indicator = document.getElementById('zoom-indicator');
                function showIndicator(text) {
                    if (!indicator) return;
                    indicator.textContent = text;
                    indicator.style.opacity = '1';
                    setTimeout(() => indicator.style.opacity = '0', 1500);
                }

                function formatTime(secs) {
                    if (isNaN(secs) || secs < 0) secs = 0;
                    const h = Math.floor(secs / 3600);
                    const m = Math.floor((secs % 3600) / 60);
                    const s = Math.floor(secs % 60);
                    if (h > 0) {
                        return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
                    }
                    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
                }

                // --- MOBILE GESTURES & TOUCH-TO-PAUSE ENGINE ---
                let startX = 0, startY = 0;
                let isDragging = false;
                let dragType = null; // 'volume', 'brightness', 'seek'
                let initialValue = 0;
                let initialTime = 0;
                let targetSeekTime = 0;
                let brightness = 100;
                let lastTap = 0;
                let singleTapTimeout = null;

                container.addEventListener('touchstart', (e) => {
                    if (e.target.closest('.plyr__controls') || e.target.closest('button') || e.target.closest('.modal')) return;
                    if (e.touches.length === 1) {
                        startX = e.touches[0].clientX;
                        startY = e.touches[0].clientY;
                        isDragging = false;
                        dragType = null;
                        initialTime = (player && player.currentTime !== undefined) ? player.currentTime : (video.currentTime || 0);
                    }
                }, { passive: true });

                container.addEventListener('touchmove', (e) => {
                    if (e.target.closest('.plyr__controls') || e.target.closest('button') || e.target.closest('.modal')) return;
                    if (e.touches.length === 1) {
                        let moveX = e.touches[0].clientX;
                        let moveY = e.touches[0].clientY;
                        let diffX = moveX - startX;
                        let diffY = moveY - startY;
                        let absX = Math.abs(diffX);
                        let absY = Math.abs(diffY);
                        const rect = container.getBoundingClientRect();

                        if (!isDragging && (absX > 18 || absY > 18)) {
                            isDragging = true;
                            if (singleTapTimeout) {
                                clearTimeout(singleTapTimeout);
                                singleTapTimeout = null;
                            }
                            // Horizontal Swipe -> Smooth Seek
                            if (absX > absY * 1.15) {
                                dragType = 'seek';
                                initialTime = (player && player.currentTime !== undefined) ? player.currentTime : (video.currentTime || 0);
                                if (seekHud) seekHud.classList.add('active');
                            } else {
                                // Vertical Swipe -> Left = Brightness, Right = Volume
                                const touchX = startX - rect.left;
                                if (touchX < rect.width / 2) {
                                    dragType = 'brightness';
                                    initialValue = brightness;
                                } else {
                                    dragType = 'volume';
                                    initialValue = (player ? player.volume : video.volume) * 100;
                                }
                            }
                        }

                        if (isDragging) {
                            if (dragType === 'seek') {
                                const duration = (player && player.duration > 0) ? player.duration : (video.duration > 0 ? video.duration : 0);
                                const seekWindow = duration > 0 ? Math.min(300, Math.max(60, duration * 0.2)) : 90;
                                const seekDelta = (diffX / (rect.width * 0.7)) * seekWindow;
                                targetSeekTime = Math.max(0, Math.min(duration || Infinity, initialTime + seekDelta));
                                
                                if (seekHud) {
                                    const timeEl = seekHud.querySelector('.hud-time');
                                    const diffEl = seekHud.querySelector('.hud-diff');
                                    const fillEl = seekHud.querySelector('.hud-bar-fill');
                                    
                                    const formattedTarget = formatTime(targetSeekTime);
                                    const formattedDuration = duration > 0 ? formatTime(duration) : '';
                                    if (timeEl) timeEl.textContent = duration > 0 ? `${formattedTarget} / ${formattedDuration}` : formattedTarget;
                                    
                                    const diffSecs = Math.round(targetSeekTime - initialTime);
                                    if (diffEl) {
                                        diffEl.textContent = (diffSecs >= 0 ? `+${diffSecs}s` : `${diffSecs}s`);
                                        diffEl.className = `hud-diff font-extrabold ${diffSecs >= 0 ? 'text-emerald-400' : 'text-red-400'}`;
                                    }
                                    if (fillEl && duration > 0) {
                                        fillEl.style.width = `${Math.max(0, Math.min(100, (targetSeekTime / duration) * 100))}%`;
                                    }
                                }
                                e.preventDefault();
                            } else if (dragType === 'brightness') {
                                const change = (diffY / rect.height) * -200;
                                brightness = Math.max(10, Math.min(200, initialValue + change));
                                document.body.style.filter = `brightness(${brightness}%)`;
                                showIndicator(`Brightness: ${Math.round(brightness)}%`);
                                e.preventDefault();
                            } else if (dragType === 'volume') {
                                const change = (diffY / rect.height) * -1;
                                const newVolume = Math.max(0, Math.min(1, (initialValue / 100) + change));
                                if (player) player.volume = newVolume; else video.volume = newVolume;
                                showIndicator(`Volume: ${Math.round(newVolume * 100)}%`);
                                e.preventDefault();
                            }
                        }
                    }
                }, { passive: false });

                container.addEventListener('touchend', (e) => {
                    if (seekHud) seekHud.classList.remove('active');
                    
                    if (isDragging && dragType === 'seek') {
                        if (targetSeekTime >= 0) {
                            if (player) player.currentTime = targetSeekTime; else video.currentTime = targetSeekTime;
                            showIndicator(`Seeked to ${formatTime(targetSeekTime)}`);
                        }
                        isDragging = false;
                        dragType = null;
                        return;
                    }

                    if (isDragging) {
                        isDragging = false;
                        dragType = null;
                        return;
                    }

                    if (e.target.closest('.plyr__controls') || e.target.closest('button') || e.target.closest('.modal')) {
                        return;
                    }

                    if (e.touches.length === 0) {
                        const currentTime = new Date().getTime();
                        const tapLength = currentTime - lastTap;
                        const rect = container.getBoundingClientRect();
                        const clientX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : (rect.left + rect.width / 2);
                        const x = clientX - rect.left;

                        // Check if this was a double tap
                        if (tapLength < 280 && tapLength > 0) {
                            if (singleTapTimeout) {
                                clearTimeout(singleTapTimeout);
                                singleTapTimeout = null;
                            }

                            if (x < rect.width * 0.35) {
                                if (player && player.rewind) player.rewind(10); else video.currentTime = Math.max(0, video.currentTime - 10);
                                showIndicator('Rewind 10s «');
                            } else if (x > rect.width * 0.65) {
                                if (player && player.forward) player.forward(10); else video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
                                showIndicator('Forward 10s »');
                            } else {
                                document.body.classList.toggle('video-zoom-fill');
                                showIndicator(document.body.classList.contains('video-zoom-fill') ? 'Zoomed to Fill' : 'Original Fit');
                            }
                            lastTap = 0;
                            e.preventDefault();
                        } else {
                            // Single tap: schedule single-tap action with a short debounce
                            lastTap = currentTime;
                            if (singleTapTimeout) clearTimeout(singleTapTimeout);
                            singleTapTimeout = setTimeout(() => {
                                if (!isDragging) {
                                    // Cleanly toggle play/pause on touch
                                    if (video.paused) {
                                        if (player && typeof player.play === 'function') {
                                            player.play().catch(() => video.play().catch(() => {}));
                                        } else {
                                            video.play().catch(() => {});
                                        }
                                        showIndicator('▶ Playing');
                                    } else {
                                        if (player && typeof player.pause === 'function') {
                                            player.pause();
                                        } else {
                                            video.pause();
                                        }
                                        showIndicator('⏸ Paused');
                                    }
                                }
                                singleTapTimeout = null;
                            }, 240);
                        }
                    }
                    isDragging = false;
                    dragType = null;
                }, { passive: false });

                // Initialize Timeline Touch Scrubbing
                initSmoothTouchTimeline(player, video);
            }
                // Keyboard Shortcuts
            document.addEventListener('keydown', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                switch(e.key.toLowerCase()) {
                    case ' ':
                    case 'k':
                        e.preventDefault();
                        if (video.paused) video.play(); else video.pause();
                        break;
                    case 'arrowright':
                    case 'l':
                        e.preventDefault();
                        video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
                        showIndicator('+10s Forward');
                        break;
                    case 'arrowleft':
                    case 'j':
                        e.preventDefault();
                        video.currentTime = Math.max(0, video.currentTime - 10);
                        showIndicator('-10s Rewind');
                        break;
                    case 'arrowup':
                        e.preventDefault();
                        video.volume = Math.min(1, video.volume + 0.1);
                        showIndicator(`Volume: ${Math.round(video.volume * 100)}%`);
                        break;
                    case 'arrowdown':
                        e.preventDefault();
                        video.volume = Math.max(0, video.volume - 0.1);
                        showIndicator(`Volume: ${Math.round(video.volume * 100)}%`);
                        break;
                    case 'f':
                        e.preventDefault();
                        if (!document.fullscreenElement) {
                            document.getElementById('player-container').requestFullscreen().catch(() => {});
                        } else {
                            document.exitFullscreen();
                        }
                        break;
                    case 'm':
                        e.preventDefault();
                        video.muted = !video.muted;
                        showIndicator(video.muted ? 'Muted' : 'Unmuted');
                        break;
                    case 'a':
                        e.preventDefault();
                        toggleAspectRatio();
                        break;
                }
            });
            // Akamai __hdnea__ Token Interceptor for JioTV DASH Chunks (.m4s)
            if (!window._xhrAkamaiIntercepted) {
                window._xhrAkamaiIntercepted = true;
                const origXhrOpen = XMLHttpRequest.prototype.open;
                XMLHttpRequest.prototype.open = function(method, urlStr, ...rest) {
                    if (urlStr && typeof urlStr === 'string' && window._activeAkamaiToken) {
                        if ((urlStr.includes('.mpd') || urlStr.includes('.m4s') || urlStr.includes('jio')) && !urlStr.includes('__hdnea__')) {
                            urlStr = urlStr + (urlStr.includes('?') ? '&' : '?') + window._activeAkamaiToken;
                        }
                    }
                    return origXhrOpen.call(this, method, urlStr, ...rest);
                };
            }

            window.reconnectAttempts = 0;
            const MAX_RECONNECT_ATTEMPTS = 999;
            // Smart Auto-Reconnect Watchdog
            window.triggerAutoReconnect = async function() {
                if (isReconnecting) return;
                window.reconnectAttempts++;
                if (window.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
                    console.warn(`[Player] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached.`);
                    isReconnecting = false;
                    loading.style.display = 'none';
                    showPlayerError("⚠️ Stream Offline: The upstream provider for this channel is currently offline or returning an invalid stream. Please select another live channel or try again later.");
                    return;
                }
                isReconnecting = true;
                console.warn(`[Player] Triggering Auto-Reconnect (Attempt ${window.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
                loading.style.display = 'flex';
                if (typeof destroyMpegPlayer === 'function') {
                    destroyMpegPlayer();
                } else if (mpegPlayer) {
                    try {
                        mpegPlayer.destroy();
                    } catch(e){}
                    mpegPlayer = null;
                }
                if (hls) {
                    try { hls.destroy(); const v = document.getElementById('player'); if(v){ v.src = ''; v.load(); } } catch(e){}
                    hls = null;
                }
                const urlParams = new URLSearchParams(window.location.search);
                const rawIdParam = urlParams.get('id') || urlParams.get('url') || '';
                const isBingrReq = urlParams.has('media_type') || urlParams.has('type') || urlParams.has('tmdbId') || urlParams.has('srv') || (rawIdParam && !isNaN(Number(rawIdParam)) && rawIdParam.length > 3);
                
                if (!isBingrReq && rawIdParam && !rawIdParam.startsWith('http') && !rawIdParam.includes('.mp4') && !rawIdParam.includes('.mkv')) {
                    try {
                        const resolveRes = await fetch(`/api/resolve_stream/${encodeURIComponent(rawIdParam)}?nocache=1`);
                        if (resolveRes.ok) {
                            const resolveData = await resolveRes.json();
                            if (resolveData && resolveData.status === 'success' && resolveData.url) {
                                streamUrl = resolveData.url;
                                console.log('[Auto-Reconnect] Resolved fresh stream token:', streamUrl);
                            }
                        }
                    } catch(e) {
                        console.warn('[Auto-Reconnect] Fresh token resolve failed:', e);
                    }
                }
                setTimeout(() => {
                    isReconnecting = false;
                    initPlayer();
                }, 1500);
            }
            function jumpToSafeLiveBuffer(vid) {
                if (!vid || vid.paused || vid.seeking || !vid.buffered || vid.buffered.length === 0) return;
                const start = vid.buffered.start(0);
                const end = vid.buffered.end(vid.buffered.length - 1);
                // If currentTime is behind buffer start when playing, move safely forward
                if (vid.currentTime < start - 0.5) {
                    console.warn(`[Live Guard] currentTime (${vid.currentTime}) behind buffer start (${start}). Fast-forwarding...`);
                    vid.currentTime = Math.max(start + 0.1, end - 0.5);
                    vid.play().catch(() => {});
                }
            }
            function startWatchdog() {
                if (watchdogTimer) clearInterval(watchdogTimer);
                lastCurrentTime = video.currentTime;
                lastProgressTime = Date.now();
                watchdogTimer = setInterval(() => {
                    if (isReconnecting || video.paused || video.ended || video.seeking) {
                        lastCurrentTime = video.currentTime;
                        lastProgressTime = Date.now();
                        return;
                    }
                    if (video.currentTime !== lastCurrentTime) {
                        lastCurrentTime = video.currentTime;
                        lastProgressTime = Date.now();
                    } else {
                        const stalledTime = Date.now() - lastProgressTime;
                        if (stalledTime > 45000) {
                            console.warn(`[Watchdog] Stream playback completely frozen for ${Math.round(stalledTime/1000)}s. Auto-reconnecting...`);
                            triggerAutoReconnect();
                        }
                    }
                }, 1000);
            }
            // Live player subtitles / sources cache
            window.bingrSources = [];
            window.bingrSubtitles = [];

            window.injectBingrSubtitles = function() {
                const video = document.getElementById('player');
                if (!video) return;
                
                // Ensure CORS is set for subtitles
                if (video.crossOrigin !== 'anonymous') {
                    video.crossOrigin = 'anonymous';
                }
                
                const addTracks = () => {
                    if (window.bingrSubtitles && window.bingrSubtitles.length > 0) {
                        window.bingrSubtitles.forEach((sub, idx) => {
                            let vttUrl = sub.url;
                            if (sub.url && sub.url.includes('.srt')) {
                                vttUrl = '/api/bingr/srt2vtt?url=' + encodeURIComponent(sub.url);
                            }
                            
                            const label = sub.label || sub.lang || 'Subtitle ' + (idx+1);
                            
                            // Check if track with same label exists, update src instead of duplicating
                            let existingTrack = null;
                            video.querySelectorAll('track').forEach(t => {
                                if (t.label === label) existingTrack = t;
                            });
                            
                            if (existingTrack) {
                                if (existingTrack.getAttribute('src') !== vttUrl) {
                                    existingTrack.setAttribute('src', vttUrl);
                                }
                                return;
                            }
                            
                            const track = document.createElement('track');
                            track.kind = 'subtitles';
                            track.label = label;
                            track.srclang = sub.lang || 'en';
                            track.src = vttUrl;
                            track.default = false; 
                            video.appendChild(track);
                        });
                    }
                };
                
                addTracks();
                video.addEventListener('loadedmetadata', addTracks, { once: true });
            }

            // Main Player Initialization
            // Main Player Initialization
            async function initPlayer() {
                if (!src) {
                    showPlayerError("No stream URL specified.");
                    return;
                }
                // 15 seconds fallback warning
                setTimeout(() => {
                    const fallbackBtn = document.getElementById('loading-fallback');
                    if (fallbackBtn) fallbackBtn.classList.remove('hidden');
                }, 15000);

                const urlParams = new URLSearchParams(window.location.search);
                let resolvedSrc = src;
                let drmKeyId = (urlParams.get('key_id') || urlParams.get('keyid') || '').trim();
                let drmKey = (urlParams.get('key') || '').trim();
                const clearkeyParam = urlParams.get('clearkey');
                if (clearkeyParam && clearkeyParam.includes(':') && (!drmKeyId || !drmKey)) {
                    const ckParts = clearkeyParam.split(':');
                    const pId = (ckParts[0] || '').trim().replace(/[^0-9a-fA-F]/g, '');
                    const pKey = (ckParts[1] || '').trim().replace(/[^0-9a-fA-F]/g, '');
                    if (pId.length === 32 && pKey.length === 32) {
                        drmKeyId = pId;
                        drmKey = pKey;
                    }
                }
                const channelIdParam = (urlParams.get('channel_id') || '').toLowerCase();
                const eventIdParam = (urlParams.get('event_id') || '').toLowerCase();

                // Check for live sporting event
                const isEvent = eventIdParam || channelIdParam.startsWith('live-event-') || channelIdParam.startsWith('cric-event-') || channelIdParam.startsWith('fancode-') || channelIdParam.startsWith('prime-');
                if (isEvent) {
                    const eventId = eventIdParam || channelIdParam;
                    try {
                        const statusEl = document.getElementById('apple-loading-status');
                        if (statusEl) statusEl.textContent = `Resolving Live Sports Event...`;
                        const res = await fetch(`/api/live/event/${encodeURIComponent(eventId)}`);
                        if (res.ok) {
                            const ev = await res.json();
                            if (ev && ev.stream_url) {
                                src = ev.stream_url;
                                resolvedSrc = src;
                                if (ev.source === 'fancode' || ev.badge === 'FANCODE' || src.includes('fancode') || src.includes('in-mc-flive') || src.includes('sonydaimenew') || src.includes('akamaized.net') || src.includes('sonyliv') || src.includes('slivcdn') || src.includes('dai-fancode') || src.includes('livetv.hotstar.com') || src.includes('live09p.hotstar.com') || src.includes('dishmt')) {
                                    src = `/api/proxy/fancode?url=${encodeURIComponent(src)}`;
                                    resolvedSrc = src;
                                }
                                if (ev.key_id && ev.key) {
                                    const cId = (ev.key_id + '').trim().replace(/[^0-9a-fA-F]/g, '');
                                    const cKey = (ev.key + '').trim().replace(/[^0-9a-fA-F]/g, '');
                                    if (cId.length === 32 && cKey.length === 32) {
                                        drmKeyId = cId;
                                        drmKey = cKey;
                                        window._activeClearKeyId = drmKeyId;
                                        window._activeClearKey = drmKey;
                                    } else {
                                        drmKeyId = '';
                                        drmKey = '';
                                        window._activeClearKeyId = '';
                                        window._activeClearKey = '';
                                    }
                                } else {
                                    drmKeyId = '';
                                    drmKey = '';
                                    window._activeClearKeyId = '';
                                    window._activeClearKey = '';
                                }
                                if (ev.name) {
                                    name = ev.name;
                                    document.title = `${ev.name} | Live Sports`;
                                    const titleEl = document.getElementById('media-title');
                                    if (titleEl) titleEl.textContent = ev.name;
                                }
                            }
                        }
                    } catch (e) {}
                }

                // Detect Live TV channels (JioTV, SonyLIV, Hotstar)
                const rawUrl = (urlParams.get('url') || '').toLowerCase();
                const checkSrc = (src || '').toLowerCase();
                const isChannel = channelIdParam.startsWith('jtv-') || channelIdParam.startsWith('mdtv-') || checkSrc.includes('jtv-') || checkSrc.includes('mdtv-') || rawUrl.includes('jtv-') || rawUrl.includes('mdtv-') || channelIdParam.includes('hotstar') || channelIdParam.includes('sonyliv') || channelIdParam.includes('big') || channelIdParam.includes('bb') || ((name || '').toLowerCase().includes('bigboss'));

                if (isChannel) {
                    let cleanId = channelIdParam.replace(/^(?:jtv|mdtv)[-_]/, '');
                    if (!cleanId) {
                        const m = (checkSrc + ' ' + rawUrl).match(/(?:jtv|mdtv)[-_]([a-zA-Z0-9_-]+)/i);
                        if (m) cleanId = m[1];
                    }
                    if (!cleanId && (name || '').toLowerCase().includes('bigboss')) {
                        cleanId = 'hotstar-4';
                    }
                    if (cleanId) {
                        try {
                            const statusEl = document.getElementById('apple-loading-status');
                            if (statusEl) statusEl.textContent = `Resolving channel ${cleanId}...`;
                            console.log("[Player] Resolving channel stream metadata for:", cleanId);
                            const res = await fetch(`/api/jtv/stream/${encodeURIComponent(cleanId)}`);
                            if (res.ok) {
                                const ch = await res.json();
                                if (ch) {
                                    const isDashStream = ch.manifest_type === 'mpd' || 
                                                         (ch.manifest_url && ch.manifest_url.includes('.mpd')) || 
                                                         (ch.stream_url && ch.stream_url.includes('.mpd')) || 
                                                         (ch.full_stream_url && ch.full_stream_url.includes('.mpd')) || 
                                                         (ch.key_id && ch.key) || !!ch.clearkey;

                                    if (!isDashStream && (ch.source === 'sonyliv' || ch.stream_url?.includes('.m3u8') || ch.full_stream_url?.includes('.m3u8'))) {
                                        // Direct HLS stream (SonyLIV, FanCode HLS)
                                        src = ch.full_stream_url || ch.stream_url;
                                        if (!src.includes('/api/proxy/')) {
                                            src = `/api/proxy/fancode?url=${encodeURIComponent(src)}`;
                                        }
                                        resolvedSrc = src;
                                    } else {
                                        // DASH ClearKey stream (JioTV, Hotstar DASH, etc.)
                                        // Prefer direct CDN URL (full_stream_url) so browser fetches MPD directly —
                                        // avoids GCP datacenter IP blocks (HTTP 451) on server-side manifest proxy
                                        const cId = (ch.key_id + '').trim().replace(/[^0-9a-fA-F]/g, '');
                                        const cKey = (ch.key + '').trim().replace(/[^0-9a-fA-F]/g, '');
                                        const hasValidClearKey = cId.length === 32 && cKey.length === 32;

                                        if (hasValidClearKey) {
                                            src = ch.full_stream_url || ch.manifest_url || `/api/jtv/manifest/${ch.id}.mpd` || ch.stream_url;
                                            resolvedSrc = src;
                                            if (ch.token) window._activeAkamaiToken = ch.token;
                                            drmKeyId = cId;
                                            drmKey = cKey;
                                            window._activeClearKeyId = drmKeyId;
                                            window._activeClearKey = drmKey;
                                        } else {
                                            // Channel has NO ClearKey keys (Widevine WDVLive or clear stream)
                                            // If src was already auto-resolved to an HLS stream (e.g. from /api/channels/resolve), preserve it!
                                            if (src && src.includes('.m3u8')) {
                                                resolvedSrc = src;
                                            } else {
                                                src = ch.full_stream_url || ch.stream_url;
                                                resolvedSrc = src;
                                            }
                                            if (ch.token) window._activeAkamaiToken = ch.token;
                                            drmKeyId = '';
                                            drmKey = '';
                                            window._activeClearKeyId = '';
                                            window._activeClearKey = '';
                                        }
                                    }
                                    if (ch.name && (!name || name === 'Live Stream' || name === 'Live Channel')) {
                                        name = ch.name;
                                        document.title = `${ch.name} | Live TV`;
                                        const titleEl = document.getElementById('media-title');
                                        if (titleEl) titleEl.textContent = ch.name;
                                    }
                                }
                            }
                        } catch (err) {
                            console.warn("[Player] Channel resolution error, attempting direct stream:", err);
                        }
                    }
                }

                // Extract Akamai token if already present in stream URL
                const tokenMatch = (src + ' ' + (urlParams.get('url') || '')).match(/(__hdnea__=[^&]+)/);
                if (tokenMatch && !window._activeAkamaiToken) {
                    window._activeAkamaiToken = tokenMatch[1];
                }

                // Auto-route FanCode and SonyLIV protected HLS through local proxy if not already wrapped (never wrap DASH .mpd)
                if (src && !src.includes('/api/proxy/') && !src.includes('/proxy?')) {
                    const sLower = src.toLowerCase();
                    const isMpdManifest = sLower.includes('.mpd') || sLower.includes('manifest');
                    if (!isMpdManifest && (sLower.includes('fancode') || sLower.includes('in-mc-flive') || sLower.includes('sonydaimenew') || sLower.includes('akamaized.net') || sLower.includes('sonyliv') || sLower.includes('slivcdn') || sLower.includes('dai-fancode') || sLower.includes('livetv.hotstar.com') || sLower.includes('live09p.hotstar.com') || sLower.includes('dishmt'))) {
                        src = `/api/proxy/fancode?url=${encodeURIComponent(src)}`;
                        resolvedSrc = src;
                    }
                }

                // Global XHR & Fetch interceptor for Akamai token injection on chunks (.m4s, .dash, .mpd)
                if (!window._xhrIntercepted) {
                    window._xhrIntercepted = true;
                    const origOpen = XMLHttpRequest.prototype.open;
                    XMLHttpRequest.prototype.open = function(method, u, ...args) {
                        if (u && typeof u === 'string' && window._activeAkamaiToken) {
                            if ((u.includes('.mpd') || u.includes('.m4s') || u.includes('.dash') || u.includes('.m3u8') || u.includes('jio')) && !u.includes('__hdnea__')) {
                                const token = window._activeAkamaiToken.startsWith('__hdnea__=') 
                                    ? window._activeAkamaiToken 
                                    : ('__hdnea__=' + window._activeAkamaiToken);
                                u = u + (u.includes('?') ? '&' : '?') + token;
                            }
                        }
                        return origOpen.call(this, method, u, ...args);
                    };

                    const origFetch = window.fetch;
                    window.fetch = function(input, init) {
                        if (typeof input === 'string' && window._activeAkamaiToken) {
                            if ((input.includes('.mpd') || input.includes('.m4s') || input.includes('.dash') || input.includes('jio')) && !input.includes('__hdnea__')) {
                                const token = window._activeAkamaiToken.startsWith('__hdnea__=') 
                                    ? window._activeAkamaiToken 
                                    : ('__hdnea__=' + window._activeAkamaiToken);
                                input = input + (input.includes('?') ? '&' : '?') + token;
                            }
                        }
                        return origFetch.call(this, input, init);
                    };
                }

                const lowerSrc = (src || '').toLowerCase();
                let decodedLowerSrc = lowerSrc;
                try { decodedLowerSrc = decodeURIComponent(lowerSrc); } catch(e){}
                const urlParamsForMedia = new URLSearchParams(window.location.search);
                const mediaTypeParam = (urlParamsForMedia.get('type') || '').toLowerCase();
                let isExplicitDash = !lowerSrc.includes('.m3u8') && !decodedLowerSrc.includes('.m3u8') && (
                    lowerSrc.includes('.mpd') ||
                    decodedLowerSrc.includes('.mpd') ||
                    mediaTypeParam === 'dash' ||
                    mediaTypeParam === 'mpd' ||
                    (!!drmKeyId && !lowerSrc.includes('.m3u8'))
                );
                const isMovieOrSeries = urlParamsForMedia.get('media_type') === 'movie' || urlParamsForMedia.get('media_type') === 'series';
                const isMkv = lowerSrc.includes('.mkv') || decodedLowerSrc.includes('.mkv');
                const isForceHls = !isExplicitDash && (urlParamsForMedia.get('type') === 'hls' || urlParamsForMedia.get('hls') === '1' || lowerSrc.includes('type=hls') || lowerSrc.includes('hls=1') || lowerSrc.includes('.m3u8') || lowerSrc.includes('m3u=1'));
                
                // "make hls m3u if it is mkv not hls use mpeg buttery smooth"
                const isExplicitTs = !isExplicitDash && !isForceHls && (
                    isMkv ||
                    lowerSrc.endsWith('.ts') ||
                    lowerSrc.includes('custom_ts=1') ||
                    lowerSrc.includes('type=mpegts') ||
                    lowerSrc.includes('type=ts') ||
                    mediaTypeParam === 'mpegts'
                );

                const isDirectVideoFile = lowerSrc.endsWith('.mp4') || lowerSrc.endsWith('.webm') || lowerSrc.endsWith('.m4v') || lowerSrc.endsWith('.mov') || lowerSrc.endsWith('.mp3');
                const isDirectMedia = !isMkv && !isExplicitDash && !isForceHls && isDirectVideoFile;
                const isFromBingrSources = (window.bingrSources || []).some(s => s && s.url && (s.url === src || src.startsWith(s.url) || s.url.startsWith(src)));
                
                // Identify CORS-restricted domains that absolutely must be proxied by Node backend
                const needsProxy = lowerSrc.includes('peakstorm') || 
                                   lowerSrc.includes('nxocw') || 
                                   lowerSrc.includes('flocw') || 
                                   lowerSrc.includes('knocw') || 
                                   lowerSrc.includes('streamrip') || 
                                   lowerSrc.includes('filmu') ||
                                   lowerSrc.includes('acek-cdn') ||
                                   lowerSrc.includes('dramiyos') ||
                                   lowerSrc.includes('morencius') ||
                                   lowerSrc.includes('movies4u') ||
                                   lowerSrc.includes('m4uplay');

                const isDirectCorsAllowed = !needsProxy && (
                    lowerSrc.includes('workers.dev') ||
                    lowerSrc.includes('hakunaymatata') ||
                    lowerSrc.includes('jiotv') ||
                    lowerSrc.includes('jio.com') ||
                    lowerSrc.includes('/api/proxy') ||
                    lowerSrc.includes('proxy/fancode') ||
                    lowerSrc.includes('proxy/hls') ||
                    lowerSrc.includes('hotstar-cdn.net') ||
                    lowerSrc.includes('hotstar.com') ||
                    lowerSrc.includes('fancode.com') ||
                    lowerSrc.includes('sonyliv.com') ||
                    lowerSrc.includes('akamaized.net') ||
                    lowerSrc.includes('.m3u8') ||
                    isForceHls
                );

                if ((src.startsWith('http://') || src.startsWith('https://')) && !src.includes('live.php') && !src.includes('xtream.php')) {
                    if (isExplicitDash || lowerSrc.includes('.mpd') || lowerSrc.includes('jio')) {
                        resolvedSrc = src; // Native DASH ClearKey streams must be fetched directly by Dash.js
                    } else if (isExplicitTs) {
                        resolvedSrc = `/api/stream-proxy?url=${encodeURIComponent(src)}&type=mpegts`;
                    } else if (isDirectCorsAllowed || lowerSrc.includes('/api/proxy') || lowerSrc.includes('.m3u8')) {
                        resolvedSrc = src; // Keep direct URL or local proxy for HLS streams
                    } else {
                        resolvedSrc = `live.php?id=${encodeURIComponent(src)}&m3u=1`;
                    }
                }
                try {
                    resolvedSrc = new URL(resolvedSrc, window.location.origin).href;
                } catch(e) {
                    console.warn("URL resolution error:", e);
                }

                let isAutoplayMuted = false;

                function showUnmuteBadge() {
                    let badge = document.getElementById('unmuteFloatingBadge');
                    if (!badge) {
                        badge = document.createElement('div');
                        badge.id = 'unmuteFloatingBadge';
                        badge.className = 'fixed top-6 right-6 z-[99999] flex items-center gap-2.5 px-4 py-2.5 bg-red-600/95 hover:bg-red-500 text-white text-xs sm:text-sm font-black tracking-wide rounded-full shadow-2xl border border-white/30 cursor-pointer select-none backdrop-blur-md transition-all active:scale-95 animate-bounce';
                        badge.innerHTML = `
                            <svg class="w-4 h-4 shrink-0 animate-pulse text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/><path stroke-linecap="round" stroke-linejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/></svg>
                            <span>TAP OR PRESS OK TO UNMUTE</span>
                        `;
                        badge.onclick = (e) => {
                            e.stopPropagation();
                            unmuteAndPlay();
                        };
                        document.body.appendChild(badge);
                    }
                    badge.style.display = 'flex';
                }

                function hideUnmuteBadge() {
                    const badge = document.getElementById('unmuteFloatingBadge');
                    if (badge) badge.style.display = 'none';
                }

                function unmuteAndPlay() {
                    try {
                        video.muted = false;
                        if (window.plyrPlayer) window.plyrPlayer.muted = false;
                        if (window.player) window.player.muted = false;
                        isAutoplayMuted = false;
                        hideUnmuteBadge();
                        if (video.paused) {
                            video.play().catch(() => {});
                        }
                        console.log("[Audio Recovery] Audio unmuted successfully!");
                    } catch(e) {}
                }

                function triggerSafePlayback(source = 'general') {
                    const p = video.play();
                    if (p !== undefined && p && p.catch) {
                        p.then(() => {
                            console.log(`[Playback Engine] ${source} play() succeeded with audio!`);
                            if (!video.muted) {
                                hideUnmuteBadge();
                            }
                        }).catch(err => {
                            console.warn(`[Playback Engine] ${source} direct unmuted play blocked (${err.name}). Engaging muted autoplay fallback...`);
                            video.muted = true;
                            if (window.plyrPlayer) {
                                try { window.plyrPlayer.muted = true; } catch(e){}
                            }
                            if (window.player) {
                                try { window.player.muted = true; } catch(e){}
                            }
                            isAutoplayMuted = true;
                            video.play().then(() => {
                                console.log(`[Playback Engine] ${source} muted autoplay succeeded! Showing unmute badge.`);
                                showUnmuteBadge();
                            }).catch(e2 => {
                                console.warn(`[Playback Engine] ${source} muted autoplay also blocked (${e2.name}). Awaiting user click.`);
                            });
                        });
                    }
                }

                // Initial user gesture listener for TV remote, keyboard, touch to unmute blocked autoplay
                let hasHandledInitialUnmute = false;
                function handleInitialUserUnmute() {
                    if (hasHandledInitialUnmute) return;
                    if (isAutoplayMuted || video.muted) {
                        hasHandledInitialUnmute = true;
                        unmuteAndPlay();
                    }
                }
                ['click', 'touchstart', 'keydown'].forEach(evt => {
                    document.addEventListener(evt, handleInitialUserUnmute, { once: true, passive: true });
                });

                function destroyMpegPlayer() {
                    if (mpegPlayer) {
                        try {
                            mpegPlayer.destroy();
                        } catch(e){}
                        mpegPlayer = null;
                    }
                }
                function loadMpegTs(streamUrl) {
                    try {
                        streamUrl = new URL(streamUrl, window.location.origin).href;
                    } catch(e){}
                    console.log("[MPEG-TS Engine] Initializing buttery-smooth mpegts.js for stream:", streamUrl);
                    destroyMpegPlayer();
                    try {
                        const isLive = !isMkv && (lowerSrc.includes('/live/') || lowerSrc.endsWith('.ts'));
                        mpegPlayer = mpegts.createPlayer({
                            type: 'mpegts',
                            isLive: isLive,
                            url: streamUrl
                        }, {
                            enableWorker: true,
                            enableStashBuffer: false,
                            stashInitialSize: 256,
                            liveBufferLatencyChasing: isLive,
                            liveBufferLatencyMaxLatency: 3,
                            liveBufferLatencyMinLatency: 1,
                            liveBufferLatencyChasingOnStall: isLive,
                            fixAudioTimestampGap: true,
                            reuse33bitClip: true,
                            autoCleanupSourceBuffer: true,
                            autoCleanupMaxBackwardDuration: 120,
                            autoCleanupMinBackwardDuration: 60,
                            lazyLoad: false
                        });
                        mpegPlayer.attachMediaElement(video);
                        mpegPlayer.load();
                        mpegPlayer.on(mpegts.Events.MEDIA_INFO, (mediaInfo) => {
                            console.log("[MPEG-TS Engine] Media Info parsed:", mediaInfo);
                            reconnectAttempts = 0;
                            if (video.paused) {
                                const p = video.play();
                                if (p && p.catch) {
                                    p.catch(() => {
                                        console.warn("[MPEG-TS] Autoplay unmuted blocked, muting video to auto-start...");
                                        video.muted = true;
                                        video.play().catch(() => {});
                                    });
                                }
                            }
                        });
                        mpegPlayer.on(mpegts.Events.ERROR, (type, details, data) => {
                            console.error('[MPEG-TS Engine Error]', type, details, data);
                            if (type === mpegts.ErrorTypes.MEDIA_ERROR || details === mpegts.ErrorDetails.FORMAT_UNSUPPORTED) {
                                console.warn("[MPEG-TS] Fallback to native or HLS video playback...");
                                destroyMpegPlayer();
                                if (Hls.isSupported()) {
                                    loadHls(streamUrl);
                                } else {
                                    video.src = streamUrl;
                                    video.load();
                                    video.play().catch(e => {
                                        showPlayerError("Playback failed: Incompatible MPEG-TS video/audio codecs or unreachable stream.");
                                    });
                                }
                                return;
                            } else if (type === mpegts.ErrorTypes.NETWORK_ERROR) {
                                console.warn("[MPEG-TS Network Error] Attempting auto-reconnect...");
                                triggerAutoReconnect();
                                return;
                            }
                            triggerAutoReconnect();
                        });
                        // Anti-Freeze & Rate Guard
                        video.addEventListener('ratechange', () => {
                            if (video.playbackRate !== 1.0) {
                                video.playbackRate = 1.0;
                            }
                        });
                    } catch (err) {
                        console.error("[MPEG-TS Engine Init Failed]", err);
                        if (Hls.isSupported()) {
                            loadHls(streamUrl);
                        } else {
                            video.src = streamUrl;
                            video.load();
                            video.play().catch(() => {
                                showPlayerError("Failed to initialize MPEG-TS player: " + (err.message || "Unknown error"));
                            });
                        }
                        return;
                    }
                    if (!player) {
                        player = new Plyr(video, {
                            controls: ['play-large', 'rewind', 'play', 'fast-forward', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'pip', 'fullscreen'],
                            autoplay: true,
                            muted: false,
                                hideControls: { enabled: true, delay: 4000 },
                clickToPlay: true, fullscreen: { enabled: true, fallback: true, iosNative: true }
                            });
                        window.plyrPlayer = player;
                        window.player = player;
                    }
                    video.style.opacity = '1';
                    hideLoadingScreen();
                    triggerSafePlayback('MPEG-TS');
                    initTopControls(player);
                    initAdvancedGestures(player, video);
                    startWatchdog();
                    window.mpegPlayer = mpegPlayer;
                }
                function loadHls(streamUrl) {
                    try {
                        streamUrl = new URL(streamUrl, window.location.origin).href;
                    } catch(e){}
                    console.log("[HLS Engine] Initializing Hls.js for stream:", streamUrl);
                    if (hls) {
                        try { hls.destroy(); const v = document.getElementById('player'); if(v){ v.src = ''; v.load(); } } catch(e){}
                        hls = null;
                    }
                    hls = new Hls({
                        enableWorker: true,
                        maxBufferLength: 30,
                        maxMaxBufferLength: 60,
                        maxBufferSize: 256 * 1024 * 1024,
                        backBufferLength: 60,
                        maxBufferHole: 0.5,
                        highBufferWatchdogPeriod: 2,
                        nudgeOffset: 0.2,
                        nudgeMaxRetry: 10,
                        liveSyncDurationCount: 3,
                        liveMaxLatencyDurationCount: 10,
                        liveDurationInfinity: true,
                        lowLatencyMode: false,
                        manifestLoadingTimeOut: 30000,
                        manifestLoadingMaxRetry: 8,
                        manifestLoadingRetryDelay: 1000,
                        levelLoadingTimeOut: 30000,
                        levelLoadingMaxRetry: 8,
                        fragLoadingTimeOut: 30000,
                        fragLoadingMaxRetry: 8,
                        fragLoadingRetryDelay: 1000,
                        xhrSetup: (xhr) => {
                            xhr.withCredentials = false;
                        }
                    });
                    hls.loadSource(streamUrl);
                    hls.attachMedia(video);
                    hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                        console.log(`[HLS] Manifest parsed. Quality levels: ${data.levels.length}`);
                        reconnectAttempts = 0;
                        video.style.opacity = '1';
                        hideLoadingScreen();
                        if (!player) {
                            player = new Plyr(video, {
                                controls: ['play-large', 'rewind', 'play', 'fast-forward', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'pip', 'fullscreen'],
                                autoplay: true,
                                muted: false,
                                hideControls: { enabled: true, delay: 4000 },
                                clickToPlay: true, fullscreen: { enabled: true, fallback: true, iosNative: true }
                            });
                            window.plyrPlayer = player;
                            window.player = player;
                        }
                        triggerSafePlayback('HLS-Manifest-Parsed');
                        initTopControls(player);
                        initAdvancedGestures(player, video);
                        startWatchdog();
                    });
                    hls.on(Hls.Events.ERROR, (event, data) => {
                        console.warn('[HLS Error Event]', data.type, data.details, data.fatal ? 'FATAL' : 'NON-FATAL');
                        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                            if (data.details === 'bufferSeekOverHole' || data.details === Hls.ErrorDetails.BUFFER_SEEK_OVER_HOLE) {
                                if (data.buffer) {
                                    video.currentTime = data.buffer.nextStart;
                                }
                                return;
                            }
                            if (data.details === 'bufferStalledError' || data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
                                console.warn('[HLS] Non-fatal buffer stall detected. Nudging playhead and recovering playback...');
                                if (video.buffered && video.buffered.length > 0) {
                                    const curTime = video.currentTime;
                                    let nudged = false;
                                    for (let i = 0; i < video.buffered.length; i++) {
                                        const start = video.buffered.start(i);
                                        const end = video.buffered.end(i);
                                        if (curTime < start) {
                                            video.currentTime = start + 0.1;
                                            nudged = true;
                                            break;
                                        } else if (curTime >= start && curTime < end) {
                                            if (end - curTime < 0.3 && i + 1 < video.buffered.length) {
                                                video.currentTime = video.buffered.start(i + 1) + 0.1;
                                                nudged = true;
                                            }
                                            break;
                                        }
                                    }
                                    if (!nudged) {
                                        const end = video.buffered.end(video.buffered.length - 1);
                                        if (video.currentTime < end - 0.2) {
                                            video.currentTime += 0.15;
                                        }
                                    }
                                }
                                if (video.paused && !video.ended) {
                                    triggerSafePlayback('HLS-Buffer-Stall');
                                }
                                return;
                            }
                        }
                        if (data.fatal) {
                            if (data.details === 'manifestParsingError' || data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
                                if (isMdtv || (streamUrl && (streamUrl.includes('mdtv') || streamUrl.includes('.mpd')))) {
                                    console.log('[HLS Fallback] Detected MPD manifest on DASH/MDTV stream. Switching to DASH/Shaka engine...');
                                    if (typeof shaka !== 'undefined') {
                                        loadShaka(streamUrl, drmKeyId, drmKey);
                                    } else {
                                        loadDash(streamUrl, drmKeyId, drmKey);
                                    }
                                    return;
                                }
                                loading.style.display = 'none';
                                showPlayerError("⚠️ Stream Feed Unreachable: The upstream provider for this channel is currently offline or returning an invalid stream. Please try another live channel (e.g. Sony, TimStreams, Sports).");
                                return;
                            }
                            switch (data.type) {
                                case Hls.ErrorTypes.NETWORK_ERROR:
                                    console.warn('[HLS Network Error] Retrying stream load...');
                                    if (streamUrl && !streamUrl.includes('live.php') && !streamUrl.includes('/api/stream-proxy')) {
                                        console.warn('[HLS Auto-Proxy] Direct stream failed with network error. Auto-proxying via live.php...');
                                        const proxied = `live.php?id=${encodeURIComponent(src)}&m3u=1`;
                                        loadHls(proxied);
                                        return;
                                    }
                                    triggerAutoReconnect();
                                    break;
                                case Hls.ErrorTypes.MEDIA_ERROR:
                                    console.warn('[HLS Media Error] Recovering media error...');
                                    hls.recoverMediaError();
                                    break;
                                default:
                                    console.error('[HLS Fatal Error] Unrecoverable error.');
                                    if (streamUrl.includes('.mpd')) {
                                        showPlayerError("🔒 DRM Protected Channel: This channel uses Widevine DRM encryption and cannot be played directly in web browser without DRM keys. Please try HLS channels (Sony, TimStreams, Sports).");
                                    } else if (typeof mpegts !== 'undefined' && mpegts.isSupported()) {
                                        loadMpegTs(streamUrl);
                                    } else {
                                        showPlayerError("⚠️ Stream Feed Unreachable: Stream playback failed. Please try another live channel.");
                                    }
                                    break;
                            }
                        }
                    });
                    window.hls = hls;
                }
                
                function hexToBase64Url(hex) {
                    if (!hex) return '';
                    const cleanHex = hex.replace(/[^0-9a-fA-F]/g, '');
                    if (cleanHex.length % 2 !== 0) return '';
                    const bytes = new Uint8Array(cleanHex.length / 2);
                    for (let i = 0; i < cleanHex.length; i += 2) {
                        bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
                    }
                    let binary = '';
                    for (let i = 0; i < bytes.length; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    return btoa(binary)
                        .replace(/\+/g, '-')
                        .replace(/\//g, '_')
                        .replace(/=+$/, '');
                }

                let shakaPlayer = null;
                function destroyShakaPlayer() {
                    if (shakaPlayer) {
                        try { shakaPlayer.destroy(); } catch(e){}
                        shakaPlayer = null;
                    }
                }

                async function loadShaka(streamUrl, keyId, key) {
                    try {
                        streamUrl = new URL(streamUrl, window.location.origin).href;
                    } catch(e){}
                    console.log("[Shaka Engine] Initializing Shaka Player for stream:", streamUrl);
                    destroyMpegPlayer();
                    destroyDashPlayer();
                    destroyShakaPlayer();
                    if (hls) { try { hls.destroy(); const v = document.getElementById('player'); if(v){ v.src = ''; v.load(); } } catch(e){} hls = null; }

                    if (typeof shaka === 'undefined' || !shaka.Player.isBrowserSupported()) {
                        console.warn("[Shaka Engine] Shaka not supported or not loaded, falling back to Dash.js");
                        loadDash(streamUrl, keyId, key);
                        return;
                    }

                    try {
                        shaka.polyfill.installAll();
                        shakaPlayer = new shaka.Player(video);
                        window.shakaPlayer = shakaPlayer;

                        // Configure ClearKey DRM ONLY IF valid 32-character hex keys are available
                        const rawKeyId = (keyId || drmKeyId || window._activeClearKeyId || (typeof urlParamsForMedia !== 'undefined' ? urlParamsForMedia.get('key_id') : '') || '').trim();
                        const rawKey = (key || drmKey || window._activeClearKey || (typeof urlParamsForMedia !== 'undefined' ? urlParamsForMedia.get('key') : '') || '').trim();
                        const cleanKeyId = rawKeyId.toLowerCase().replace(/[^0-9a-f]/g, '');
                        const cleanKey = rawKey.toLowerCase().replace(/[^0-9a-f]/g, '');

                        if (cleanKeyId.length === 32 && cleanKey.length === 32) {
                            shakaPlayer.configure({
                                drm: {
                                    clearKeys: {
                                        [cleanKeyId]: cleanKey
                                    }
                                }
                            });
                            console.log("[Shaka Engine] Configured ClearKey DRM:", cleanKeyId);
                        } else {
                            // Explicitly clear DRM so unencrypted / clear streams play without 6006 EME session errors
                            shakaPlayer.configure({
                                drm: {
                                    clearKeys: {}
                                }
                            });
                            if (cleanKeyId || cleanKey) {
                                console.warn("[Shaka Engine] Ignored invalid ClearKey DRM keys (both must be 32 hex chars):", cleanKeyId, cleanKey);
                            }
                        }

                        // Configure initial bandwidth estimate to 15 Mbps for immediate FHD 1080p
                        shakaPlayer.configure({
                            abr: {
                                enabled: true,
                                defaultBandwidthEstimate: 15000000
                            },
                            streaming: {
                                rebufferingGoal: 2,
                                bufferingGoal: 10,
                                bufferBehind: 30
                            }
                        });

                        // Configure Request Filter for Akamai token injection on chunks
                        shakaPlayer.getNetworkingEngine().registerRequestFilter((type, request) => {
                            if (window._activeAkamaiToken) {
                                const tokenVal = window._activeAkamaiToken.startsWith('__hdnea__=') 
                                    ? window._activeAkamaiToken 
                                    : ('__hdnea__=' + window._activeAkamaiToken);
                                request.uris = request.uris.map(uri => {
                                    if ((uri.includes('.mpd') || uri.includes('.m4s') || uri.includes('.dash') || uri.includes('jio')) && !uri.includes('__hdnea__')) {
                                        return uri + (uri.includes('?') ? '&' : '?') + tokenVal;
                                    }
                                    return uri;
                                });
                            }
                        });

                        shakaPlayer.addEventListener('error', (event) => {
                            console.warn("[Shaka Engine Error]", event.detail);
                        });

                        await shakaPlayer.load(streamUrl);
                        console.log("[Shaka Engine] Stream loaded successfully.");
                        video.style.opacity = '1';
                        hideLoadingScreen();
                        if (!player) {
                            player = new Plyr(video, {
                                controls: ['play-large', 'rewind', 'play', 'fast-forward', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'pip', 'fullscreen'],
                                autoplay: true,
                                muted: false,
                                hideControls: { enabled: true, delay: 4000 },
                                clickToPlay: true, fullscreen: { enabled: true, fallback: true, iosNative: true }
                            });
                            window.plyrPlayer = player;
                            window.player = player;
                        }
                        triggerSafePlayback('Shaka-DASH');
                        initTopControls(player);
                        initAdvancedGestures(player, video);
                        startWatchdog();
                    } catch (err) {
                        console.warn("[Shaka Engine Init Failed] Error:", err, "Falling back to Dash.js...");
                        destroyShakaPlayer();
                        loadDash(streamUrl, keyId, key);
                    }
                }

                let dashPlayer = null;
                function destroyDashPlayer() {
                    if (dashPlayer) {
                        try { dashPlayer.reset(); } catch(e){}
                        dashPlayer = null;
                    }
                    destroyShakaPlayer();
                }
                function loadDash(streamUrl, keyId, key) {
                    try {
                        streamUrl = new URL(streamUrl, window.location.origin).href;
                    } catch(e){}
                    console.log("[DASH Engine] Initializing Dash.js for stream:", streamUrl);
                    destroyMpegPlayer();
                    if (hls) { try { hls.destroy(); const v = document.getElementById('player'); if(v){ v.src = ''; v.load(); } } catch(e){} hls = null; }
                    destroyDashPlayer();
                    
                    try {
                        dashPlayer = dashjs.MediaPlayer().create();

                        // Akamai Token injection for JioTV / MDTV DASH chunks (.m4s, .dash)
                        if (window._activeAkamaiToken) {
                            const tokenVal = window._activeAkamaiToken.startsWith('__hdnea__=') 
                                ? window._activeAkamaiToken 
                                : ('__hdnea__=' + window._activeAkamaiToken);
                            dashPlayer.extend("RequestModifier", () => {
                                return {
                                    modifyRequestURL: (url) => {
                                        if (url && typeof url === 'string') {
                                            if ((url.includes('.mpd') || url.includes('.m4s') || url.includes('.dash') || url.includes('jio')) && !url.includes('__hdnea__')) {
                                                return url + (url.includes('?') ? '&' : '?') + tokenVal;
                                            }
                                        }
                                        return url;
                                    }
                                };
                            });
                        }

                        // Configure ClearKey DRM ONLY IF valid 32-character hex keys are available
                        const rawDashKeyId = (keyId || drmKeyId || window._activeClearKeyId || (typeof urlParamsForMedia !== 'undefined' ? urlParamsForMedia.get('key_id') : '') || '').trim();
                        const rawDashKey = (key || drmKey || window._activeClearKey || (typeof urlParamsForMedia !== 'undefined' ? urlParamsForMedia.get('key') : '') || '').trim();
                        const cleanDashKeyId = rawDashKeyId.toLowerCase().replace(/[^0-9a-f]/g, '');
                        const cleanDashKey = rawDashKey.toLowerCase().replace(/[^0-9a-f]/g, '');

                        if (cleanDashKeyId.length === 32 && cleanDashKey.length === 32) {
                            console.log("[DASH Engine] Configuring ClearKey DRM protection:", cleanDashKeyId);
                            const b64KeyId = hexToBase64Url(cleanDashKeyId);
                            const b64Key = hexToBase64Url(cleanDashKey);
                            const clearkeys = {};
                            if (b64KeyId && b64Key) {
                                clearkeys[b64KeyId] = b64Key;
                            }
                            clearkeys[cleanDashKeyId] = cleanDashKey;
                            dashPlayer.setProtectionData({
                                "org.w3.clearkey": {
                                    "clearkeys": clearkeys
                                }
                            });
                        }

                        dashPlayer.initialize(video, streamUrl, true);
                        dashPlayer.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
                            console.log("[DASH Engine] Stream initialized successfully.");
                            video.style.opacity = '1';
                            hideLoadingScreen();
                            if (!player) {
                                player = new Plyr(video, {
                                    controls: ['play-large', 'rewind', 'play', 'fast-forward', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'pip', 'fullscreen'],
                                    autoplay: true,
                                    muted: false,
                                    hideControls: { enabled: true, delay: 4000 },
                                    clickToPlay: true, fullscreen: { enabled: true, fallback: true, iosNative: true }
                                });
                                window.plyrPlayer = player;
                                window.player = player;
                            }
                            triggerSafePlayback('DASH');
                            initTopControls(player);
                            initAdvancedGestures(player, video);
                            startWatchdog();
                        });
                        dashPlayer.on(dashjs.MediaPlayer.events.ERROR, (e) => {
                            console.warn("[DASH Engine Error]", e);
                            hideLoadingScreen();
                            const errDetail = e.error?.message || e.message || (typeof e.error === 'string' ? e.error : '') || '';
                            if (errDetail.toLowerCase().includes('drm') || errDetail.toLowerCase().includes('license') || streamUrl.includes('WDVLive')) {
                                showPlayerError("🔒 Widevine Encrypted Channel: This stream requires Widevine DRM credentials (no ClearKey key available). Please choose another channel or sports network.");
                            } else if (Hls.isSupported() && !streamUrl.includes('.mpd') && !isExplicitDash) {
                                loadHls(streamUrl);
                            } else {
                                showPlayerError("⚠️ Stream Notice: " + (errDetail || "Failed to decode live stream. Please try reconnecting or select another stream."));
                            }
                        });
                        window.dashPlayer = dashPlayer;
                    } catch(err) {
                        console.error("[DASH Engine Init Failed]", err);
                        if (Hls.isSupported() && !streamUrl.includes('.mpd') && !isExplicitDash) {
                            loadHls(streamUrl);
                        } else {
                            showPlayerError("⚠️ Player initialization failed: " + err.message);
                        }
                    }
                }
                if (resolvedSrc.includes('.mpd') || resolvedSrc.includes('type=dash')) {
                    isExplicitDash = true;
                }
                if (isDirectMedia) {
                    video.src = resolvedSrc;
                    video.load();
                    triggerSafePlayback('Direct-Media');
                    if (!player) {
                        player = new Plyr(video, {
                            controls: ['play-large', 'rewind', 'play', 'fast-forward', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'pip', 'download', 'fullscreen'],
                            autoplay: true,
                            muted: false,
                            hideControls: { enabled: true, delay: 4000 },
                            clickToPlay: true,
                            fullscreen: { enabled: true, fallback: true, iosNative: true }
                        });
                        window.plyrPlayer = player;
                        window.player = player;
                    }
                    video.style.opacity = '1';
                    hideLoadingScreen();
                    initTopControls(player);
                    initAdvancedGestures(player, video);
                    startWatchdog();
                } else if (isExplicitDash) {
                    if (typeof shaka !== 'undefined') {
                        loadShaka(resolvedSrc, drmKeyId, drmKey);
                    } else if (typeof dashjs !== 'undefined') {
                        loadDash(resolvedSrc, drmKeyId, drmKey);
                    }
                } else if (isExplicitTs && typeof mpegts !== 'undefined' && mpegts.isSupported()) {
                    loadMpegTs(resolvedSrc);
                } else if (Hls.isSupported() && !resolvedSrc.includes('.mpd')) {
                    loadHls(resolvedSrc);
                } else if (typeof shaka !== 'undefined') {
                    loadShaka(resolvedSrc, drmKeyId, drmKey);
                } else if (typeof dashjs !== 'undefined') {
                    loadDash(resolvedSrc, drmKeyId, drmKey);
                } else if (typeof mpegts !== 'undefined' && mpegts.isSupported()) {
                    loadMpegTs(resolvedSrc);
                } else {
                    video.src = resolvedSrc;
                    video.load();
                    triggerSafePlayback('Native-Fallback');
                }
            }

            async function resolveStreamAndInit() {
                const statusEl = document.getElementById('apple-loading-status');

                // If stream is already a direct playable HTTP URL, directly launch
                if (src && (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/live.php'))) {
                    if (statusEl) statusEl.textContent = 'Launching live stream...';
                    await initPlayer();
                    return;
                }

                // If not direct URL, resolve by channel name or ID query
                const lookupName = (name && name !== 'Live Channel' && name !== 'Live Stream') ? name : (urlParams.get('name') || urlParams.get('q') || urlParams.get('id') || urlParams.get('channel') || '');
                if (lookupName) {
                    try {
                        const res = await fetch(`/api/channels/resolve?name=${encodeURIComponent(lookupName)}`);
                        if (res.ok) {
                            const data = await res.json();
                            if (data && (data.streamUrl || data.url)) {
                                src = data.streamUrl || data.url;
                                if (data.name) name = data.name;
                                console.log('[Live Stream] Auto-resolved stream:', src);
                                await initPlayer();
                                return;
                            }
                        }
                    } catch (err) {
                        console.warn('[Live Stream] Failed to resolve channel:', err);
                    }
                }

                await initPlayer();
            }

            resolveStreamAndInit();
        });
    </script>
    <!-- Touch Gestures Overlay -->
    <div id="touchGestureOverlay" class="absolute inset-0 z-40 hidden md:block" style="touch-action: none; pointer-events: none;"></div>
    <script>
        document.addEventListener("DOMContentLoaded", () => {
            const plyrContainer = document.querySelector('.plyr') || document.getElementById('player-container');
            if(!plyrContainer) return;
        });
    </script>
    <script src="/watchdog.js" id="maintenance-watchdog"></script>
    <script src="/party-mode.js?v=7.0"></script>
    <script src="assets/local-ai.js?v=2.0"></script>
</body>
</html>
