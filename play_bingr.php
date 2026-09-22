<?php
$id = isset($_GET['id']) ? $_GET['id'] : (isset($_GET['tmdbId']) ? $_GET['tmdbId'] : '{{ID}}');
$type = isset($_GET['type']) ? $_GET['type'] : (isset($_GET['media_type']) ? $_GET['media_type'] : '{{TYPE}}');
if ($type === '{{TYPE}}' || empty($type)) $type = 'movie';
$title = isset($_GET['title']) ? $_GET['title'] : (isset($_GET['name']) ? $_GET['name'] : '{{TITLE}}');
if ($title === '{{TITLE}}' || empty($title)) $title = 'Cinema Presentation';
$s = isset($_GET['s']) ? $_GET['s'] : (isset($_GET['season']) ? $_GET['season'] : '{{SEASON}}');
if ($s === '{{SEASON}}' || empty($s)) $s = '1';
$e = isset($_GET['e']) ? $_GET['e'] : (isset($_GET['episode']) ? $_GET['episode'] : '{{EPISODE}}');
if ($e === '{{EPISODE}}' || empty($e)) $e = '1';
$srv = isset($_GET['srv']) ? $_GET['srv'] : '{{SRV}}';
if ($srv === '{{SRV}}' || empty($srv)) $srv = 's40';
$directUrl = isset($_GET['url']) ? $_GET['url'] : '{{URL}}';
if ($directUrl === '{{URL}}') $directUrl = '';
$source = isset($_GET['source']) ? $_GET['source'] : 'consumet.html';
$malId = isset($_GET['malId']) ? $_GET['malId'] : (isset($_GET['mal_id']) ? $_GET['mal_id'] : (isset($_GET['mal']) ? $_GET['mal'] : ''));
?>
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta name="robots" content="noindex">
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title><?php echo htmlspecialchars($title); ?> | Bingr 4K Cinema Player</title>
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
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest" crossorigin></script>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        :root {
            font-family: 'Plus Jakarta Sans', sans-serif;
            color-scheme: dark;
            --sub-font-size: 1.15rem;
            --sub-color: #ffffff;
            --sub-bg: rgba(0, 0, 0, 0.65);
            --sub-shadow: 0 2px 8px rgba(0, 0, 0, 0.95);
        }
        * {
            -webkit-tap-highlight-color: transparent !important;
            user-select: none;
            box-sizing: border-box;
        }
        *:focus, *:focus-visible { outline: none !important; }
        body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background-color: #000;
            color: #fff;
            overflow: hidden;
        }

        #playerContainer {
            position: relative;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000;
            transition: transform 0.3s ease;
        }

        video {
            width: 100% !important;
            height: 100% !important;
            object-fit: contain;
            transition: transform 0.3s ease, object-fit 0.3s ease;
        }
        video.fit-cover { object-fit: cover !important; }
        video.fit-fill { object-fit: fill !important; }
        video.zoom-120 { transform: scale(1.2) !important; }

        /* Subtitle Styling */
        ::cue {
            font-size: var(--sub-font-size) !important;
            color: var(--sub-color) !important;
            background-color: var(--sub-bg) !important;
            text-shadow: var(--sub-shadow) !important;
            line-height: 1.4 !important;
            border-radius: 8px !important;
            padding: 3px 8px !important;
        }

        /* Glassmorphism Classes */
        .glass-panel {
            background: rgba(10, 10, 14, 0.90);
            backdrop-filter: blur(28px) saturate(180%);
            -webkit-backdrop-filter: blur(28px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.12);
        }
        .glass-sub-panel {
            background: rgba(14, 14, 18, 0.92);
            border: 1px solid rgba(255, 255, 255, 0.12);
        }
        .glass-btn {
            background: rgba(10, 10, 14, 0.90);
            border: 1px solid rgba(255, 255, 255, 0.16);
            backdrop-filter: blur(16px);
            color: #ffffff;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .glass-btn:hover {
            background: rgba(24, 24, 30, 0.98);
            border-color: rgba(255, 255, 255, 0.35);
            color: #ffffff;
            transform: translateY(-1px);
        }
        .glass-btn:active {
            transform: scale(0.95);
        }

        /* Animated Play/Pause Button */
        .play-btn-animated {
            position: relative;
            background: #ffffff;
            color: #000000;
            border-radius: 9999px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 0 25px rgba(255, 255, 255, 0.35), 0 4px 12px rgba(0, 0, 0, 0.5);
            transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease, background-color 0.2s ease;
        }
        .play-btn-animated:hover {
            transform: scale(1.12);
            box-shadow: 0 0 35px rgba(255, 255, 255, 0.6), 0 6px 18px rgba(0, 0, 0, 0.6);
            background: #f8fafc;
        }
        .play-btn-animated:active {
            transform: scale(0.92);
        }
        .play-btn-animated::before {
            content: '';
            position: absolute;
            inset: -4px;
            border-radius: 9999px;
            background: radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 70%);
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
        }
        .play-btn-animated:hover::before {
            opacity: 1;
        }
        .icon-morph {
            transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.18s ease;
        }

        /* Timeline Scrubber */
        .timeline-container {
            position: relative;
            height: 24px;
            display: flex;
            align-items: center;
            cursor: pointer;
            touch-action: none;
        }
        .timeline-track {
            position: relative;
            width: 100%;
            height: 4px;
            background: rgba(255, 255, 255, 0.18);
            border-radius: 9999px;
            transition: height 0.15s ease;
        }
        .timeline-container:hover .timeline-track,
        .timeline-container.is-scrubbing .timeline-track {
            height: 7px;
        }
        .timeline-buffer {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.35);
            border-radius: 9999px;
            width: 0%;
            pointer-events: none;
        }
        .timeline-progress {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            background: linear-gradient(90deg, #dc2626, #ef4444);
            border-radius: 9999px;
            width: 0%;
            pointer-events: none;
            box-shadow: 0 0 14px rgba(239, 68, 68, 0.6);
        }
        .timeline-thumb {
            position: absolute;
            top: 50%;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #ffffff;
            border: 2px solid #ef4444;
            transform: translate(-50%, -50%) scale(0);
            transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease;
            pointer-events: none;
            box-shadow: 0 0 14px rgba(239, 68, 68, 0.95);
        }
        .timeline-container:hover .timeline-thumb,
        .timeline-container.is-scrubbing .timeline-thumb {
            transform: translate(-50%, -50%) scale(1.35);
        }

        /* Touch & Mobile Scrubber Polish */
        @media (max-width: 640px), (pointer: coarse) {
            .timeline-thumb {
                transform: translate(-50%, -50%) scale(1) !important;
                width: 16px !important;
                height: 16px !important;
            }
            .timeline-track {
                height: 6px !important;
            }
            .timeline-container {
                height: 38px !important;
            }
        }

        /* Mobile Slide-Up Animations & Touch Ripples */
        @keyframes slideUpSheet {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
            animation: slideUpSheet 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .double-tap-ripple {
            position: absolute;
            top: 50%;
            width: 90px;
            height: 90px;
            border-radius: 9999px;
            background: radial-gradient(circle, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 75%);
            pointer-events: none;
            animation: ripplePop 0.5s ease-out forwards;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 40;
            backdrop-filter: blur(8px);
        }
        @keyframes ripplePop {
            0% { opacity: 0; transform: translateY(-50%) scale(0.6); }
            45% { opacity: 1; transform: translateY(-50%) scale(1.15); }
            100% { opacity: 0; transform: translateY(-50%) scale(1.4); }
        }

        /* Volume Slider */
        .volume-slider-track {
            -webkit-appearance: none;
            appearance: none;
            height: 4px;
            border-radius: 9999px;
            background: rgba(255, 255, 255, 0.25);
            outline: none;
            cursor: pointer;
        }
        .volume-slider-track::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #ffffff;
            border: 1px solid #ef4444;
            cursor: pointer;
        }
        .volume-slider-track::-moz-range-thumb {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #ffffff;
            border: 1px solid #ef4444;
            cursor: pointer;
        }

        /* Toast HUD Indicator */
        #zoom-indicator {
            position: absolute;
            top: 5.5rem;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(10, 10, 14, 0.65);
            color: #fff;
            padding: 0.55rem 1.4rem;
            border-radius: 9999px;
            font-size: 0.825rem;
            font-weight: 700;
            border: 1px solid rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(28px);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s;
            z-index: 10000;
        }

        /* Floating Sleep Badge */
        #sleep-indicator {
            position: absolute;
            top: 5.5rem;
            right: 1.5rem;
            background: rgba(10, 10, 14, 0.65);
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
            backdrop-filter: blur(20px);
        }

        /* Skip Intro & Next Episode Pills */
        .apple-skip-btn {
            position: absolute;
            z-index: 9999;
            display: none;
            align-items: center;
            gap: 8px;
            background: rgba(10, 10, 14, 0.75);
            border: 1px solid rgba(255, 255, 255, 0.25);
            color: #ffffff;
            padding: 10px 22px;
            border-radius: 9999px;
            font-weight: 800;
            font-size: 13px;
            cursor: pointer;
            backdrop-filter: blur(25px);
            box-shadow: 0 12px 35px rgba(0, 0, 0, 0.65);
            transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s, box-shadow 0.2s;
        }
        .apple-skip-btn.show {
            display: flex !important;
        }
        .apple-skip-btn:hover {
            transform: scale(1.05);
            background: rgba(255, 255, 255, 0.18);
            border-color: rgba(255, 255, 255, 0.45);
        }
        .apple-skip-btn:active {
            transform: scale(0.97);
        }

        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.35); }

        .no-scrollbar::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
        .no-scrollbar { -ms-overflow-style: none !important; scrollbar-width: none !important; }
        
        .animate-fade-in { animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.98); }
            to { opacity: 1; transform: scale(1); }
        }

        /* Center Burst Expansion */
        @keyframes burstPulse {
            0% { transform: scale(0.65); opacity: 0; }
            50% { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(1); opacity: 0.95; }
        }
        .burst-active {
            animation: burstPulse 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
    </style>
    <style>
        body.embed-active .hide-in-embed {
            display: none !important;
        }
        body.embed-active #mediaHudOverlay,
        body.embed-active .media-hud-overlay,
        body.embed-active #hudLogoContainer,
        body.embed-active #hudTitleText,
        body.embed-active #hudOverview,
        body.embed-active #centerPlayBurst {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
            animation: none !important;
            pointer-events: none !important;
        }
    </style>
</head>
<body class="bg-black text-white relative w-screen h-screen overflow-hidden select-none">

    <!-- Toast Indicator -->
    <div id="zoom-indicator">Fit to Screen</div>

    <!-- Sleep Timer Floating Badge -->
    <div id="sleep-indicator">
        <i data-lucide="clock" class="w-3.5 h-3.5 animate-pulse"></i>
        <span id="sleep-time">00:00</span>
    </div>

    <!-- Main Player Canvas -->
    <div id="playerContainer" class="relative w-full h-full flex items-center justify-center bg-black">
        <video id="mainVideo" class="w-full h-full object-contain cursor-pointer" playsinline preload="auto" crossorigin="anonymous"></video>
        
        <!-- Fallback Embed Iframe -->
        <iframe id="embedFrame" class="w-full h-full border-0 hidden" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="origin"></iframe>

        <!-- Embed Touch Sensor (For showing controls over iframe) -->
        <div id="embedTouchSensor" class="absolute inset-0 z-20 hidden" onmousemove="resetControlsTimer()" ontouchstart="resetControlsTimer()" onclick="resetControlsTimer()"></div>

        <!-- High-Precision Custom Subtitle Overlay Layer -->
        <div id="customSubtitleOverlay" class="absolute inset-x-0 bottom-12 sm:bottom-16 md:bottom-20 z-25 pointer-events-none flex flex-col items-center justify-end px-4 text-center select-none transition-all duration-100">
            <div id="customSubtitleText" class="inline-block py-1.5 px-4 rounded-xl max-w-[94%] sm:max-w-[85%] md:max-w-[75%] font-semibold tracking-wide leading-snug transition-all duration-150 hidden shadow-2xl" style="font-size: var(--sub-font-size, 1.15rem); color: var(--sub-color, #ffffff); background-color: var(--sub-bg, rgba(0,0,0,0.55)); text-shadow: var(--sub-shadow, 1px 1px 2px black, 0 0 1em black);"></div>
        </div>

        <!-- Loading Spinner -->
        <div id="streamLoading" class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xl transition-opacity duration-300">
            <div class="relative flex items-center justify-center">
                <div class="w-14 h-14 rounded-full border-3 border-white/10 border-t-red-500 animate-spin"></div>
                <i data-lucide="play" class="w-5 h-5 text-red-500 absolute fill-current"></i>
            </div>
            <p id="streamLoadingMsg" class="mt-4 text-xs font-bold tracking-widest uppercase text-zinc-300">Connecting to Stream...</p>
            <span id="streamLoadingSub" class="text-[10px] text-zinc-500 mt-1">Cascading high-speed CDN clusters</span>
        </div>

        <!-- Center Play/Pause / Rewind / Forward Animated Burst -->
        <div id="centerPlayBurst" class="absolute z-20 w-20 h-20 rounded-full glass-panel flex items-center justify-center text-white opacity-0 pointer-events-none transition-all duration-300 transform scale-75 shadow-2xl">
            <i id="centerBurstIcon" data-lucide="play" class="w-10 h-10 ml-1"></i>
        </div>

        <!-- MOBILE DOUBLE-TAP RIPPLE INDICATORS -->
        <div id="seekRippleLeft" class="absolute left-6 sm:left-12 top-1/2 -translate-y-1/2 z-30 pointer-events-none opacity-0 flex flex-col items-center gap-1 transition-opacity duration-200">
            <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-xl">
                <i data-lucide="rotate-ccw" class="w-7 h-7"></i>
            </div>
            <span class="text-xs font-black tracking-wider text-white bg-black/60 px-2.5 py-0.5 rounded-full">-10s</span>
        </div>
        <div id="seekRippleRight" class="absolute right-6 sm:right-12 top-1/2 -translate-y-1/2 z-30 pointer-events-none opacity-0 flex flex-col items-center gap-1 transition-opacity duration-200">
            <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-xl">
                <i data-lucide="rotate-cw" class="w-7 h-7"></i>
            </div>
            <span class="text-xs font-black tracking-wider text-white bg-black/60 px-2.5 py-0.5 rounded-full">+10s</span>
        </div>

        <!-- MOBILE VERTICAL SWIPE HUD (BRIGHTNESS / VOLUME) -->
        <div id="swipeHud" class="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-35 pointer-events-none opacity-0 flex items-center gap-3 glass-panel px-4 py-3 rounded-2xl shadow-2xl transition-opacity duration-200">
            <i id="swipeHudIcon" data-lucide="volume-2" class="w-6 h-6 text-white"></i>
            <div class="w-32 h-2 bg-white/20 rounded-full overflow-hidden">
                <div id="swipeHudBar" class="h-full bg-red-500 rounded-full transition-all duration-75" style="width: 50%;"></div>
            </div>
            <span id="swipeHudPercent" class="text-xs font-mono font-bold text-white min-w-[32px] text-right">50%</span>
        </div>

        <!-- MEDIA HUD OVERLAY (ON PAUSE / INITIAL LOAD) -->
        <div id="mediaHudOverlay" class="absolute inset-0 z-20 pointer-events-none transition-opacity duration-500 bg-gradient-to-t from-black/90 via-black/35 to-black/60 flex flex-col justify-between p-6 sm:p-10 lg:p-14 opacity-100">
            <div class="h-16"></div>

            <div class="max-w-2xl space-y-3 pointer-events-auto pb-16">
                <!-- TMDB Stylized Logo Image or Title -->
                <div id="hudLogoContainer" class="min-h-[50px] flex items-end">
                    <img id="hudLogoImg" src="" alt="Title Logo" class="max-h-24 sm:max-h-28 max-w-[280px] sm:max-w-[380px] object-contain hidden filter drop-shadow-[0_10px_25px_rgba(0,0,0,0.9)]">
                    <h1 id="hudTitleText" class="text-3xl sm:text-4xl lg:text-5xl font-black text-white uppercase tracking-tight drop-shadow-lg leading-none">
                        <?php echo htmlspecialchars($title); ?>
                    </h1>
                </div>

                <!-- Metadata Row: Year • Runtime • Rating • Certification • Badges -->
                <div class="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-zinc-300 flex-wrap">
                    <span id="hudYear" class="px-2 py-0.5 rounded-lg glass-sub-panel text-white">2024</span>
                    <span class="text-zinc-500">&bull;</span>
                    <span id="hudRuntime">1h 55m</span>
                    <span class="text-zinc-500">&bull;</span>
                    <span id="hudRating" class="px-2 py-0.5 rounded-lg bg-amber-400/10 border border-amber-400/25 text-amber-300 font-extrabold text-[11px] sm:text-xs">
                        7.8 / 10
                    </span>
                    <span class="text-zinc-500">&bull;</span>
                    <span id="hudCert" class="px-2 py-0.5 rounded-lg glass-sub-panel text-[10px] uppercase font-bold text-zinc-400">PG-13</span>
                    <span class="text-zinc-500">&bull;</span>
                    <span id="hudClusterBadge" class="px-2 py-0.5 rounded-lg bg-red-600/20 border border-red-500/30 text-red-300 text-[10px] font-black uppercase tracking-wider">Bingr 4K Master</span>
                </div>

                <!-- Synopsis Text Paragraph -->
                <p id="hudOverview" class="text-xs sm:text-sm text-zinc-300/90 leading-relaxed line-clamp-3 sm:line-clamp-4 drop-shadow">
                    Loading media overview and synopsis from databanks...
                </p>
            </div>
        </div>

        <!-- TOP CONTROLS BAR -->
        <div id="topControlsBar" class="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-3 sm:p-6 bg-gradient-to-b from-black/80 via-black/30 to-transparent transition-opacity duration-300">
            <!-- Left Controls: Back + Title Pill -->
            <div class="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1 sm:flex-initial">
                <button id="btnBack" onclick="handleGoBack()" class="w-9 h-9 sm:w-10 sm:h-10 rounded-full glass-btn hover:bg-red-600 hover:border-red-500/50 flex items-center justify-center text-white shrink-0 shadow-lg cursor-pointer" title="Back">
                    <i data-lucide="arrow-left" class="w-4 h-4 sm:w-5 sm:h-5"></i>
                </button>
                <div class="flex flex-col min-w-0">
                    <h2 id="topBarTitle" class="text-xs sm:text-base font-bold text-white truncate drop-shadow max-w-[170px] xs:max-w-[240px] sm:max-w-md">
                        <?php echo htmlspecialchars($title); ?>
                    </h2>
                    <span id="topBarSub" class="text-[9px] sm:text-[10px] text-zinc-400 font-semibold tracking-wider uppercase truncate">
                        <?php echo $type === 'tv' ? "Season {$s} &bull; Episode {$e}" : "Cinema Movie Presentation"; ?>
                    </span>
                </div>
            </div>

            <!-- Mobile Quick Actions Cluster (sm:hidden) -->
            <div class="flex sm:hidden items-center gap-1.5 shrink-0 ml-2">
                <!-- Audio & Subs Pill -->
                <button onclick="openSubtitlesModalTab()" class="px-2.5 py-1.5 rounded-xl glass-btn text-xs font-bold flex items-center gap-1.5 shrink-0 active:scale-90 cursor-pointer shadow-lg" title="Audio Dubs & Subtitles">
                    <i data-lucide="languages" class="w-3.5 h-3.5 text-zinc-300"></i>
                    <span class="text-[11px]">CC</span>
                </button>
                <!-- Quality & Server Pill -->
                <button id="btnOpenQualityServerMob" onclick="toggleQualityServerModal()" class="px-2.5 py-1.5 rounded-xl bg-black/90 border border-white/20 text-xs font-bold flex items-center gap-1.5 shrink-0 active:scale-90 cursor-pointer shadow-lg" title="Quality & Servers">
                    <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    <span id="qualityButtonLabelMob" class="text-[11px] font-mono">1080p</span>
                </button>
                <!-- Mobile Quick Settings Button -->
                <button onclick="toggleMobileMoreMenu()" class="w-9 h-9 rounded-xl glass-btn flex items-center justify-center text-zinc-300 hover:text-white shadow-lg shrink-0 active:scale-90 cursor-pointer" title="Player Quick Settings">
                    <i data-lucide="sliders-horizontal" class="w-4 h-4"></i>
                </button>
            </div>

            <!-- Desktop Right Controls (hidden on mobile, visible on sm and up) -->
            <div class="hidden sm:flex items-center gap-2.5 min-w-0 justify-end">
                <!-- Reconnect Stream Button -->
                <button onclick="triggerAutoReconnect()" class="hide-in-embed w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass-btn flex items-center justify-center text-zinc-300 hover:text-white shadow-lg cursor-pointer shrink-0" title="Reconnect Stream">
                    <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
                </button>

                <!-- Aspect Ratio Button -->
                <button onclick="toggleAspectRatio()" class="hide-in-embed w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass-btn flex items-center justify-center text-zinc-300 hover:text-white shadow-lg cursor-pointer shrink-0" title="Toggle Aspect Ratio">
                    <i data-lucide="maximize-2" class="w-4 h-4"></i>
                </button>

                <!-- Rotate View Button -->
                <button onclick="toggleRotation()" class="hide-in-embed w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass-btn flex items-center justify-center text-zinc-300 hover:text-white shadow-lg cursor-pointer shrink-0" title="Rotate Player">
                    <i data-lucide="smartphone" class="w-4 h-4"></i>
                </button>

                <!-- Sleep Timer Button -->
                <button onclick="toggleSleepModal()" class="hide-in-embed w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass-btn flex items-center justify-center text-zinc-300 hover:text-white shadow-lg cursor-pointer shrink-0" title="Sleep Timer">
                    <i data-lucide="clock" class="w-4 h-4"></i>
                </button>

                <!-- TV Episodes Drawer Toggle (If Series) -->
                <button id="btnEpisodesDrawer" onclick="toggleEpisodesDrawer()" class="hidden px-3 py-2 rounded-xl bg-black/90 hover:bg-zinc-900 border border-white/20 hover:border-white/40 text-xs font-bold text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shrink-0" title="Episodes Picker">
                    <i data-lucide="list-video" class="w-3.5 h-3.5 text-zinc-300"></i>
                    <span>Episodes</span>
                </button>

                <!-- Watch Together (Party Mode) Button -->
                <button onclick="togglePartyMode()" class="hide-in-embed px-3 py-2 rounded-xl bg-black/90 hover:bg-zinc-900 border border-white/20 hover:border-white/40 text-xs font-bold text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shrink-0" title="Watch Together (Party Mode)">
                    <i data-lucide="users" class="w-3.5 h-3.5 text-zinc-300"></i>
                    <span>Party</span>
                </button>

                <!-- Quality & Server Button -->
                <button id="btnOpenQualityServer" onclick="toggleQualityServerModal()" class="px-3 py-2 rounded-xl bg-black/90 hover:bg-zinc-900 border border-white/20 hover:border-white/40 text-xs font-bold text-white flex items-center gap-2 cursor-pointer shadow-lg shrink-0" title="Quality & Servers">
                    <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    <span id="qualityButtonLabel" class="hidden xs:inline">Auto &bull; 1080p</span>
                    <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-zinc-400"></i>
                </button>

                <!-- Direct Mode Switch Button (Visible when embedded) -->
                <button id="btnSwitchToDirect" onclick="switchPlayerMode('direct', '', true)" class="hidden px-3.5 py-2 rounded-xl bg-black/90 hover:bg-zinc-900 border border-white/25 hover:border-white/50 text-xs font-bold text-white flex items-center gap-1.5 shadow-xl cursor-pointer transition-all active:scale-95 shrink-0" title="Switch to Direct Native Stream">
                    <i data-lucide="play-circle" class="w-4 h-4 text-white"></i>
                    <span>Direct Player</span>
                </button>

                <!-- Audio Dubs Button -->
                <button id="btnOpenAudio" onclick="openAudioModalTab()" class="hide-in-embed px-3 py-2 rounded-xl glass-btn text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-lg shrink-0" title="Audio Dubs & Multi-Language Tracks">
                    <i data-lucide="volume-2" class="w-3.5 h-3.5 text-emerald-400"></i>
                    <span id="topBarAudioLabel">Audio</span>
                </button>

                <!-- Subtitles Button -->
                <button id="btnOpenSubtitles" onclick="openSubtitlesModalTab()" class="hide-in-embed px-3 py-2 rounded-xl glass-btn text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-lg shrink-0" title="Subtitles & Closed Captions">
                    <i data-lucide="languages" class="w-3.5 h-3.5 text-zinc-300"></i>
                    <span>Subtitles</span>
                </button>

                <!-- AniSkip (MAL ID) Button -->
                <button id="btnOpenAniSkip" onclick="toggleAniSkipModal()" class="hide-in-embed px-3 py-2 rounded-xl glass-btn text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-lg hover:border-amber-400/40 transition-all shrink-0" title="AniSkip Anime Intro & Outro Timestamps">
                    <i data-lucide="zap" class="w-3.5 h-3.5 text-amber-400"></i>
                    <span id="topBarAniSkipLabel">AniSkip</span>
                    <span id="aniSkipBadge" class="hidden px-1.5 py-0.5 text-[9px] rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 font-extrabold">OP/ED</span>
                </button>
            </div>
        </div>

        <!-- BOTTOM CONTROLS BAR -->
        <div id="bottomControlsBar" class="absolute bottom-0 left-0 right-0 z-30 flex flex-col p-3 sm:p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 gap-1.5 sm:gap-2">
            <!-- Timeline Scrubber -->
            <div id="timelineContainer" class="timeline-container w-full">
                <div class="timeline-track relative">
                    <div id="timelineBuffer" class="timeline-buffer"></div>
                    <div id="timelineProgress" class="timeline-progress"></div>
                    <!-- AniSkip Scrubber Interval Markers -->
                    <div id="timelineOpMarker" class="absolute top-0 bottom-0 bg-amber-400/75 border-x border-amber-200 pointer-events-none hidden z-10" title="Opening (OP)"></div>
                    <div id="timelineEdMarker" class="absolute top-0 bottom-0 bg-purple-400/75 border-x border-purple-200 pointer-events-none hidden z-10" title="Ending (ED)"></div>
                    <div id="timelineRecapMarker" class="absolute top-0 bottom-0 bg-sky-400/75 border-x border-sky-200 pointer-events-none hidden z-10" title="Recap"></div>
                    <div id="timelineThumb" class="timeline-thumb"></div>
                </div>
                <div id="timelineTooltip" class="absolute -top-7 px-2 py-0.5 rounded-lg glass-panel text-[10px] font-mono text-white pointer-events-none opacity-0 transition-opacity">0:00</div>
            </div>

            <!-- Mobile Bottom Controls Layout (sm:hidden) -->
            <div class="flex sm:hidden items-center justify-between w-full pt-1">
                <!-- Left: Time + Mute -->
                <div class="flex items-center gap-1 min-w-0">
                    <button id="btnMuteMob" onclick="toggleMute()" class="p-2 text-zinc-300 hover:text-white transition-colors cursor-pointer active:scale-90" title="Mute/Unmute">
                        <i id="volumeIconMob" data-lucide="volume-2" class="w-4 h-4"></i>
                    </button>
                    <div class="text-[11px] font-mono text-zinc-300 tracking-tight whitespace-nowrap">
                        <span id="timeCurrentMob">0:00</span> <span class="text-zinc-600">/</span> <span id="timeDurationMob">0:00</span>
                    </div>
                </div>

                <!-- Center: Rewind 10, Big Animated Play/Pause, Forward 10 -->
                <div class="flex items-center gap-1.5">
                    <button onclick="seekRelative(-10)" class="w-10 h-10 rounded-full flex items-center justify-center text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-90" title="Rewind 10s">
                        <span class="text-xs font-extrabold">&laquo; 10</span>
                    </button>
                    <button id="btnPlayPauseMob" onclick="togglePlayPause()" class="w-11 h-11 play-btn-animated active:scale-90 flex items-center justify-center shadow-xl" title="Play/Pause">
                        <i id="playIconMob" data-lucide="play" class="w-5 h-5 ml-0.5 fill-current icon-morph"></i>
                        <i id="pauseIconMob" data-lucide="pause" class="w-5 h-5 hidden fill-current icon-morph"></i>
                    </button>
                    <button onclick="seekRelative(10)" class="w-10 h-10 rounded-full flex items-center justify-center text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-90" title="Forward 10s">
                        <span class="text-xs font-extrabold">10 &raquo;</span>
                    </button>
                </div>

                <!-- Right: More Like This + Fullscreen -->
                <div class="flex items-center gap-0.5">
                    <button onclick="toggleMoreLikeThisDrawer()" class="p-2 text-amber-400 hover:text-amber-300 transition-all cursor-pointer active:scale-90" title="More Like This">
                        <i data-lucide="sparkles" class="w-4 h-4"></i>
                    </button>
                    <button id="btnFullscreenMob" onclick="toggleFullscreen()" class="p-2 text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-90" title="Fullscreen">
                        <i id="fullscreenIconMob" data-lucide="maximize" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>

            <!-- Desktop Bottom Controls Layout (hidden on mobile, flex on sm and up) -->
            <div class="hidden sm:flex items-center justify-between w-full pt-1">
                <!-- Left: Rewind, Animated Play/Pause, Fast Forward, Volume -->
                <div class="flex items-center gap-4 shrink-0">
                    <button onclick="seekRelative(-10)" class="p-2 text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-90 hover:scale-110 shrink-0" title="Rewind 10s">
                        <span class="text-xs font-extrabold flex items-center gap-0.5">&laquo; 10</span>
                    </button>

                    <!-- ANIMATED PLAY / PAUSE BUTTON -->
                    <button id="btnPlayPause" onclick="togglePlayPause()" class="w-12 h-12 play-btn-animated group shrink-0" title="Play/Pause">
                        <i id="playIcon" data-lucide="play" class="w-5 h-5 ml-0.5 fill-current icon-morph"></i>
                        <i id="pauseIcon" data-lucide="pause" class="w-5 h-5 hidden fill-current icon-morph"></i>
                    </button>

                    <button onclick="seekRelative(10)" class="p-2 text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-90 hover:scale-110 shrink-0" title="Forward 10s">
                        <span class="text-xs font-extrabold flex items-center gap-0.5">10 &raquo;</span>
                    </button>

                    <div class="flex items-center gap-2 group shrink-0">
                        <button id="btnMute" onclick="toggleMute()" class="text-zinc-300 hover:text-white transition-colors cursor-pointer p-1" title="Mute/Unmute">
                            <i id="volumeIcon" data-lucide="volume-2" class="w-5 h-5"></i>
                        </button>
                        <input id="volumeSlider" type="range" min="0" max="1" step="0.05" value="1" oninput="setVolume(this.value)" class="volume-slider-track w-20 transition-all">
                    </div>
                </div>

                <!-- Center: More Like This Drawer Toggle -->
                <div class="flex items-center shrink-0 px-1">
                    <button id="btnToggleMoreLikeThis" onclick="toggleMoreLikeThisDrawer()" class="px-4 py-2 rounded-full glass-btn text-xs font-bold text-zinc-200 hover:text-white flex items-center gap-2 cursor-pointer shadow-lg group shrink-0">
                        <span class="w-2 h-2 rounded-full bg-amber-400 group-hover:scale-125 transition-transform"></span>
                        <span class="truncate">More Like This</span>
                        <i id="moreLikeThisChevron" data-lucide="chevron-up" class="w-3.5 h-3.5 transition-transform duration-300"></i>
                    </button>
                </div>

                <!-- Right: Direct | Embed Mode, Time, PiP & Fullscreen -->
                <div class="flex items-center gap-3 shrink-0">
                    <div class="flex items-center p-0.5 rounded-xl glass-sub-panel text-[10px] font-bold text-zinc-400">
                        <button id="btnModeDirect" onclick="switchPlayerMode('direct')" class="px-2.5 py-1 rounded-lg bg-white text-black font-extrabold transition-all shadow">DIRECT</button>
                        <button id="btnModeEmbed" onclick="switchPlayerMode('embed', 'vidlink_pro', true)" class="px-2.5 py-1 rounded-lg text-zinc-400 hover:text-white transition-all">EMBED</button>
                    </div>

                    <div class="text-[11px] font-mono text-zinc-300 tracking-wider shrink-0 whitespace-nowrap">
                        <span id="timeCurrent">0:00</span> <span class="text-zinc-600">/</span> <span id="timeDuration">0:00</span>
                    </div>

                    <button id="party-mode-btn" onclick="if (typeof window.togglePartyModal === 'function') window.togglePartyModal(true)" class="p-1.5 text-pink-400 hover:text-pink-300 transition-all cursor-pointer active:scale-90 shrink-0" title="Watch Together (Party Mode)"><i data-lucide="users" class="w-4 h-4"></i></button>
                    <button id="btnPip" onclick="togglePiP()" class="p-1.5 text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-90 hidden xs:block shrink-0" title="Picture-in-Picture">
                        <i data-lucide="picture-in-picture-2" class="w-4 h-4"></i>
                    </button>

                    <button id="btnFullscreen" onclick="toggleFullscreen()" class="p-1.5 text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-90 shrink-0" title="Fullscreen">
                        <i id="fullscreenIcon" data-lucide="maximize" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        </div>

        <!-- FLOATING SKIP INTRO & NEXT EPISODE PILLS -->
        <button id="btnSkipIntro" onclick="skipIntro()" class="apple-skip-btn bottom-24 right-6 bg-black/90 hover:bg-zinc-900 border border-white/20 hover:border-white/40 text-white font-bold items-center gap-2" title="Skip Segment (Key: S)">
            <i id="skipIntroIcon" data-lucide="fast-forward" class="w-4 h-4 text-amber-400"></i>
            <span id="skipIntroText">Skip Intro</span>
        </button>

        <button id="btnNextEpisode" onclick="playNextEpisode()" class="apple-skip-btn bottom-36 right-6 bg-black/90 hover:bg-zinc-900 border border-white/20 hover:border-white/40 text-white font-bold" title="Next Episode (Key: N)">
            <i data-lucide="skip-forward" class="w-4 h-4 text-zinc-300"></i>
            <span>Next Episode</span>
        </button>

        <!-- MOBILE QUICK SETTINGS SHEET -->
        <div id="mobileMoreMenuSheet" class="fixed inset-x-0 bottom-0 z-50 glass-panel rounded-t-3xl p-5 shadow-2xl border-t border-white/20 hidden animate-slide-up text-white max-h-[85vh] overflow-y-auto pb-8">
            <div class="w-12 h-1 bg-white/25 rounded-full mx-auto mb-4"></div>
            <div class="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                <span class="text-xs font-extrabold uppercase tracking-widest text-zinc-300 flex items-center gap-2">
                    <i data-lucide="sliders" class="w-4 h-4 text-red-500"></i>
                    Quick Player Settings
                </span>
                <button onclick="toggleMobileMoreMenu(false)" class="p-1 text-zinc-400 hover:text-white cursor-pointer active:scale-90">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
            <div class="grid grid-cols-2 gap-2.5">
                <!-- Aspect Ratio -->
                <button onclick="toggleAspectRatio(); updateMobileStatusBadges();" class="p-3 rounded-2xl glass-sub-panel flex flex-col items-start gap-1 hover:border-white/30 text-left active:scale-95 transition-all cursor-pointer">
                    <div class="flex items-center justify-between w-full text-zinc-400">
                        <i data-lucide="maximize-2" class="w-4 h-4 text-sky-400"></i>
                        <span id="mobAspectBadge" class="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white font-mono">Fit</span>
                    </div>
                    <span class="text-xs font-bold text-white mt-1">Aspect Ratio</span>
                    <span class="text-[10px] text-zinc-400">Fit, Cover, Zoom</span>
                </button>
                <!-- Rotate Screen -->
                <button onclick="toggleRotation(); updateMobileStatusBadges();" class="p-3 rounded-2xl glass-sub-panel flex flex-col items-start gap-1 hover:border-white/30 text-left active:scale-95 transition-all cursor-pointer">
                    <div class="flex items-center justify-between w-full text-zinc-400">
                        <i data-lucide="smartphone" class="w-4 h-4 text-emerald-400"></i>
                        <span id="mobRotateBadge" class="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white font-mono">0°</span>
                    </div>
                    <span class="text-xs font-bold text-white mt-1">Orientation</span>
                    <span class="text-[10px] text-zinc-400">Rotate Screen</span>
                </button>
                <!-- Sleep Timer -->
                <button onclick="toggleMobileMoreMenu(false); toggleSleepModal();" class="p-3 rounded-2xl glass-sub-panel flex flex-col items-start gap-1 hover:border-white/30 text-left active:scale-95 transition-all cursor-pointer">
                    <div class="flex items-center justify-between w-full text-zinc-400">
                        <i data-lucide="clock" class="w-4 h-4 text-purple-400"></i>
                        <span id="mobSleepBadge" class="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white font-mono">Off</span>
                    </div>
                    <span class="text-xs font-bold text-white mt-1">Sleep Timer</span>
                    <span class="text-[10px] text-zinc-400">Auto shut-off</span>
                </button>
                <!-- Episodes Drawer (if series) -->
                <button id="mobBtnEpisodes" onclick="toggleMobileMoreMenu(false); toggleEpisodesDrawer();" class="p-3 rounded-2xl glass-sub-panel flex flex-col items-start gap-1 hover:border-white/30 text-left active:scale-95 transition-all cursor-pointer">
                    <div class="flex items-center justify-between w-full text-zinc-400">
                        <i data-lucide="list-video" class="w-4 h-4 text-amber-400"></i>
                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">List</span>
                    </div>
                    <span class="text-xs font-bold text-white mt-1">Episodes</span>
                    <span class="text-[10px] text-zinc-400">Select episode</span>
                </button>
                <!-- Party Mode -->
                <button onclick="toggleMobileMoreMenu(false); togglePartyMode();" class="p-3 rounded-2xl glass-sub-panel flex flex-col items-start gap-1 hover:border-white/30 text-left active:scale-95 transition-all cursor-pointer">
                    <div class="flex items-center justify-between w-full text-zinc-400">
                        <i data-lucide="users" class="w-4 h-4 text-pink-400"></i>
                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 font-bold">Party</span>
                    </div>
                    <span class="text-xs font-bold text-white mt-1">Watch Party</span>
                    <span class="text-[10px] text-zinc-400">Watch together</span>
                </button>
                <!-- AniSkip -->
                <button onclick="toggleMobileMoreMenu(false); toggleAniSkipModal();" class="p-3 rounded-2xl glass-sub-panel flex flex-col items-start gap-1 hover:border-white/30 text-left active:scale-95 transition-all cursor-pointer">
                    <div class="flex items-center justify-between w-full text-zinc-400">
                        <i data-lucide="zap" class="w-4 h-4 text-amber-400"></i>
                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">OP/ED</span>
                    </div>
                    <span class="text-xs font-bold text-white mt-1">AniSkip Engine</span>
                    <span class="text-[10px] text-zinc-400">Anime intro skip</span>
                </button>
                <!-- Reconnect -->
                <button onclick="toggleMobileMoreMenu(false); triggerAutoReconnect();" class="p-3 rounded-2xl glass-sub-panel flex flex-col items-start gap-1 hover:border-white/30 text-left active:scale-95 transition-all cursor-pointer col-span-2">
                    <div class="flex items-center justify-between w-full text-zinc-400">
                        <i data-lucide="rotate-ccw" class="w-4 h-4 text-rose-400"></i>
                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-400 font-mono">Reload</span>
                    </div>
                    <span class="text-xs font-bold text-white mt-1">Reconnect Stream</span>
                    <span class="text-[10px] text-zinc-400">Refresh and re-establish video feed</span>
                </button>
            </div>
            <!-- Playback Speed Row -->
            <div class="mt-4 pt-3 border-t border-white/10">
                <div class="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mb-2">PLAYBACK SPEED</div>
                <div class="grid grid-cols-6 gap-1">
                    <button onclick="setPlaybackSpeed(0.5, this)" class="speed-btn py-1.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-white glass-sub-panel">0.5x</button>
                    <button onclick="setPlaybackSpeed(0.75, this)" class="speed-btn py-1.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-white glass-sub-panel">0.75x</button>
                    <button onclick="setPlaybackSpeed(1, this)" class="speed-btn py-1.5 rounded-lg text-xs font-bold bg-white text-black font-extrabold">1x</button>
                    <button onclick="setPlaybackSpeed(1.25, this)" class="speed-btn py-1.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-white glass-sub-panel">1.25x</button>
                    <button onclick="setPlaybackSpeed(1.5, this)" class="speed-btn py-1.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-white glass-sub-panel">1.5x</button>
                    <button onclick="setPlaybackSpeed(2, this)" class="speed-btn py-1.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-white glass-sub-panel">2x</button>
                </div>
            </div>
        </div>

        <!-- MOBILE MODAL BACKDROP -->
        <div id="mobileModalBackdrop" onclick="closeAllOpenModals()" class="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 hidden transition-opacity"></div>

        <!-- DUAL-COLUMN QUALITY & SERVER DRAWER MODAL (TRANSPARENT GLASS) -->
        <div id="qualityServerModal" class="fixed sm:absolute inset-x-0 bottom-0 sm:bottom-auto sm:inset-auto sm:top-16 sm:right-6 lg:right-10 z-50 sm:z-40 hidden animate-fade-in w-full sm:w-[480px] max-h-[85vh] sm:max-h-[80vh] overflow-y-auto glass-panel rounded-t-3xl sm:rounded-2xl p-4 sm:p-5 shadow-[0_25px_60px_rgba(0,0,0,0.95)] text-white pb-8 sm:pb-5">
            <div class="w-12 h-1 bg-white/20 rounded-full mx-auto mb-3 sm:hidden"></div>
            <div class="flex items-center justify-between pb-3 border-b border-white/10">
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                    <span class="text-xs font-extrabold uppercase tracking-widest text-zinc-300">Stream Configuration</span>
                </div>
                <button onclick="toggleQualityServerModal(false)" class="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <!-- Two Columns: QUALITY (Left) & SERVER (Right) -->
            <div class="grid grid-cols-2 gap-3 sm:gap-4 py-3">
                <div class="space-y-1">
                    <div class="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1 px-1">QUALITY</div>
                    <div class="px-2.5 py-1.5 mb-2 rounded-xl glass-sub-panel text-[10px] font-bold text-amber-400 flex items-center justify-between">
                        <span>4K / UHD Master</span>
                        <span class="px-1.5 py-0.5 rounded bg-amber-400/20 text-[9px] font-black">HLS</span>
                    </div>
                    <div id="qualityList" class="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                        <button onclick="setQualityLevel(-1)" id="quality-btn-auto" class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold text-left glass-sub-panel bg-white/15 text-white">
                            <span>Auto (Adaptive)</span>
                            <i data-lucide="check" class="w-3.5 h-3.5 text-white"></i>
                        </button>
                    </div>
                </div>

                <div class="space-y-1 border-l border-white/10 pl-3">
                    <div class="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1 px-1">SERVER CLUSTER</div>
                    <div id="serverList" class="space-y-1 max-h-48 overflow-y-auto custom-scrollbar pr-1"></div>
                </div>
            </div>

            <!-- HUGE EMBEDDED STREAMS SECTION -->
            <div class="pt-3 pb-1 border-t border-white/10">
                <div class="flex items-center justify-between mb-2 px-1">
                    <div class="text-[11px] font-extrabold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                        <i data-lucide="monitor-play" class="w-3.5 h-3.5"></i>
                        EMBEDDED STREAMS
                    </div>
                    <span class="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">Alternative Players</span>
                </div>
                <div class="grid grid-cols-2 gap-2" id="embedProvidersGrid">
                    <!-- Populated by JS -->
                </div>
            </div>

            <!-- Bottom Row: Speed Selector -->
            <div class="pt-3 border-t border-white/10 flex items-center justify-between gap-1 flex-wrap">
                <div class="flex items-center gap-1">
                    <span class="text-[9px] font-extrabold uppercase tracking-wider text-zinc-400 mr-1">SPEED</span>
                    <button onclick="setPlaybackSpeed(0.5, this)" class="speed-btn px-2 py-1 rounded-lg text-[10px] font-bold text-zinc-400 hover:text-white transition-all">0.5x</button>
                    <button onclick="setPlaybackSpeed(0.75, this)" class="speed-btn px-2 py-1 rounded-lg text-[10px] font-bold text-zinc-400 hover:text-white transition-all">0.75x</button>
                    <button onclick="setPlaybackSpeed(1, this)" class="speed-btn px-2 py-1 rounded-lg text-[10px] font-bold bg-white text-black transition-all">1x</button>
                    <button onclick="setPlaybackSpeed(1.25, this)" class="speed-btn px-2 py-1 rounded-lg text-[10px] font-bold text-zinc-400 hover:text-white transition-all">1.25x</button>
                    <button onclick="setPlaybackSpeed(1.5, this)" class="speed-btn px-2 py-1 rounded-lg text-[10px] font-bold text-zinc-400 hover:text-white transition-all">1.5x</button>
                    <button onclick="setPlaybackSpeed(2, this)" class="speed-btn px-2 py-1 rounded-lg text-[10px] font-bold text-zinc-400 hover:text-white transition-all">2x</button>
                </div>
            </div>
        </div>

        <!-- FULL AUDIO & SUBTITLES CONTROLLER MODAL (TRANSPARENT GLASS) -->
        <div id="subtitlesModal" class="fixed sm:absolute inset-x-0 bottom-0 sm:bottom-auto sm:inset-auto sm:top-16 sm:right-6 lg:right-10 z-50 sm:z-40 hidden animate-fade-in w-full sm:w-[460px] max-h-[85vh] sm:max-h-[80vh] overflow-y-auto glass-panel rounded-t-3xl sm:rounded-2xl p-4 sm:p-5 shadow-[0_25px_60px_rgba(0,0,0,0.95)] text-white pb-8 sm:pb-5">
            <div class="w-12 h-1 bg-white/20 rounded-full mx-auto mb-3 sm:hidden"></div>
            <div class="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                <div class="flex items-center gap-2">
                    <i data-lucide="languages" class="w-4 h-4 text-red-500"></i>
                    <span class="text-xs font-extrabold uppercase tracking-widest text-zinc-300">Audio & Subtitles Controller</span>
                </div>
                <button onclick="toggleSubtitlesModal(false)" class="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <!-- Tabs: Audio Tracks vs Subtitles vs Appearance & Sync -->
            <div class="grid grid-cols-3 gap-1 rounded-xl glass-sub-panel p-1 mb-3">
                <button id="tabAudioBtn" onclick="switchSubTab('audio')" class="py-1.5 text-xs font-bold rounded-lg transition-all text-zinc-400 hover:text-white">
                    Audio Dubs
                </button>
                <button id="tabSubtitlesBtn" onclick="switchSubTab('subtitles')" class="py-1.5 text-xs font-bold rounded-lg transition-all bg-red-600 text-white shadow">
                    Subtitles
                </button>
                <button id="tabVisualBtn" onclick="switchSubTab('visual')" class="py-1.5 text-xs font-bold rounded-lg transition-all text-zinc-400 hover:text-white">
                    Styling
                </button>
            </div>

            <!-- Tab 1: AUDIO TRACKS (MULTI-LANGUAGE DUBS) -->
            <div id="tabContentAudio" class="hidden space-y-2">
                <div class="flex items-center justify-between">
                    <div class="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">DETECTED AUDIO TRACKS</div>
                    <span id="audioTrackCountBadge" class="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-zinc-300 font-bold">1 Track</span>
                </div>
                <div id="audioTracksList" class="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                    <div class="p-3 text-center text-xs text-zinc-400 glass-sub-panel rounded-xl">Detecting audio streams...</div>
                </div>
            </div>

            <!-- Tab 2: SUBTITLE TRACKS -->
            <div id="tabContentSubtitles" class="space-y-2">
                <div class="flex items-center justify-between">
                    <div class="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">SUBTITLE TRACKS</div>
                    <span id="subtitleTrackCountBadge" class="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-zinc-300 font-bold">Auto-detected</span>
                </div>
                <div id="subtitlesList" class="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    <button onclick="setSubtitleTrack(-1)" class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left glass-sub-panel bg-white/15 text-white">
                        <span>Off</span>
                        <i data-lucide="check" class="w-3.5 h-3.5 text-white"></i>
                    </button>
                </div>
                <div class="border-t border-white/10 pt-2">
                    <label class="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Upload Custom Subtitle (.vtt / .srt)</label>
                    <input type="file" id="customSubInput" accept=".vtt,.srt" class="block w-full text-[11px] text-zinc-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-red-600 file:text-white hover:file:bg-red-700 cursor-pointer">
                </div>
            </div>

            <!-- Tab 3: Visual Controller & Audio Sync -->
            <div id="tabContentVisual" class="hidden space-y-3">
                <!-- Live Preview Card -->
                <div class="p-2.5 glass-sub-panel rounded-xl text-center">
                    <div id="subPreviewBox" class="py-1.5 px-3 rounded-lg inline-block transition-all" style="font-size: var(--sub-font-size); color: var(--sub-color); background-color: var(--sub-bg); text-shadow: var(--sub-shadow); font-weight: 700;">
                        The quick brown fox jumps over the lazy dog
                    </div>
                </div>

                <!-- Font Size -->
                <div>
                    <label class="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Font Size</label>
                    <div class="grid grid-cols-4 gap-1">
                        <button onclick="setSubtitleFontSize('0.85rem', this)" class="sub-font-btn py-1 px-1.5 bg-black/70 hover:bg-zinc-900 border border-white/10 hover:border-white/20 rounded-lg text-[11px] font-bold text-zinc-300 transition-all">Small</button>
                        <button onclick="setSubtitleFontSize('1.15rem', this)" class="sub-font-btn py-1 px-1.5 bg-zinc-900 border border-white/40 ring-1 ring-white/20 text-white rounded-lg text-[11px] font-bold shadow-lg transition-all">Normal</button>
                        <button onclick="setSubtitleFontSize('1.45rem', this)" class="sub-font-btn py-1 px-1.5 bg-black/70 hover:bg-zinc-900 border border-white/10 hover:border-white/20 rounded-lg text-[11px] font-bold text-zinc-300 transition-all">Large</button>
                        <button onclick="setSubtitleFontSize('1.75rem', this)" class="sub-font-btn py-1 px-1.5 bg-black/70 hover:bg-zinc-900 border border-white/10 hover:border-white/20 rounded-lg text-[11px] font-bold text-zinc-300 transition-all">Huge</button>
                    </div>
                </div>

                <!-- Colors -->
                <div>
                    <label class="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Color</label>
                    <div class="grid grid-cols-4 gap-1.5">
                        <button onclick="setSubtitleColor('#ffffff', this)" class="sub-color-btn py-1.5 rounded-lg bg-black/70 hover:bg-zinc-900 text-white text-[11px] font-bold border border-white/30">White</button>
                        <button onclick="setSubtitleColor('#facc15', this)" class="sub-color-btn py-1.5 rounded-lg bg-black/70 hover:bg-zinc-900 text-yellow-300 text-[11px] font-bold border border-white/10">Yellow</button>
                        <button onclick="setSubtitleColor('#38bdf8', this)" class="sub-color-btn py-1.5 rounded-lg bg-black/70 hover:bg-zinc-900 text-sky-300 text-[11px] font-bold border border-white/10">Cyan</button>
                        <button onclick="setSubtitleColor('#4ade80', this)" class="sub-color-btn py-1.5 rounded-lg bg-black/70 hover:bg-zinc-900 text-emerald-300 text-[11px] font-bold border border-white/10">Green</button>
                    </div>
                </div>
                <!-- Background -->
                <div>
                    <label class="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Background</label>
                    <div class="grid grid-cols-4 gap-1.5">
                        <button onclick="setSubtitleBg('rgba(0,0,0,0)', this)" class="sub-bg-btn py-1.5 rounded-lg bg-black/70 hover:bg-zinc-900 text-white text-[11px] font-bold border border-white/10">None</button>
                        <button onclick="setSubtitleBg('rgba(0,0,0,0.55)', this)" class="sub-bg-btn py-1.5 rounded-lg bg-black/70 hover:bg-zinc-900 text-white text-[11px] font-bold border border-white/30">Half</button>
                        <button onclick="setSubtitleBg('rgba(0,0,0,0.85)', this)" class="sub-bg-btn py-1.5 rounded-lg bg-black/70 hover:bg-zinc-900 text-white text-[11px] font-bold border border-white/10">Dark</button>
                        <button onclick="setSubtitleBg('rgba(255,255,255,0.85)', this)" class="sub-bg-btn py-1.5 rounded-lg bg-zinc-200 hover:bg-white text-black text-[11px] font-bold border border-white/10">Light</button>
                    </div>
                </div>
                <!-- Shadow -->
                <div>
                    <label class="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Shadow</label>
                    <div class="grid grid-cols-3 gap-1.5">
                        <button onclick="setSubtitleShadow('none', this)" class="sub-shadow-btn py-1.5 rounded-lg bg-black/70 hover:bg-zinc-900 text-white text-[11px] font-bold border border-white/10">None</button>
                        <button onclick="setSubtitleShadow('1px 1px 2px black, 0 0 1em black', this)" class="sub-shadow-btn py-1.5 rounded-lg bg-black/70 hover:bg-zinc-900 text-white text-[11px] font-bold border border-white/30">Drop</button>
                        <button onclick="setSubtitleShadow('-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000', this)" class="sub-shadow-btn py-1.5 rounded-lg bg-black/70 hover:bg-zinc-900 text-white text-[11px] font-bold border border-white/10">Outline</button>
                    </div>
                </div>

                <!-- Audio / Subtitle Sync Offset -->
                <div class="p-2.5 glass-sub-panel rounded-xl">
                    <div class="flex items-center justify-between mb-1.5">
                        <span class="text-[10px] font-bold text-zinc-300 uppercase">Timing Sync Offset</span>
                        <span id="subOffsetDisplay" class="px-2 py-0.5 rounded-full bg-zinc-900 text-white border border-white/20 font-mono text-[10px] font-bold">0.00s</span>
                    </div>
                    <div class="grid grid-cols-5 gap-1">
                        <button onclick="adjustSubtitleSync(-1.0)" class="py-1 bg-black/70 hover:bg-zinc-900 border border-white/10 text-white rounded-lg text-[10px] font-bold transition-all">-1.0s</button>
                        <button onclick="adjustSubtitleSync(-0.25)" class="py-1 bg-black/70 hover:bg-zinc-900 border border-white/10 text-white rounded-lg text-[10px] font-bold transition-all">-0.25s</button>
                        <button onclick="resetSubtitleSync()" class="py-1 bg-black/90 hover:bg-zinc-900 border border-white/25 text-white rounded-lg text-[10px] font-bold transition-all">Reset</button>
                        <button onclick="adjustSubtitleSync(0.25)" class="py-1 bg-black/70 hover:bg-zinc-900 border border-white/10 text-white rounded-lg text-[10px] font-bold transition-all">+0.25s</button>
                        <button onclick="adjustSubtitleSync(1.0)" class="py-1 bg-black/70 hover:bg-zinc-900 border border-white/10 text-white rounded-lg text-[10px] font-bold transition-all">+1.0s</button>
                    </div>
                </div>

                <!-- Apply Subtitle Styles & Reset Controls (Explicit User Apply Action) -->
                <div class="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                    <button id="btnApplySubStyles" onclick="applyAndConfirmSubtitleStyles()" class="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-900/40 transition-all cursor-pointer">
                        <i data-lucide="check-circle-2" class="w-4 h-4 text-white"></i>
                        <span id="btnApplySubStylesLabel">Apply Subtitle Styles</span>
                    </button>
                    <button onclick="resetSubtitleStylesToDefault()" class="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-zinc-300 hover:text-white font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5" title="Reset Subtitle Styles to Default">
                        <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                        <span>Reset</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- ANISKIP ANIME INTRO & OUTRO TIMESTAMPS MODAL (TRANSPARENT GLASS) -->
        <div id="aniSkipModal" class="fixed sm:absolute inset-x-0 bottom-0 sm:bottom-auto sm:inset-auto sm:top-16 sm:right-6 lg:right-10 z-50 sm:z-40 hidden animate-fade-in w-full sm:w-[460px] max-h-[85vh] sm:max-h-[80vh] overflow-y-auto glass-panel rounded-t-3xl sm:rounded-2xl p-4 sm:p-5 shadow-[0_25px_60px_rgba(0,0,0,0.95)] text-white pb-8 sm:pb-5">
            <div class="w-12 h-1 bg-white/20 rounded-full mx-auto mb-3 sm:hidden"></div>
            <div class="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-400/30 flex items-center justify-center">
                        <i data-lucide="zap" class="w-3.5 h-3.5 text-amber-400"></i>
                    </div>
                    <div>
                        <span class="text-xs font-extrabold uppercase tracking-widest text-amber-300">AniSkip Anime Engine</span>
                        <p class="text-[9px] text-zinc-400">Crowdsourced Anime Opening & Ending timestamps</p>
                    </div>
                </div>
                <button onclick="toggleAniSkipModal(false)" class="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <!-- MAL ID Input Group -->
            <div class="space-y-3">
                <div class="p-3 rounded-xl glass-sub-panel space-y-2">
                    <div class="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-zinc-300">
                        <span class="flex items-center gap-1.5"><i data-lucide="hash" class="w-3 h-3 text-amber-400"></i> MyAnimeList ID (MAL ID)</span>
                        <span id="aniSkipStatusBadge" class="text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-400 font-bold">Idle</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <input type="number" id="inputMalId" placeholder="e.g. 52299 (Solo Leveling), 20 (Naruto)" class="w-full bg-black/50 border border-white/15 focus:border-amber-400 px-3 py-2 rounded-xl text-xs font-mono text-white placeholder-zinc-500 outline-none transition-all">
                        <button id="btnFetchAniSkip" onclick="applyCustomMalId()" class="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center gap-1 shrink-0 cursor-pointer">
                            <i data-lucide="search" class="w-3.5 h-3.5"></i>
                            <span>Fetch</span>
                        </button>
                    </div>
                    <div class="flex items-center justify-between text-[10px] text-zinc-400 pt-0.5">
                        <span>Current Episode: <strong id="aniSkipEpisodeDisplay" class="text-white">1</strong></span>
                        <button onclick="autoDetectMalId()" class="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer">
                            <i data-lucide="sparkles" class="w-3 h-3"></i> Auto-Detect MAL ID
                        </button>
                    </div>
                </div>

                <!-- Detected Timestamps List -->
                <div class="space-y-1.5">
                    <div class="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 px-1">DETECTED SKIP INTERVALS</div>
                    <div id="aniSkipSegmentsList" class="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                        <div class="p-3 text-center text-xs text-zinc-400 glass-sub-panel rounded-xl">No AniSkip data loaded yet. Enter MAL ID above.</div>
                    </div>
                </div>

                <!-- Automation & Preferences -->
                <div class="pt-2 border-t border-white/10 space-y-2">
                    <div class="flex items-center justify-between p-2 rounded-xl glass-sub-panel">
                        <div>
                            <div class="text-xs font-bold text-white flex items-center gap-1.5">
                                <i data-lucide="fast-forward" class="w-3.5 h-3.5 text-amber-400"></i> Auto-Skip Intro & Outro
                            </div>
                            <div class="text-[9px] text-zinc-400">Skip OP/ED automatically without clicking</div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="chkAutoSkip" onchange="toggleAniSkipAuto(this.checked)" class="sr-only peer">
                            <div class="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                    </div>

                    <!-- Quick Preset Badges -->
                    <div>
                        <div class="text-[9px] font-extrabold uppercase text-zinc-500 mb-1 px-1">POPULAR ANIME PRESETS</div>
                        <div class="flex flex-wrap gap-1">
                            <button onclick="setQuickMalPreset(52299, 'Solo Leveling')" class="px-2 py-1 rounded-lg glass-sub-panel text-[10px] font-bold text-zinc-300 hover:text-white hover:bg-white/15 cursor-pointer">Solo Leveling (#52299)</button>
                            <button onclick="setQuickMalPreset(20, 'Naruto')" class="px-2 py-1 rounded-lg glass-sub-panel text-[10px] font-bold text-zinc-300 hover:text-white hover:bg-white/15 cursor-pointer">Naruto (#20)</button>
                            <button onclick="setQuickMalPreset(16498, 'Attack on Titan')" class="px-2 py-1 rounded-lg glass-sub-panel text-[10px] font-bold text-zinc-300 hover:text-white hover:bg-white/15 cursor-pointer">AOT (#16498)</button>
                            <button onclick="setQuickMalPreset(40748, 'Jujutsu Kaisen')" class="px-2 py-1 rounded-lg glass-sub-panel text-[10px] font-bold text-zinc-300 hover:text-white hover:bg-white/15 cursor-pointer">JJK (#40748)</button>
                            <button onclick="setQuickMalPreset(38000, 'Demon Slayer')" class="px-2 py-1 rounded-lg glass-sub-panel text-[10px] font-bold text-zinc-300 hover:text-white hover:bg-white/15 cursor-pointer">Demon Slayer (#38000)</button>
                            <button onclick="setQuickMalPreset(21, 'One Piece')" class="px-2 py-1 rounded-lg glass-sub-panel text-[10px] font-bold text-zinc-300 hover:text-white hover:bg-white/15 cursor-pointer">One Piece (#21)</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- TV SEASONS & EPISODES DRAWER (TRANSPARENT GLASS) -->
        <div id="episodesDrawer" class="hidden absolute bottom-0 left-0 right-0 z-40 max-h-[75vh] glass-panel border-t border-white/10 rounded-t-3xl p-5 sm:p-7 shadow-[0_-20px_50px_rgba(0,0,0,0.9)] transform translate-y-full transition-transform duration-400 ease-out flex flex-col">
            <div class="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
                <div class="flex items-center gap-3">
                    <h3 class="text-sm sm:text-base font-black text-white uppercase tracking-tight">Episodes</h3>
                    <select id="seasonSelect" onchange="changeSeason(this.value)" class="bg-zinc-900/80 text-white font-bold text-xs px-3 py-1.5 rounded-xl border border-white/15 outline-none cursor-pointer"></select>
                </div>
                <button onclick="toggleEpisodesDrawer(false)" class="w-8 h-8 rounded-full glass-btn flex items-center justify-center text-white cursor-pointer">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
            <div id="episodesGrid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 overflow-y-auto custom-scrollbar pt-3 flex-grow">
                <div class="col-span-full py-8 text-center text-xs text-zinc-500">Loading episodes...</div>
            </div>
        </div>
        <?php endif; ?>

        <!-- MORE LIKE THIS SLIDE-UP TRAY (TRANSPARENT GLASS & CINEMATIC REDESIGN) -->
        <div id="moreLikeThisTray" class="absolute bottom-0 left-0 right-0 z-40 max-h-[78vh] glass-panel border-t border-white/10 rounded-t-3xl p-5 sm:p-7 shadow-[0_-25px_60px_rgba(0,0,0,0.85)] transform translate-y-full transition-transform duration-400 ease-out flex flex-col">
            <div class="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
                <div class="flex items-center gap-2.5">
                    <span class="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]"></span>
                    <h3 class="text-sm sm:text-base font-black text-white uppercase tracking-tight">More Like This</h3>
                    <span class="text-xs text-zinc-400 font-semibold truncate max-w-xs sm:max-w-md">&bull; <?php echo htmlspecialchars($title); ?></span>
                </div>
                <button onclick="toggleMoreLikeThisDrawer(false)" class="w-8 h-8 rounded-full glass-btn flex items-center justify-center text-white cursor-pointer">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
            <div id="moreLikeThisGrid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 overflow-y-auto custom-scrollbar pt-4 flex-grow">
                <div class="col-span-full py-8 text-center text-xs text-zinc-500">Loading recommendations...</div>
            </div>
        </div>

        <!-- SLEEP TIMER MODAL (TRANSPARENT GLASS) -->
        <div id="sleepModal" class="hidden fixed inset-0 z-[10001] bg-black/70 backdrop-blur-xl flex items-end sm:items-center justify-center p-3 sm:p-4">
            <div class="glass-panel rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 w-full max-w-sm shadow-2xl text-center relative flex flex-col">
                <button onclick="toggleSleepModal(false)" class="absolute top-4 right-4 w-9 h-9 rounded-full glass-btn flex items-center justify-center cursor-pointer">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
                <div class="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-red-500/20 text-red-500">
                    <i data-lucide="clock" class="w-6 h-6"></i>
                </div>
                <h3 class="text-base font-bold text-white mb-1">Set Sleep Timer</h3>
                <p class="text-xs text-zinc-400 mb-4">Playback will pause automatically when timer expires.</p>
                <div class="grid grid-cols-2 gap-2.5 mb-4">
                    <button onclick="setSleepTimer(15)" class="py-2.5 glass-btn text-zinc-300 font-bold text-xs rounded-xl hover:bg-red-600 hover:text-white">15 Minutes</button>
                    <button onclick="setSleepTimer(30)" class="py-2.5 glass-btn text-zinc-300 font-bold text-xs rounded-xl hover:bg-red-600 hover:text-white">30 Minutes</button>
                    <button onclick="setSleepTimer(45)" class="py-2.5 glass-btn text-zinc-300 font-bold text-xs rounded-xl hover:bg-red-600 hover:text-white">45 Minutes</button>
                    <button onclick="setSleepTimer(60)" class="py-2.5 glass-btn text-zinc-300 font-bold text-xs rounded-xl hover:bg-red-600 hover:text-white">60 Minutes</button>
                </div>
                <div class="flex gap-2">
                    <button onclick="setSleepTimer(0)" class="flex-1 py-2.5 glass-sub-panel hover:bg-white/15 text-zinc-400 font-bold text-xs rounded-xl transition-all">Turn Off</button>
                    <button onclick="toggleSleepModal(false)" class="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all">Cancel</button>
                </div>
            </div>
        </div>

    </div>

    <!-- Script Engine -->
    <script>
        const urlParams = new URLSearchParams(window.location.search);
        const MEDIA_ID = urlParams.get('id') || urlParams.get('tmdbId') || '<?php echo addslashes($id); ?>';
        const MEDIA_TYPE = urlParams.get('type') || urlParams.get('media_type') || '<?php echo addslashes($type); ?>' || 'movie';
        const MEDIA_TITLE = urlParams.get('title') || urlParams.get('name') || '<?php echo addslashes($title); ?>';
        let MEDIA_SEASON = parseInt(urlParams.get('s') || urlParams.get('season') || '<?php echo $s; ?>', 10) || 1;
        let MEDIA_EPISODE = parseInt(urlParams.get('e') || urlParams.get('episode') || '<?php echo $e; ?>', 10) || 1;
        let CURRENT_SERVER = urlParams.get('srv') || '<?php echo addslashes($srv); ?>' || 's40';
        let DIRECT_STREAM_URL = urlParams.get('url') || '<?php echo addslashes($directUrl); ?>';
        const SOURCE_ORIGIN = urlParams.get('source') || '<?php echo addslashes($source); ?>' || 'consumet.html';

        const mainVideo = document.getElementById('mainVideo');
        const embedFrame = document.getElementById('embedFrame');
        const streamLoading = document.getElementById('streamLoading');
        const streamLoadingMsg = document.getElementById('streamLoadingMsg');
        const mediaHudOverlay = document.getElementById('mediaHudOverlay');
        const topControlsBar = document.getElementById('topControlsBar');
        const bottomControlsBar = document.getElementById('bottomControlsBar');
        const timelineContainer = document.getElementById('timelineContainer');
        const timelineBuffer = document.getElementById('timelineBuffer');
        const timelineProgress = document.getElementById('timelineProgress');
        const timelineThumb = document.getElementById('timelineThumb');
        const timelineTooltip = document.getElementById('timelineTooltip');
        const timeCurrent = document.getElementById('timeCurrent');
        const timeDuration = document.getElementById('timeDuration');
        const btnPlayPause = document.getElementById('btnPlayPause');
        const playIcon = document.getElementById('playIcon');
        const pauseIcon = document.getElementById('pauseIcon');
        const qualityServerModal = document.getElementById('qualityServerModal');
        const subtitlesModal = document.getElementById('subtitlesModal');
        const moreLikeThisTray = document.getElementById('moreLikeThisTray');
        const moreLikeThisChevron = document.getElementById('moreLikeThisChevron');
        const episodesDrawer = document.getElementById('episodesDrawer');
        const btnSkipIntro = document.getElementById('btnSkipIntro');
        const btnNextEpisode = document.getElementById('btnNextEpisode');
        const zoomIndicator = document.getElementById('zoom-indicator');
        const sleepIndicator = document.getElementById('sleep-indicator');
        const sleepModal = document.getElementById('sleepModal');

        // AniSkip Elements
        const aniSkipModal = document.getElementById('aniSkipModal');
        const btnOpenAniSkip = document.getElementById('btnOpenAniSkip');
        const aniSkipBadge = document.getElementById('aniSkipBadge');
        const inputMalId = document.getElementById('inputMalId');
        const aniSkipStatusBadge = document.getElementById('aniSkipStatusBadge');
        const aniSkipSegmentsList = document.getElementById('aniSkipSegmentsList');
        const aniSkipEpisodeDisplay = document.getElementById('aniSkipEpisodeDisplay');
        const chkAutoSkip = document.getElementById('chkAutoSkip');
        const timelineOpMarker = document.getElementById('timelineOpMarker');
        const timelineEdMarker = document.getElementById('timelineEdMarker');
        const timelineRecapMarker = document.getElementById('timelineRecapMarker');
        const skipIntroText = document.getElementById('skipIntroText');
        const skipIntroIcon = document.getElementById('skipIntroIcon');

        function getStoredMalId() {
            try {
                if (MEDIA_ID && MEDIA_ID !== '0' && MEDIA_ID !== 'null' && MEDIA_ID !== '{{ID}}') {
                    const v1 = localStorage.getItem('stalker_mal_id_' + MEDIA_ID);
                    if (v1 && !isNaN(parseInt(v1, 10))) return parseInt(v1, 10);
                }
                if (MEDIA_TITLE && MEDIA_TITLE !== 'Cinema Presentation' && MEDIA_TITLE !== '{{TITLE}}') {
                    const v2 = localStorage.getItem('stalker_mal_id_' + MEDIA_TITLE.toLowerCase().trim());
                    if (v2 && !isNaN(parseInt(v2, 10))) return parseInt(v2, 10);
                }
            } catch (e) {}
            return null;
        }

        function saveStoredMalId(malId) {
            if (!malId || isNaN(parseInt(malId, 10))) return;
            const num = parseInt(malId, 10);
            try {
                if (MEDIA_ID && MEDIA_ID !== '0' && MEDIA_ID !== 'null' && MEDIA_ID !== '{{ID}}') {
                    localStorage.setItem('stalker_mal_id_' + MEDIA_ID, String(num));
                }
                if (MEDIA_TITLE && MEDIA_TITLE !== 'Cinema Presentation' && MEDIA_TITLE !== '{{TITLE}}') {
                    localStorage.setItem('stalker_mal_id_' + MEDIA_TITLE.toLowerCase().trim(), String(num));
                }
            } catch (e) {}
        }

        const rawMalParam = urlParams.get('malId') || urlParams.get('mal_id') || urlParams.get('mal') || '<?php echo addslashes($malId); ?>';
        let MAL_ID = (rawMalParam && !isNaN(parseInt(rawMalParam, 10))) ? parseInt(rawMalParam, 10) : getStoredMalId();
        if (MAL_ID) saveStoredMalId(MAL_ID);

        /* ---------------- ROBUST PLAY/PAUSE CONTROLLER & ABORT REJECTION SUPPRESSION ---------------- */
        window.addEventListener('unhandledrejection', (event) => {
            const reason = event.reason;
            if (reason && (
                reason.name === 'AbortError' || 
                (typeof reason.message === 'string' && (
                    reason.message.includes('interrupted by a call to pause') ||
                    reason.message.includes('interrupted by a new load request')
                ))
            )) {
                event.preventDefault();
            }
        });

        let pendingPlayPromise = null;

        function safePlayVideo() {
            if (!mainVideo) return Promise.resolve();
            try {
                const promise = mainVideo.play();
                if (promise !== undefined && typeof promise.then === 'function') {
                    pendingPlayPromise = promise;
                    return promise
                        .then(() => {
                            pendingPlayPromise = null;
                        })
                        .catch((err) => {
                            pendingPlayPromise = null;
                            if (err && err.name === 'NotAllowedError') {
                                // Browser policy blocked audio autoplay; fallback to muted autoplay
                                try {
                                    mainVideo.muted = true;
                                    const retry = mainVideo.play();
                                    if (retry !== undefined && typeof retry.then === 'function') {
                                        retry.catch(() => {});
                                    }
                                } catch (_) {}
                            } else if (err && err.name === 'AbortError') {
                                // Benign abort: play request was superseded by pause() or stream switch
                            } else {
                                console.debug('Playback notice:', err);
                            }
                        });
                }
            } catch (e) {
                // Ignore synchronous play exceptions
            }
            return Promise.resolve();
        }

        function safePauseVideo() {
            if (!mainVideo) return;
            if (pendingPlayPromise) {
                pendingPlayPromise
                    .then(() => {
                        try { mainVideo.pause(); } catch (_) {}
                    })
                    .catch(() => {
                        try { mainVideo.pause(); } catch (_) {}
                    });
            } else {
                try { mainVideo.pause(); } catch (_) {}
            }
        }

        window.MAL_ID = MAL_ID;
        window.MEDIA_SEASON = MEDIA_SEASON;
        window.MEDIA_EPISODE = MEDIA_EPISODE;
        window.MEDIA_TITLE = MEDIA_TITLE;
        let aniSkipResults = [];
        let activeAniSkipSegment = null;
        // Default Auto-Skip to true unless user explicitly set it to false
        let aniSkipAutoSkip = localStorage.getItem('stalker_aniskip_autoskip') !== 'false';
        let lastAutoSkippedId = null;
        let aniSkipCurrentRequestEp = null;

        let hlsInstance = null;
        let controlsTimeout = null;
        let isScrubbing = false;
        let availableServers = [];
        let playerMode = 'direct';
        let currentRotation = 0;
        let currentAspectMode = 0; // 0: contain, 1: cover, 2: fill, 3: zoom-120
        let sleepTimerInterval = null;
        let sleepEndTime = null;
        let subtitleSyncOffset = 0;
        let currentActiveAudioTrack = 0;
        let currentActiveSubtitleTrack = -1;
        let externalSubtitlesLoaded = [];

        const DEFAULT_SERVERS = [
            { id: 's40', name: 'Aphelion (DarkMatter / Fast 1080p Direct)', cc: 'GL' },
            { id: 's62', name: 'Bastion (Multi-Audio HLS / KNOCW / NXOCW)', cc: 'IN' },
            { id: 'm4u', name: 'Movie 4U (Movies4u / Acek CDN 1080p)', cc: 'IN' },
            { id: 's61', name: 'Corvus (Multi-Audio Mirror Cluster)', cc: 'US' },
            { id: 'animesalt', name: 'AnimeSalt (Special Anime Scraper / Multi-Audio HLS)', cc: 'JP' },
            { id: 's3',  name: 'Edmunds (Filmu Proxy)', cc: 'US' },
            { id: 's70', name: 'Polaris (Multi-Language Dubs / HLS v7)', cc: 'US' },
            { id: 's30', name: 'Nova (VidRock CDN)', cc: 'US' },
            { id: 's31', name: 'Orion (Filmu Workers)', cc: 'US' },
            { id: 's4k', name: 'PeakStream 4K (SpeedRace 4K UHD Master)', cc: 'US' },
            { id: 's60', name: 'Vertex (Mirror Cluster)', cc: 'US' }
        ];

        window.addEventListener('DOMContentLoaded', async () => {
            if (window.lucide) lucide.createIcons();
            loadMediaHudMetadata();
            loadStoredSubtitleSettings();
            await loadServerList();
            loadMoreLikeThis();

            const btnEp = document.getElementById('btnEpisodesDrawer');
            const epDrawer = document.getElementById('episodesDrawer');
            if (MEDIA_TYPE === 'tv') {
                if (btnEp) btnEp.classList.remove('hidden');
                if (epDrawer) epDrawer.classList.remove('hidden');
                loadTvSeasonsAndEpisodes();
            } else {
                if (btnEp) btnEp.classList.add('hidden');
                if (epDrawer) epDrawer.classList.add('hidden');
            }

            if (DIRECT_STREAM_URL && DIRECT_STREAM_URL.startsWith('http')) {
                showLoading(false);
                initHlsPlayer(DIRECT_STREAM_URL);
                window.bingrActiveStreamUrl = DIRECT_STREAM_URL;
                
                // Background fetch to populate multi-audio dubs (sources) if we skipped the main fetch
                if (MEDIA_ID && MEDIA_ID !== '0' && MEDIA_ID !== 'null') {
                    fetch('/api/bingr/stream', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            srv: CURRENT_SERVER,
                            t: MEDIA_TYPE,
                            id: MEDIA_ID,
                            query: MEDIA_TITLE,
                            s: MEDIA_SEASON,
                            e: MEDIA_EPISODE
                        })
                    })
                    .then(r => r.ok ? r.json() : null)
                    .then(data => {
                        if (data && data.sources && data.sources.length > 0) {
                            window.bingrSources = data.sources;
                            if (data.subtitles && data.subtitles.length > 0) {
                                externalSubtitlesLoaded = data.subtitles;
                            }
                            // Refresh Audio UI in case the modal is already open
                            if (typeof detectAndPopulateAudioTracks === 'function') {
                                detectAndPopulateAudioTracks();
                            }
                            if (typeof populateSubtitlesList === 'function') {
                                populateSubtitlesList();
                            }
                        }
                    })
                    .catch(e => console.warn('Background fetch for audio sources failed', e));
                }
            } else {
                fetchAndPlayStream(CURRENT_SERVER);
            }

            fetchExternalSubtitles();
            populateEmbedProviders();
            setupControlsAutoHide();
            setupTimeline();
            setupSubtitlesUploader();
            initAniSkip();
        });

        let isProbingStream = false;

        async function fetchAndPlayStream(serverId, isManual = false) {
            if (isProbingStream && isManual) {
                showToast('Connecting, please wait...');
                return;
            }
            if (isManual) isProbingStream = true;

            showLoading(true, 'Connecting to Server: ' + getServerName(serverId) + '...');

            try {
                const payload = {
                    type: MEDIA_TYPE,
                    id: MEDIA_ID,
                    title: MEDIA_TITLE,
                    season: MEDIA_TYPE === 'tv' ? MEDIA_SEASON : undefined,
                    episode: MEDIA_TYPE === 'tv' ? MEDIA_EPISODE : undefined,
                    srv: serverId,
                    strictSrv: isManual
                };

                const res = await fetch('/api/bingr/stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                const streamUrl = data.primaryM3u8 || (data.sources && data.sources.length > 0 ? data.sources[0].url : null);
                if (streamUrl) {
                    CURRENT_SERVER = serverId;
                    updateServerListUI();
                    window.bingrSources = data.sources || [];
                    window.bingrActiveStreamUrl = streamUrl;
                    initHlsPlayer(streamUrl);
                    if (data.subtitles && data.subtitles.length > 0) {
                        externalSubtitlesLoaded = data.subtitles;
                        populateSubtitlesList();
                    }
                    if (isManual) {
                        showToast(`Connected to ${getServerName(serverId)}`);
                    }
                } else {
                    console.warn('Server ' + serverId + ' returned no stream.');
                    if (isManual) {
                        showLoading(false);
                        updateServerListUI(); // Keep UI on confirmed active server
                        showToast('Source not available on ' + getServerName(serverId) + '. Remaining on active source.', 'info');
                    } else {
                        cascadeFallback(serverId);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch stream:', err);
                if (isManual) {
                    showLoading(false);
                    updateServerListUI();
                    showToast('Failed to connect to ' + getServerName(serverId) + '. Remaining on active source.', 'error');
                } else {
                    cascadeFallback(serverId);
                }
            } finally {
                isProbingStream = false;
            }
        }

        let failedServers = new Set();

        function cascadeFallback(failedServerId) {
            failedServers.add(failedServerId);
            const fallbackOrder = ['s40', 's62', 'm4u', 's61', 'animesalt', 's3', 's70', 's30', 's4k', 's31', 's60'];
            const nextServer = fallbackOrder.find(srv => !failedServers.has(srv));
            if (nextServer) {
                fetchAndPlayStream(nextServer, false);
            } else {
                // Direct servers exhausted. Cleanly switch to embed player mode without confusing UI bouncing
                showLoading(false);
                failedServers.clear();
                console.log("[Fallback] Direct streams unavailable across all clusters. Switching to embed player mode.");
                showToast('Direct stream unavailable. Switching to Embed player...', 'info');
                setTimeout(() => {
                    switchPlayerMode('embed', 'vidlink_pro', true);
                }, 400);
            }
        }

        function initHlsPlayer(streamUrl) {
            if (!streamUrl) return;

            // Auto-proxy CDNs that enforce strict Origin/Referer or fail direct browser CORS
            let effectiveUrl = streamUrl;
            const lowerUrl = streamUrl.toLowerCase();
            if (effectiveUrl.startsWith('http://') || effectiveUrl.startsWith('https://')) {
                if (lowerUrl.includes('acek-cdn') || lowerUrl.includes('morencius') || lowerUrl.includes('vidhide') || lowerUrl.includes('streamhide') || lowerUrl.includes('m4uplay') || lowerUrl.includes('filelions') || lowerUrl.includes('dramiyos')) {
                    effectiveUrl = '/live.php?url=' + encodeURIComponent(streamUrl);
                    console.log('[HLS] Automatically routed stream through reverse proxy for CORS compliance:', effectiveUrl);
                }
            }

            // Cleanly detach and destroy previous Hls instance
            if (hlsInstance) {
                try {
                    hlsInstance.stopLoad();
                    hlsInstance.detachMedia();
                    hlsInstance.destroy();
                } catch(e) {}
                hlsInstance = null;
            }

            // Reset HTML5 video element pipeline
            try {
                mainVideo.pause();
                mainVideo.removeAttribute('src');
                mainVideo.load();
            } catch(e) {}

            const targetSeekTime = previousVideoTime;

            if (Hls.isSupported()) {
                hlsInstance = new Hls({
                    capLevelToPlayerSize: true,
                    maxBufferLength: 30,
                    maxMaxBufferLength: 60,
                    enableWorker: true,
                    lowLatencyMode: true,
                    startPosition: targetSeekTime > 0 ? targetSeekTime : -1
                });

                hlsInstance.loadSource(effectiveUrl);
                hlsInstance.attachMedia(mainVideo);

                hlsInstance.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                    showLoading(false);
                    populateQualityLevels(data.levels);
                    detectAndPopulateAudioTracks();
                    detectAndPopulateSubtitleTracks();
                    
                    if (previousVideoTime > 0) {
                        const seekTo = previousVideoTime;
                        previousVideoTime = 0;
                        const applySeek = () => {
                            try {
                                if (mainVideo.duration && isFinite(mainVideo.duration) && seekTo < mainVideo.duration) {
                                    mainVideo.currentTime = seekTo;
                                } else if (seekTo > 0) {
                                    mainVideo.currentTime = seekTo;
                                }
                            } catch(e) {}
                        };

                        if (mainVideo.readyState >= 1) {
                            applySeek();
                        } else {
                            mainVideo.addEventListener('loadedmetadata', applySeek, { once: true });
                        }
                    }
                    
                    safePlayVideo();
                });

                hlsInstance.on(Hls.Events.MANIFEST_LOADED, () => {
                    detectAndPopulateAudioTracks();
                });

                // Audio Tracks Event Handlers
                hlsInstance.on(Hls.Events.AUDIO_TRACKS_UPDATED, (event, data) => {
                    detectAndPopulateAudioTracks();
                });

                hlsInstance.on(Hls.Events.AUDIO_TRACK_SWITCHED, (event, data) => {
                    currentActiveAudioTrack = data.id;
                    detectAndPopulateAudioTracks();
                });

                hlsInstance.on(Hls.Events.AUDIO_TRACK_LOADED, (event, data) => {
                    detectAndPopulateAudioTracks();
                });

                hlsInstance.on(Hls.Events.LEVEL_LOADED, () => {
                    detectAndPopulateAudioTracks();
                });

                hlsInstance.on(Hls.Events.FRAG_PARSED, () => {
                    if (!window._audioCheckedAfterFrag) {
                        window._audioCheckedAfterFrag = true;
                        detectAndPopulateAudioTracks();
                    }
                });

                hlsInstance.on(Hls.Events.BUFFER_CREATED, () => {
                    detectAndPopulateAudioTracks();
                });

                // Subtitle Tracks Event Handlers
                hlsInstance.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (event, data) => {
                    detectAndPopulateSubtitleTracks();
                });

                hlsInstance.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (event, data) => {
                    currentActiveSubtitleTrack = data.id;
                    populateSubtitlesList();
                });

                hlsInstance.on(Hls.Events.LEVEL_SWITCHED, () => {
                    updateQualityButtonLabel();
                });

                let networkErrorRetries = 0;
                hlsInstance.on(Hls.Events.ERROR, (event, data) => {
                    console.warn('[HLS Error]', data.type, data.details, data.fatal ? '(fatal)' : '');
                    if (data.fatal) {
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                networkErrorRetries++;
                                if (networkErrorRetries <= 2) {
                                    console.log(`[HLS] Attempting network recovery (attempt ${networkErrorRetries})...`);
                                    hlsInstance.startLoad();
                                } else if (!streamUrl.includes('/live.php?url=')) {
                                    console.log('[HLS] Direct CDN stream network error. Switching to reverse proxy...');
                                    const proxiedUrl = `/live.php?url=${encodeURIComponent(streamUrl)}`;
                                    initHlsPlayer(proxiedUrl);
                                } else {
                                    console.warn('[HLS] Unrecoverable network error. Triggering fallback cascade...');
                                    if (hlsInstance) hlsInstance.destroy();
                                    cascadeFallback(CURRENT_SERVER);
                                }
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                console.log('[HLS] Attempting media error recovery...');
                                hlsInstance.recoverMediaError();
                                break;
                            default:
                                console.warn('[HLS] Fatal error, triggering fallback...');
                                if (hlsInstance) hlsInstance.destroy();
                                cascadeFallback(CURRENT_SERVER);
                                break;
                        }
                    }
                });
            } else if (mainVideo.canPlayType('application/vnd.apple.mpegurl')) {
                mainVideo.src = streamUrl;
                if (targetSeekTime > 0) {
                    previousVideoTime = 0;
                    mainVideo.addEventListener('loadedmetadata', () => {
                        try { mainVideo.currentTime = targetSeekTime; } catch(e) {}
                    }, { once: true });
                }
                safePlayVideo();
            }
        }

        /* ---------------- AUDIO TRACKS DETECTION & SWITCHING (GENUINE STREAM TRACKS ONLY) ---------------- */
        function getLanguageDisplayName(langCode) {
            if (!langCode) return '';
            const code = String(langCode).toLowerCase().trim();
            const map = {
                'en': 'English', 'eng': 'English',
                'hi': 'Hindi', 'hin': 'Hindi',
                'es': 'Spanish', 'spa': 'Spanish',
                'fr': 'French', 'fra': 'French', 'fre': 'French',
                'de': 'German', 'ger': 'German', 'deu': 'German',
                'ja': 'Japanese', 'jpn': 'Japanese',
                'ko': 'Korean', 'kor': 'Korean',
                'ta': 'Tamil', 'tam': 'Tamil',
                'te': 'Telugu', 'tel': 'Telugu',
                'zh': 'Chinese', 'zho': 'Chinese', 'chi': 'Chinese',
                'it': 'Italian', 'ita': 'Italian',
                'ru': 'Russian', 'rus': 'Russian',
                'ar': 'Arabic', 'ara': 'Arabic',
                'pt': 'Portuguese', 'por': 'Portuguese',
                'tr': 'Turkish', 'tur': 'Turkish',
                'bn': 'Bengali', 'ben': 'Bengali',
                'ml': 'Malayalam', 'mal': 'Malayalam',
                'kn': 'Kannada', 'kan': 'Kannada',
                'mr': 'Marathi', 'mar': 'Marathi',
                'pa': 'Punjabi', 'pan': 'Punjabi',
                'gu': 'Gujarati', 'guj': 'Gujarati',
                'ur': 'Urdu', 'urd': 'Urdu',
                'id': 'Indonesian', 'ind': 'Indonesian',
                'vi': 'Vietnamese', 'vie': 'Vietnamese',
                'th': 'Thai', 'tha': 'Thai'
            };
            return map[code] || (langCode.length <= 4 ? langCode.toUpperCase() : langCode);
        }

        function getAudioTrackLabel(trackIdx) {
            if (hlsInstance && hlsInstance.audioTracks && hlsInstance.audioTracks[trackIdx]) {
                const t = hlsInstance.audioTracks[trackIdx];
                return getLanguageDisplayName(t.lang) || t.name || `Audio Track ${trackIdx + 1}`;
            }
            return `Audio Track ${trackIdx + 1}`;
        }

        function detectAndPopulateAudioTracks() {
            const list = document.getElementById('audioTracksList');
            const countBadge = document.getElementById('audioTrackCountBadge');
            const topBarAudioLabel = document.getElementById('topBarAudioLabel');
            if (!list) return;

            let hlsAudioTracks = [];
            if (hlsInstance && hlsInstance.audioTracks && hlsInstance.audioTracks.length > 0) {
                hlsAudioTracks = hlsInstance.audioTracks;
            }

            let tracks = [];

            // Read genuine embedded HLS audio tracks from stream manifest
            if (hlsAudioTracks.length > 0) {
                hlsAudioTracks.forEach((t, idx) => {
                    const langCode = t.lang || t.language || '';
                    const friendlyLang = getLanguageDisplayName(langCode) || t.name || `Audio Track ${idx + 1}`;
                    const channels = t.channels ? `${t.channels} Ch` : (t.name && t.name.toLowerCase().includes('5.1') ? '5.1 Surround' : 'Stereo');
                    const isSelected = (hlsInstance && hlsInstance.audioTrack >= 0)
                        ? (hlsInstance.audioTrack === idx)
                        : (currentActiveAudioTrack === idx || (currentActiveAudioTrack === -1 && (t.default || idx === 0)));
                    
                    tracks.push({
                        id: idx,
                        name: friendlyLang,
                        rawName: t.name || '',
                        details: channels,
                        isDefault: !!t.default,
                        isSelected: isSelected
                    });
                });
            } else if (mainVideo && mainVideo.audioTracks && mainVideo.audioTracks.length > 0) {
                // Native HTML5 Video AudioTrackList API
                for (let i = 0; i < mainVideo.audioTracks.length; i++) {
                    const natTrack = mainVideo.audioTracks[i];
                    const friendlyLang = getLanguageDisplayName(natTrack.language) || natTrack.label || `Audio Track ${i + 1}`;
                    tracks.push({
                        id: i,
                        name: friendlyLang,
                        rawName: natTrack.label || '',
                        details: 'Native Stream Track',
                        isDefault: i === 0,
                        isSelected: natTrack.enabled || (currentActiveAudioTrack === i)
                    });
                }
            } else {
                // Single Master Audio Track present in the stream
                tracks.push({
                    id: 0,
                    name: 'Primary Audio (Original Stream)',
                    rawName: 'Master Stream Audio',
                    details: 'Direct Stream Audio Mix',
                    isDefault: true,
                    isSelected: true
                });
            }

            if (countBadge) {
                countBadge.textContent = tracks.length === 1 ? '1 Track' : `${tracks.length} Tracks`;
            }

            let activeName = 'Audio';

            let html = `
                <div class="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
            `;

            tracks.forEach(track => {
                if (track.isSelected) {
                    activeName = track.name;
                }

                html += `
                    <button type="button" onclick="setAudioTrack(${track.id})" class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-left transition-all cursor-pointer ${track.isSelected ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30 shadow-md' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                        <div class="flex items-center gap-2.5 truncate">
                            <i data-lucide="volume-2" class="w-4 h-4 ${track.isSelected ? 'text-emerald-400' : 'text-zinc-400'} shrink-0"></i>
                            <div class="truncate">
                                <div class="text-white font-bold truncate flex items-center gap-1.5">
                                    <span>${track.name}</span>
                                    ${track.isDefault ? '<span class="text-[8px] px-1.5 py-0.5 rounded bg-emerald-600/30 text-emerald-300 font-bold uppercase">Default</span>' : ''}
                                </div>
                                <div class="text-[10px] text-zinc-400 font-normal truncate">${track.details}</div>
                            </div>
                        </div>
                        ${track.isSelected ? '<i data-lucide="check" class="w-4 h-4 text-emerald-400 shrink-0 ml-2"></i>' : ''}
                    </button>
                `;
            });

            html += `</div>`;

            // Dubbed Regional Feeds (Multi-Source Parsing)
            const languageSources = (window.bingrSources || []).filter(s => s.language || (s.label && s.label.includes('—')));
            if (languageSources.length > 0) {
                html += `
                    <div class="border-t border-white/10 pt-2.5 mt-2 mb-1.5">
                        <div class="flex items-center justify-between mb-1.5 px-0.5">
                            <span class="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Dubbed Regional Feeds (Polaris)</span>
                            <span class="text-[9px] text-zinc-500 font-medium">${languageSources.length} Feeds</span>
                        </div>
                        <div class="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                `;
                
                languageSources.forEach((srcObj, idx) => {
                    const isActive = (window.bingrActiveStreamUrl === srcObj.url);
                    const labelText = srcObj.language || srcObj.label || ('Language ' + (idx + 1));
                    html += `
                        <button type="button" onclick="switchStreamUrl('${srcObj.url}')" class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-left transition-all cursor-pointer ${isActive ? 'bg-gradient-to-r from-red-600 to-purple-600 text-white shadow-lg shadow-red-500/25 border border-white/20' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="flex items-center gap-2.5 truncate">
                                <i data-lucide="globe" class="w-4 h-4 ${isActive ? 'text-white' : 'text-zinc-400'} shrink-0"></i>
                                <div class="truncate">
                                    <div class="text-white font-bold truncate flex items-center gap-1.5">
                                        <span>${labelText}</span>
                                        <span class="text-[8px] font-bold text-amber-400 uppercase bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">DUB</span>
                                    </div>
                                    <div class="text-[10px] text-zinc-400 font-normal truncate">${srcObj.quality || '1080p'}</div>
                                </div>
                            </div>
                            ${isActive ? '<i data-lucide="check" class="w-4 h-4 text-white shrink-0 ml-2"></i>' : ''}
                        </button>
                    `;
                });
                
                html += `
                        </div>
                    </div>
                `;
            }

            // Multi-Language Dub Server Clusters Fast Switcher
            html += `
                <div class="border-t border-white/10 pt-2.5 mt-2">
                    <div class="flex items-center justify-between mb-1.5 px-0.5">
                        <span class="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Language Dub Clusters</span>
                        <span class="text-[9px] text-zinc-500 font-medium">Fast Server Switch</span>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        <button type="button" onclick="switchServerCluster('s40')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 's40' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">Aphelion (s40)</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">Fast 1080p Direct</div>
                            </div>
                            ${CURRENT_SERVER === 's40' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                        <button type="button" onclick="switchServerCluster('s62')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 's62' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">Bastion (s62)</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">Dual Audio & Dubs</div>
                            </div>
                            ${CURRENT_SERVER === 's62' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                        <button type="button" onclick="switchServerCluster('s70')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 's70' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">Polaris (s70)</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">Multi-Language Dubs</div>
                            </div>
                            ${CURRENT_SERVER === 's70' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                        <button type="button" onclick="switchServerCluster('m4u')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 'm4u' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">Movie 4U (m4u)</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">Acek Unpacked Master</div>
                            </div>
                            ${CURRENT_SERVER === 'm4u' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                        <button type="button" onclick="switchServerCluster('s61')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 's61' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">Corvus (s61)</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">Multi-Source Hub</div>
                            </div>
                            ${CURRENT_SERVER === 's61' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                        <button type="button" onclick="switchServerCluster('s3')" class="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-left transition-all ${CURRENT_SERVER === 's3' ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/30' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                            <div class="truncate">
                                <div class="truncate text-white font-bold text-[11px]">Edmunds (s3)</div>
                                <div class="text-[9px] text-zinc-400 font-normal truncate">Filmu Original Audio</div>
                            </div>
                            ${CURRENT_SERVER === 's3' ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1"></span>' : ''}
                        </button>
                    </div>
                </div>
            `;

            list.innerHTML = html;
            if (topBarAudioLabel) {
                topBarAudioLabel.textContent = activeName.length > 10 ? activeName.slice(0, 8) + '..' : activeName;
            }
            if (window.lucide) lucide.createIcons();
        }

        function setAudioTrack(trackIdx) {
            currentActiveAudioTrack = trackIdx;
            if (hlsInstance && hlsInstance.audioTracks && hlsInstance.audioTracks.length > trackIdx) {
                try {
                    hlsInstance.audioTrack = trackIdx;
                } catch (e) {
                    console.warn('HLS audio switch notice:', e);
                }
            }
            if (mainVideo && mainVideo.audioTracks && mainVideo.audioTracks.length > 0) {
                for (let i = 0; i < mainVideo.audioTracks.length; i++) {
                    mainVideo.audioTracks[i].enabled = (i === trackIdx);
                }
            }
            detectAndPopulateAudioTracks();
            const trackLabel = getAudioTrackLabel(trackIdx);
            showToast(`Audio Track: ${trackLabel}`);
        }

        let previousVideoTime = 0;

        function switchServerCluster(serverId) {
            if (CURRENT_SERVER === serverId) return;
            previousVideoTime = mainVideo.currentTime || 0;
            showToast(`Switching audio server to ${getServerName(serverId)}...`);
            fetchAndPlayStream(serverId, true);
        }

        function switchStreamUrl(url) {
            if (window.bingrActiveStreamUrl === url) return;
            previousVideoTime = mainVideo.currentTime || 0;
            window.bingrActiveStreamUrl = url;
            showToast(`Switching audio track stream...`);
            initHlsPlayer(url);
            toggleSubtitlesModal(false);
        }

        function openAudioModalTab() {
            toggleSubtitlesModal(true);
            switchSubTab('audio');
        }

        function openSubtitlesModalTab() {
            toggleSubtitlesModal(true);
            switchSubTab('subtitles');
        }

        /* ---------------- SUBTITLE TRACKS DETECTION & FETCHING ---------------- */
        let parsedSubtitleCues = [];

        function parseVttCues(vttText) {
            if (!vttText || typeof vttText !== 'string') return [];
            const cues = [];
            const lines = vttText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
            let i = 0;
            const timeRegex = /(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})/;

            function parseTimestamp(hours, mins, secs, ms) {
                const h = hours ? parseInt(hours, 10) : 0;
                const m = parseInt(mins, 10);
                const s = parseInt(secs, 10);
                const milli = parseInt(ms, 10);
                return h * 3600 + m * 60 + s + milli / 1000;
            }

            while (i < lines.length) {
                const line = lines[i].trim();
                const match = line.match(timeRegex);
                if (match) {
                    const start = parseTimestamp(match[1], match[2], match[3], match[4]);
                    const end = parseTimestamp(match[5], match[6], match[7], match[8]);
                    i++;
                    const textLines = [];
                    while (i < lines.length && lines[i].trim() !== '') {
                        let cleaned = lines[i].replace(/<[^>]+>/g, '').trim();
                        if (cleaned) textLines.push(cleaned);
                        i++;
                    }
                    if (textLines.length > 0) {
                        cues.push({
                            start: start,
                            end: end,
                            text: textLines.join('<br>')
                        });
                    }
                } else {
                    i++;
                }
            }
            return cues;
        }

        function updateSubtitleOverlay() {
            const overlayText = document.getElementById('customSubtitleText');
            if (!overlayText) return;

            if (currentActiveSubtitleTrack === -1 || !mainVideo) {
                overlayText.classList.add('hidden');
                return;
            }

            // High-precision memory cue overlay for loaded WebVTT / SRT
            if (parsedSubtitleCues && parsedSubtitleCues.length > 0) {
                const current = (mainVideo.currentTime || 0) + (subtitleSyncOffset || 0);
                const activeCue = parsedSubtitleCues.find(c => c.start <= current && current <= c.end);
                if (activeCue && activeCue.text) {
                    overlayText.innerHTML = activeCue.text;
                    overlayText.classList.remove('hidden');
                    return;
                } else {
                    overlayText.classList.add('hidden');
                    return;
                }
            }

            // HLS native track active cue detection
            if (mainVideo.textTracks) {
                for (let i = 0; i < mainVideo.textTracks.length; i++) {
                    const track = mainVideo.textTracks[i];
                    if (track.mode === 'showing' || track.mode === 'hidden') {
                        if (track.activeCues && track.activeCues.length > 0) {
                            const cue = track.activeCues[0];
                            const txt = cue.text || (cue.getCueAsHTML ? cue.getCueAsHTML().textContent : '');
                            if (txt) {
                                overlayText.innerHTML = txt.replace(/\n/g, '<br>');
                                overlayText.classList.remove('hidden');
                                return;
                            }
                        }
                    }
                }
            }

            overlayText.classList.add('hidden');
        }

        function detectAndPopulateSubtitleTracks() {
            populateSubtitlesList();
        }

        async function fetchExternalSubtitles() {
            try {
                const sParam = MEDIA_TYPE === 'tv' ? `&season=${MEDIA_SEASON}&episode=${MEDIA_EPISODE}` : '';
                const res = await fetch(`/api/subtitles/fetch?title=${encodeURIComponent(MEDIA_TITLE)}&id=${MEDIA_ID}${sParam}`);
                const data = await res.json();
                if (data && data.subtitles && Array.isArray(data.subtitles)) {
                    data.subtitles.forEach(sub => {
                        // Avoid duplicates by unique URL, but keep multiple distinct subtitle releases
                        if (!externalSubtitlesLoaded.some(e => e.url === sub.url)) {
                            const label = sub.display || (sub.source ? `[${sub.source}] ${sub.language || 'English'}` : (sub.language || 'English'));
                            externalSubtitlesLoaded.push({
                                lang: label,
                                url: sub.url,
                                id: sub.id
                            });
                        }
                    });
                    populateSubtitlesList();
                }
            } catch (err) {
                console.warn('External subtitles fetch notice:', err);
            }
        }

        function populateSubtitlesList() {
            const list = document.getElementById('subtitlesList');
            const countBadge = document.getElementById('subtitleTrackCountBadge');
            if (!list) return;

            let hlsSubs = [];
            if (hlsInstance && hlsInstance.subtitleTracks) {
                hlsSubs = hlsInstance.subtitleTracks;
            }

            const totalSubsCount = hlsSubs.length + externalSubtitlesLoaded.length;
            if (countBadge) countBadge.textContent = `${totalSubsCount} Available`;

            let html = `
                <button onclick="setSubtitleTrack(-1)" class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition-all ${currentActiveSubtitleTrack === -1 ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/25 shadow' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                    <span>Off</span>
                    ${currentActiveSubtitleTrack === -1 ? '<i data-lucide="check" class="w-4 h-4 text-white"></i>' : ''}
                </button>
            `;

            // Embedded HLS Subtitles
            hlsSubs.forEach((sub, idx) => {
                const isSelected = currentActiveSubtitleTrack === idx;
                const lang = sub.name || sub.lang || `Track ${idx + 1}`;
                html += `
                    <button onclick="setHlsSubtitleTrack(${idx})" class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition-all ${isSelected ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/25 shadow' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                        <div class="flex items-center gap-2 truncate">
                            <span class="truncate">${lang}</span>
                            <span class="text-[9px] px-1.5 py-0.5 rounded bg-red-600/20 text-red-300 font-bold uppercase">HLS</span>
                        </div>
                        ${isSelected ? '<i data-lucide="check" class="w-4 h-4 text-white"></i>' : ''}
                    </button>
                `;
            });

            // External Auto-fetched WebVTT Subtitles
            externalSubtitlesLoaded.forEach((sub, idx) => {
                const virtualId = 1000 + idx;
                const isSelected = currentActiveSubtitleTrack === virtualId;
                const lang = sub.lang || sub.label || `CC ${idx + 1}`;
                html += `
                    <button onclick="loadExternalSubtitle('${sub.url}', '${lang.replace(/'/g, "\\'")}', ${virtualId})" class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition-all ${isSelected ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/25 shadow' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                        <div class="flex items-center gap-2 truncate">
                            <span class="truncate">${lang}</span>
                            <span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-600/20 text-emerald-300 font-bold uppercase">WebVTT</span>
                        </div>
                        ${isSelected ? '<i data-lucide="check" class="w-4 h-4 text-white"></i>' : ''}
                    </button>
                `;
            });

            list.innerHTML = html;
            if (window.lucide) lucide.createIcons();
        }

        function setHlsSubtitleTrack(trackIdx) {
            currentActiveSubtitleTrack = trackIdx;
            parsedSubtitleCues = [];
            if (hlsInstance) {
                hlsInstance.subtitleTrack = trackIdx;
            }
            populateSubtitlesList();
            updateSubtitleOverlay();
            showToast('HLS Subtitle Activated');
        }

        function setSubtitleTrack(trackIdx) {
            currentActiveSubtitleTrack = -1;
            parsedSubtitleCues = [];
            if (hlsInstance) {
                hlsInstance.subtitleTrack = -1;
            }
            if (mainVideo && mainVideo.textTracks) {
                for (let i = 0; i < mainVideo.textTracks.length; i++) {
                    mainVideo.textTracks[i].mode = 'disabled';
                }
            }
            const overlayText = document.getElementById('customSubtitleText');
            if (overlayText) overlayText.classList.add('hidden');
            populateSubtitlesList();
            showToast('Subtitles Disabled');
        }

        async function loadExternalSubtitle(url, label, virtualId) {
            currentActiveSubtitleTrack = virtualId !== undefined ? virtualId : 9999;
            if (hlsInstance) hlsInstance.subtitleTrack = -1;

            let safeUrl = url;
            if (url.startsWith('http') && !url.includes('/api/subtitles/vtt')) {
                safeUrl = `/api/subtitles/vtt?url=${encodeURIComponent(url)}`;
            }

            showToast(`Loading: ${label}...`);

            // 1. Fetch text and parse into in-memory cues for guaranteed custom overlay rendering
            try {
                const res = await fetch(safeUrl);
                if (res.ok) {
                    const text = await res.text();
                    parsedSubtitleCues = parseVttCues(text);
                    console.log(`[Subtitles] Loaded ${parsedSubtitleCues.length} cues for: ${label}`);
                }
            } catch (err) {
                console.warn('[Subtitles] Overlay parsing warning:', err);
            }

            // 2. Attach as native HTML5 track as secondary fallback
            const existing = mainVideo.querySelectorAll('track');
            existing.forEach(t => t.remove());

            const track = document.createElement('track');
            track.kind = 'subtitles';
            track.label = label || 'Subtitle';
            track.srclang = 'en';
            track.src = safeUrl;
            track.default = true;
            mainVideo.appendChild(track);

            setTimeout(() => {
                if (mainVideo.textTracks) {
                    const tracks = Array.from(mainVideo.textTracks);
                    tracks.forEach(t => t.mode = 'disabled');
                    const target = tracks.find(t => t.label === (label || 'Subtitle'));
                    if (target) {
                        target.mode = 'hidden'; // 'hidden' keeps cues active without double native rendering
                    }
                }
            }, 200);

            applySubtitleStyles();
            updateSubtitleOverlay();
            populateSubtitlesList();
            showToast(`Active: ${label}`);
        }

        function setupSubtitlesUploader() {
            const input = document.getElementById('customSubInput');
            if (!input) return;
            input.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                    const text = await file.text();
                    parsedSubtitleCues = parseVttCues(text);
                    currentActiveSubtitleTrack = 8888;
                    if (hlsInstance) hlsInstance.subtitleTrack = -1;
                    applySubtitleStyles();
                    updateSubtitleOverlay();
                    populateSubtitlesList();
                    showToast(`Uploaded Subtitle: ${file.name}`);
                } catch (err) {
                    showToast('Failed to read subtitle file');
                }
            });
        }

        /* ---------------- TABS SWITCHER FOR SUBTITLES & AUDIO ---------------- */
        function switchSubTab(tab) {
            const btnAudio = document.getElementById('tabAudioBtn');
            const btnSubs = document.getElementById('tabSubtitlesBtn');
            const btnVisual = document.getElementById('tabVisualBtn');
            const contentAudio = document.getElementById('tabContentAudio');
            const contentSubs = document.getElementById('tabContentSubtitles');
            const contentVisual = document.getElementById('tabContentVisual');

            [btnAudio, btnSubs, btnVisual].forEach(b => {
                b.className = 'py-1.5 text-xs font-bold rounded-lg transition-all text-zinc-400 hover:text-white';
            });
            [contentAudio, contentSubs, contentVisual].forEach(c => c.classList.add('hidden'));

            if (tab === 'audio') {
                btnAudio.className = 'py-1.5 text-xs font-bold rounded-lg transition-all bg-red-600 text-white shadow';
                contentAudio.classList.remove('hidden');
                detectAndPopulateAudioTracks();
            } else if (tab === 'subtitles') {
                btnSubs.className = 'py-1.5 text-xs font-bold rounded-lg transition-all bg-red-600 text-white shadow';
                contentSubs.classList.remove('hidden');
                populateSubtitlesList();
            } else if (tab === 'visual') {
                btnVisual.className = 'py-1.5 text-xs font-bold rounded-lg transition-all bg-red-600 text-white shadow';
                contentVisual.classList.remove('hidden');
            }
        }

        function populateQualityLevels(levels) {
            const list = document.getElementById('qualityList');
            if (!list || !levels || levels.length === 0) return;

            list.innerHTML = `
                <button onclick="setQualityLevel(-1)" id="quality-btn-auto" class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold text-left hover:bg-white/10 transition-colors glass-sub-panel bg-white/15 text-white">
                    <span>Auto (Adaptive)</span>
                    <i data-lucide="check" class="w-3.5 h-3.5 text-white"></i>
                </button>
            `;

            levels.forEach((lvl, idx) => {
                const height = lvl.height || 'HD';
                const btn = document.createElement('button');
                btn.id = 'quality-btn-' + idx;
                btn.className = 'w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold text-left text-zinc-300 hover:bg-white/10 transition-colors glass-sub-panel';
                btn.onclick = () => setQualityLevel(idx);
                btn.innerHTML = '<span>' + height + (typeof height === 'number' ? 'p' : '') + '</span>';
                list.appendChild(btn);
            });

            if (window.lucide) lucide.createIcons();
        }

        function setQualityLevel(levelIndex) {
            if (!hlsInstance) return;
            hlsInstance.currentLevel = levelIndex;
            
            const list = document.getElementById('qualityList');
            const buttons = list.querySelectorAll('button');
            buttons.forEach(b => {
                b.classList.remove('bg-white/15', 'text-white');
                b.classList.add('text-zinc-300');
                const chk = b.querySelector('[data-lucide="check"]');
                if (chk) chk.remove();
            });

            const targetBtn = levelIndex === -1 ? document.getElementById('quality-btn-auto') : document.getElementById('quality-btn-' + levelIndex);
            if (targetBtn) {
                targetBtn.classList.add('bg-white/15', 'text-white');
                targetBtn.classList.remove('text-zinc-300');
                const checkIcon = document.createElement('i');
                checkIcon.setAttribute('data-lucide', 'check');
                checkIcon.className = 'w-3.5 h-3.5 text-white';
                targetBtn.appendChild(checkIcon);
            }

            updateQualityButtonLabel();
            if (window.lucide) lucide.createIcons();
        }

        function updateQualityButtonLabel() {
            const btnLabel = document.getElementById('qualityButtonLabel');
            const btnLabelMob = document.getElementById('qualityButtonLabelMob');
            if (!hlsInstance) return;

            let text = '1080p';
            if (hlsInstance.autoLevelEnabled) {
                const cur = hlsInstance.levels[hlsInstance.currentLevel];
                const res = cur ? (cur.height + 'p') : '1080p';
                text = 'Auto • ' + res;
            } else {
                const cur = hlsInstance.levels[hlsInstance.currentLevel];
                const res = cur ? (cur.height + 'p') : '1080p';
                text = res;
            }

            if (btnLabel) btnLabel.textContent = text;
            if (btnLabelMob) btnLabelMob.textContent = text;
        }

        async function loadServerList() {
            try {
                const res = await fetch('/api/bingr/servers');
                const data = await res.json();
                if (data.status === 'success' && data.servers) {
                    availableServers = data.servers;
                } else {
                    availableServers = DEFAULT_SERVERS;
                }
            } catch (e) {
                availableServers = DEFAULT_SERVERS;
            }
            renderServerList();
        }

        function renderServerList() {
            const list = document.getElementById('serverList');
            if (!list) return;

            list.innerHTML = availableServers.map(srv => {
                const isSelected = srv.id === CURRENT_SERVER;
                const flag = srv.cc === 'IN' ? '🇮🇳' : (srv.cc === 'US' ? '🇺🇸' : (srv.cc === 'IT' ? '🇮🇹' : (srv.cc === 'IS' ? '🇮🇸' : '⚡')));
                return `
                    <button onclick="switchServer('${srv.id}')" class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold text-left transition-all ${isSelected ? 'glass-sub-panel bg-white/20 text-white ring-1 ring-white/20' : 'glass-sub-panel text-zinc-300 hover:bg-white/10'}">
                        <span class="truncate">${flag} ${srv.name.split('(')[0].trim()}</span>
                        ${isSelected ? '<i data-lucide="check" class="w-3.5 h-3.5 text-white shrink-0 ml-1"></i>' : ''}
                    </button>
                `;
            }).join('');

            if (window.lucide) lucide.createIcons();
        }

        function updateServerListUI() {
            renderServerList();
        }

        function switchServer(serverId) {
            if (serverId === CURRENT_SERVER) return;
            const curTime = (mainVideo && !isNaN(mainVideo.currentTime)) ? mainVideo.currentTime : 0;
            if (curTime > 0) previousVideoTime = curTime;
            toggleQualityServerModal(false);
            fetchAndPlayStream(serverId, true);
        }

        function getServerName(id) {
            const s = availableServers.find(x => x.id === id);
            return s ? s.name : id;
        }

        function triggerAutoReconnect() {
            showToast('Reconnecting Stream...');
            const curTime = (mainVideo && !isNaN(mainVideo.currentTime)) ? mainVideo.currentTime : 0;
            if (curTime > 0) previousVideoTime = curTime;
            fetchAndPlayStream(CURRENT_SERVER, true);
        }

        function toggleAspectRatio() {
            currentAspectMode = (currentAspectMode + 1) % 4;
            mainVideo.classList.remove('fit-cover', 'fit-fill', 'zoom-120');

            let modeName = 'Fit to Screen';
            if (currentAspectMode === 1) {
                mainVideo.classList.add('fit-cover');
                modeName = 'Cover (Fill Viewport)';
            } else if (currentAspectMode === 2) {
                mainVideo.classList.add('fit-fill');
                modeName = 'Stretch to Fill (16:9)';
            } else if (currentAspectMode === 3) {
                mainVideo.classList.add('zoom-120');
                modeName = 'Cinema Zoom (120%)';
            }
            showToast(modeName);
        }

        function toggleRotation() {
            currentRotation = (currentRotation + 90) % 360;
            const container = document.getElementById('playerContainer');
            if (currentRotation === 90 || currentRotation === 270) {
                container.style.width = window.innerHeight + 'px';
                container.style.height = window.innerWidth + 'px';
                container.style.transform = `translate(-50%, -50%) rotate(${currentRotation}deg)`;
                container.style.position = 'fixed';
                container.style.top = '50%';
                container.style.left = '50%';
            } else {
                container.style.width = '100%';
                container.style.height = '100%';
                container.style.position = 'relative';
                container.style.top = 'auto';
                container.style.left = 'auto';
                container.style.transform = `rotate(${currentRotation}deg)`;
            }
            showToast('Rotated ' + currentRotation + '°');
        }

        function togglePiP() {
            if (document.pictureInPictureElement) {
                document.exitPictureInPicture().catch(() => {});
            } else if (mainVideo && document.pictureInPictureEnabled) {
                mainVideo.requestPictureInPicture().catch(() => {});
            }
        }

        function togglePartyMode() {
            if (typeof window.togglePartyModal === 'function') {
                window.togglePartyModal(true);
            } else {
                showToast('Party Mode Ready');
            }
        }

        function showToast(text) {
            zoomIndicator.textContent = text;
            zoomIndicator.style.opacity = '1';
            zoomIndicator.style.transform = 'translateX(-50%) translateY(0)';
            setTimeout(() => {
                zoomIndicator.style.opacity = '0';
                zoomIndicator.style.transform = 'translateX(-50%) translateY(-10px)';
            }, 2500);
        }

        /* ---------------- ANIMATED PLAY / PAUSE LOGIC ---------------- */
        function updatePlayPauseIcons(isPlaying) {
            const pairs = [
                { play: document.getElementById('playIcon'), pause: document.getElementById('pauseIcon') },
                { play: document.getElementById('playIconMob'), pause: document.getElementById('pauseIconMob') }
            ];
            pairs.forEach(p => {
                if (p.play && p.pause) {
                    if (isPlaying) {
                        p.play.classList.add('hidden', 'scale-75', 'opacity-0');
                        p.play.classList.remove('scale-100', 'opacity-100');
                        p.pause.classList.remove('hidden', 'scale-75', 'opacity-0');
                        p.pause.classList.add('scale-100', 'opacity-100');
                    } else {
                        p.play.classList.remove('hidden', 'scale-75', 'opacity-0');
                        p.play.classList.add('scale-100', 'opacity-100');
                        p.pause.classList.add('hidden', 'scale-75', 'opacity-0');
                        p.pause.classList.remove('scale-100', 'opacity-100');
                    }
                }
            });
        }

        function togglePlayPause() {
            if (mainVideo.paused) {
                safePlayVideo();
                showCenterBurst('play');
            } else {
                safePauseVideo();
                showCenterBurst('pause');
            }
        }

        mainVideo.addEventListener('play', () => {
            updatePlayPauseIcons(true);
            mediaHudOverlay.classList.remove('opacity-100');
            mediaHudOverlay.classList.add('opacity-0', 'pointer-events-none');
        });

        mainVideo.addEventListener('pause', () => {
            updatePlayPauseIcons(false);
            if (playerMode !== 'embed' && mediaHudOverlay) {
                mediaHudOverlay.classList.remove('opacity-0', 'pointer-events-none', 'hidden');
                mediaHudOverlay.classList.add('opacity-100');
            }
            showControls(true);
        });

        mainVideo.addEventListener('click', () => {
            togglePlayPause();
        });

        function seekRelative(seconds) {
            mainVideo.currentTime = Math.max(0, Math.min(mainVideo.duration || 0, mainVideo.currentTime + seconds));
            showCenterBurst(seconds > 0 ? 'forward' : 'rewind');
        }

        function setPlaybackSpeed(speed, btnEl) {
            mainVideo.playbackRate = speed;
            document.querySelectorAll('.speed-btn').forEach(b => {
                b.className = 'speed-btn px-2 py-1 rounded-lg text-[10px] font-bold text-zinc-400 hover:text-white transition-all';
            });
            if (btnEl) {
                btnEl.className = 'speed-btn px-2 py-1 rounded-lg text-[10px] font-bold bg-white text-black transition-all shadow';
            }
        }

        function setVolume(val) {
            mainVideo.volume = parseFloat(val);
            mainVideo.muted = false;
            updateVolumeIcon();
        }

        function toggleMute() {
            mainVideo.muted = !mainVideo.muted;
            updateVolumeIcon();
        }

        function updateVolumeIcon() {
            const icon = document.getElementById('volumeIcon');
            const iconMob = document.getElementById('volumeIconMob');
            const iconName = (mainVideo.muted || mainVideo.volume === 0) 
                ? 'volume-x' 
                : (mainVideo.volume < 0.5 ? 'volume-1' : 'volume-2');
            
            if (icon) icon.setAttribute('data-lucide', iconName);
            if (iconMob) iconMob.setAttribute('data-lucide', iconName);
            if (window.lucide) lucide.createIcons();
        }

        function setupTimeline() {
            mainVideo.addEventListener('timeupdate', () => {
                if (isScrubbing) return;
                const current = mainVideo.currentTime || 0;
                const duration = mainVideo.duration || 1;
                const pct = (current / duration) * 100;
                timelineProgress.style.width = pct + '%';
                timelineThumb.style.left = pct + '%';
                
                const curFmt = formatTime(current);
                const durFmt = formatTime(duration);
                if (timeCurrent) timeCurrent.textContent = curFmt;
                if (timeDuration) timeDuration.textContent = durFmt;
                const timeCurrentMob = document.getElementById('timeCurrentMob');
                const timeDurationMob = document.getElementById('timeDurationMob');
                if (timeCurrentMob) timeCurrentMob.textContent = curFmt;
                if (timeDurationMob) timeDurationMob.textContent = durFmt;

                // AniSkip / Skip Intro & Outro triggers (strictly for pure 'op' and 'ed', excluding mixed-op and mixed-ed)
                let matchedAniSkip = null;
                if (aniSkipResults && aniSkipResults.length > 0) {
                    matchedAniSkip = aniSkipResults.find(s => {
                        const t = (s.skipType || '').toLowerCase().trim();
                        // Skip intro and outro ONLY for intro (op) and outro (ed), NOT for mixed opening and ending
                        if (t !== 'op' && t !== 'ed') return false;
                        const start = Math.max(0, (s.interval.startTime || 0) - 0.25);
                        return current >= start && current < s.interval.endTime;
                    });
                }

                if (matchedAniSkip && current >= 0) {
                    activeAniSkipSegment = matchedAniSkip;
                    const segId = matchedAniSkip.skipId || `${matchedAniSkip.skipType}_${Math.round(matchedAniSkip.interval.startTime)}`;

                    if (aniSkipAutoSkip) {
                        if (lastAutoSkippedId !== segId) {
                            lastAutoSkippedId = segId;
                            const targetTime = Math.min(duration, matchedAniSkip.interval.endTime + 0.5);
                            mainVideo.currentTime = targetTime;
                            showToast('⚡ Auto-Skipped ' + getSkipTypeName(matchedAniSkip.skipType));
                        }
                        if (btnSkipIntro) {
                            btnSkipIntro.classList.remove('show');
                            btnSkipIntro.classList.add('hidden');
                        }
                    } else {
                        if (btnSkipIntro) {
                            btnSkipIntro.classList.remove('hidden');
                            btnSkipIntro.classList.add('show');
                            const typeName = getSkipTypeName(matchedAniSkip.skipType);
                            const rem = Math.max(0, Math.ceil(matchedAniSkip.interval.endTime - current));
                            if (skipIntroText) skipIntroText.textContent = `Skip ${typeName} (${rem}s)`;
                            if (skipIntroIcon) {
                                if (matchedAniSkip.skipType === 'op') {
                                    skipIntroIcon.setAttribute('data-lucide', 'zap');
                                    btnSkipIntro.style.borderColor = 'rgba(251, 191, 36, 0.7)';
                                } else if (matchedAniSkip.skipType === 'ed') {
                                    skipIntroIcon.setAttribute('data-lucide', 'skip-forward');
                                    btnSkipIntro.style.borderColor = 'rgba(192, 132, 252, 0.7)';
                                } else {
                                    skipIntroIcon.setAttribute('data-lucide', 'fast-forward');
                                    btnSkipIntro.style.borderColor = 'rgba(56, 189, 248, 0.7)';
                                }
                                if (window.lucide) lucide.createIcons();
                            }
                        }
                    }
                } else {
                    activeAniSkipSegment = null;
                    if (lastAutoSkippedId && (!aniSkipResults || !aniSkipResults.some(s => {
                        const sid = s.skipId || `${s.skipType}_${Math.round(s.interval.startTime)}`;
                        const isIntro = s.skipType === 'op';
                        const start = isIntro ? 0 : Math.max(0, s.interval.startTime);
                        return sid === lastAutoSkippedId && current >= start;
                    }))) {
                        lastAutoSkippedId = null;
                    }

                    // Heuristic fallback for standard series (starting from 00 up to 90s) if no AniSkip entries loaded
                    if (current >= 0 && current <= 90 && (!aniSkipResults || aniSkipResults.length === 0)) {
                        if (btnSkipIntro) {
                            btnSkipIntro.classList.remove('hidden');
                            btnSkipIntro.classList.add('show');
                            if (skipIntroText) skipIntroText.textContent = 'Skip Intro';
                            if (skipIntroIcon) skipIntroIcon.setAttribute('data-lucide', 'fast-forward');
                            btnSkipIntro.style.borderColor = '';
                            if (window.lucide) lucide.createIcons();
                        }
                    } else {
                        if (btnSkipIntro) {
                            btnSkipIntro.classList.remove('show');
                            btnSkipIntro.classList.add('hidden');
                        }
                    }
                }

                // Next Episode trigger
                if (MEDIA_TYPE === 'tv' && duration > 120 && (duration - current) <= 120) {
                    if (btnNextEpisode) {
                        btnNextEpisode.classList.remove('hidden');
                        btnNextEpisode.classList.add('show');
                    }
                } else {
                    if (btnNextEpisode) {
                        btnNextEpisode.classList.remove('show');
                        btnNextEpisode.classList.add('hidden');
                    }
                }

                // High-precision custom subtitle overlay update
                updateSubtitleOverlay();
            });

            mainVideo.addEventListener('seeked', () => {
                updateSubtitleOverlay();
            });

            mainVideo.addEventListener('ended', () => {
                if (MEDIA_TYPE === 'tv') {
                    showToast('Episode finished! Auto-playing next episode...');
                    setTimeout(() => {
                        playNextEpisode();
                    }, 1200);
                } else {
                    const firstRec = window.recommendations && window.recommendations.length > 0 ? window.recommendations[0] : null;
                    if (firstRec) {
                        showToast('Movie finished! Auto-playing recommended movie...');
                        setTimeout(() => {
                            switchMovie(firstRec.id, firstRec.media_type || 'movie', firstRec.title || firstRec.name);
                        }, 5000);
                    }
                }
            });

            mainVideo.addEventListener('loadedmetadata', () => {
                updateTimelineAniSkipMarkers();
            });

            mainVideo.addEventListener('durationchange', () => {
                updateTimelineAniSkipMarkers();
            });

            mainVideo.addEventListener('progress', () => {
                if (mainVideo.buffered.length > 0) {
                    const bufferedEnd = mainVideo.buffered.end(mainVideo.buffered.length - 1);
                    const duration = mainVideo.duration || 1;
                    timelineBuffer.style.width = ((bufferedEnd / duration) * 100) + '%';
                }
            });

            timelineContainer.addEventListener('mousedown', (e) => {
                isScrubbing = true;
                timelineContainer.classList.add('is-scrubbing');
                seekWithEvent(e);
            });

            window.addEventListener('mousemove', (e) => {
                if (isScrubbing) seekWithEvent(e);
                updateTimelineTooltip(e);
            });

            window.addEventListener('mouseup', () => {
                if (isScrubbing) {
                    isScrubbing = false;
                    timelineContainer.classList.remove('is-scrubbing');
                }
            });

            timelineContainer.addEventListener('touchstart', (e) => {
                isScrubbing = true;
                timelineContainer.classList.add('is-scrubbing');
                if (e.touches[0]) seekWithEvent(e.touches[0]);
            }, { passive: true });

            window.addEventListener('touchmove', (e) => {
                if (isScrubbing && e.touches[0]) seekWithEvent(e.touches[0]);
            }, { passive: true });

            window.addEventListener('touchend', () => {
                if (isScrubbing) {
                    isScrubbing = false;
                    if (timelineContainer) timelineContainer.classList.remove('is-scrubbing');
                }
            });
        }

        function seekWithEvent(e) {
            if (!timelineContainer) return;
            const rect = timelineContainer.getBoundingClientRect();
            if (!rect || !rect.width) return;
            const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const duration = mainVideo ? (mainVideo.duration || 0) : 0;
            const targetTime = pos * duration;
            if (mainVideo) mainVideo.currentTime = targetTime;
            if (timelineProgress) timelineProgress.style.width = (pos * 100) + '%';
            if (timelineThumb) timelineThumb.style.left = (pos * 100) + '%';
            if (timeCurrent) timeCurrent.textContent = formatTime(targetTime);
        }

        function updateTimelineTooltip(e) {
            if (!timelineContainer || !timelineTooltip) return;
            const rect = timelineContainer.getBoundingClientRect();
            if (!rect || !rect.width) return;
            if (e.clientY >= rect.top - 20 && e.clientY <= rect.bottom + 20 && e.clientX >= rect.left && e.clientX <= rect.right) {
                const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const duration = mainVideo ? (mainVideo.duration || 0) : 0;
                const targetTime = pos * duration;
                timelineTooltip.textContent = formatTime(targetTime);
                timelineTooltip.style.left = (pos * 100) + '%';
                timelineTooltip.style.opacity = '1';
            } else {
                timelineTooltip.style.opacity = '0';
            }
        }

        function skipIntro() {
            if (!mainVideo) return;
            if (activeAniSkipSegment && activeAniSkipSegment.interval) {
                const targetTime = Math.min(mainVideo.duration || 0, activeAniSkipSegment.interval.endTime + 0.5);
                mainVideo.currentTime = targetTime;
                showToast('Skipped ' + getSkipTypeName(activeAniSkipSegment.skipType));
            } else {
                mainVideo.currentTime = Math.min(mainVideo.duration || 0, (mainVideo.currentTime || 0) + 85);
                showToast('Skipped Intro (+85s)');
            }
            if (btnSkipIntro) {
                btnSkipIntro.classList.remove('show');
                btnSkipIntro.classList.add('hidden');
            }
        }

        function playNextEpisode() {
            const nextEp = MEDIA_EPISODE + 1;
            switchEpisode(MEDIA_SEASON, nextEp);
        }

        function formatTime(sec) {
            if (isNaN(sec) || sec < 0) return '0:00';
            const h = Math.floor(sec / 3600);
            const m = Math.floor((sec % 3600) / 60);
            const s = Math.floor(sec % 60);
            if (h > 0) {
                return h + ':' + m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0');
            }
            return m + ':' + s.toString().padStart(2, '0');
        }

        function setupControlsAutoHide() {
            window.addEventListener('mousemove', () => resetControlsTimer());
            window.addEventListener('touchstart', () => resetControlsTimer(), { passive: true });
            window.addEventListener('touchmove', () => resetControlsTimer(), { passive: true });
            window.addEventListener('click', () => resetControlsTimer());
            resetControlsTimer();
        }

        function resetControlsTimer() {
            showControls(true);
            clearTimeout(controlsTimeout);
            const shouldAutoHide = playerMode === 'embed' || (mainVideo && !mainVideo.paused);
            if (shouldAutoHide) {
                controlsTimeout = setTimeout(() => {
                    showControls(false);
                }, 3500);
            }
        }

        function showControls(show) {
            const isModalOpen = (qualityServerModal && !qualityServerModal.classList.contains('hidden')) || 
                                (subtitlesModal && !subtitlesModal.classList.contains('hidden')) || 
                                (aniSkipModal && !aniSkipModal.classList.contains('hidden')) ||
                                (moreLikeThisTray && !moreLikeThisTray.classList.contains('translate-y-full')) ||
                                (episodesDrawer && !episodesDrawer.classList.contains('translate-y-full')) ||
                                (sleepModal && !sleepModal.classList.contains('hidden'));
            const embedTouchSensor = document.getElementById('embedTouchSensor');
            const isPaused = mainVideo ? mainVideo.paused : false;
            
            if (show || isModalOpen || (playerMode !== 'embed' && isPaused)) {
                if (topControlsBar) topControlsBar.classList.remove('opacity-0', 'pointer-events-none');
                if (bottomControlsBar && playerMode !== 'embed') bottomControlsBar.classList.remove('opacity-0', 'pointer-events-none');
                document.body.style.cursor = 'default';
                if (embedTouchSensor) embedTouchSensor.classList.add('hidden');
            } else {
                if (topControlsBar) topControlsBar.classList.add('opacity-0', 'pointer-events-none');
                if (bottomControlsBar) bottomControlsBar.classList.add('opacity-0', 'pointer-events-none');
                document.body.style.cursor = 'none';
                if (playerMode === 'embed' && embedTouchSensor) {
                    embedTouchSensor.classList.remove('hidden');
                }
            }
        }

        function closeAllOpenModals(closeBackdrop = true) {
            if (qualityServerModal) qualityServerModal.classList.add('hidden');
            if (subtitlesModal) subtitlesModal.classList.add('hidden');
            if (aniSkipModal) aniSkipModal.classList.add('hidden');
            if (sleepModal) sleepModal.classList.add('hidden');
            const sheet = document.getElementById('mobileMoreMenuSheet');
            if (sheet) sheet.classList.add('hidden');
            const backdrop = document.getElementById('mobileModalBackdrop');
            if (backdrop && closeBackdrop) backdrop.classList.add('hidden');
        }

        function toggleMobileMoreMenu(force) {
            const sheet = document.getElementById('mobileMoreMenuSheet');
            const backdrop = document.getElementById('mobileModalBackdrop');
            if (!sheet) return;
            const isHidden = sheet.classList.contains('hidden');
            const target = force !== undefined ? !force : !isHidden;
            if (target) {
                sheet.classList.add('hidden');
                if (backdrop) backdrop.classList.add('hidden');
            } else {
                closeAllOpenModals(false);
                sheet.classList.remove('hidden');
                if (backdrop) backdrop.classList.remove('hidden');
                updateMobileStatusBadges();
            }
        }

        function updateMobileStatusBadges() {
            const aspectBadge = document.getElementById('mobAspectBadge');
            if (aspectBadge) {
                const modes = ['Fit', 'Cover', 'Stretch', 'Zoom'];
                aspectBadge.textContent = modes[currentAspectMode] || 'Fit';
            }
            const rotateBadge = document.getElementById('mobRotateBadge');
            if (rotateBadge) {
                rotateBadge.textContent = currentRotation + '°';
            }
            const sleepBadge = document.getElementById('mobSleepBadge');
            if (sleepBadge) {
                sleepBadge.textContent = sleepTimerId ? 'Active' : 'Off';
            }
            const epBtn = document.getElementById('mobBtnEpisodes');
            if (epBtn) {
                if (MEDIA_TYPE === 'tv') {
                    epBtn.classList.remove('hidden');
                } else {
                    epBtn.classList.add('hidden');
                }
            }
        }

        function toggleQualityServerModal(force) {
            const isHidden = qualityServerModal.classList.contains('hidden');
            const target = force !== undefined ? !force : !isHidden;
            const backdrop = document.getElementById('mobileModalBackdrop');
            if (target) {
                qualityServerModal.classList.add('hidden');
                if (backdrop) backdrop.classList.add('hidden');
            } else {
                closeAllOpenModals(false);
                qualityServerModal.classList.remove('hidden');
                if (backdrop) backdrop.classList.remove('hidden');
                updateServerListUI();
            }
        }

        function toggleSubtitlesModal(force) {
            const isHidden = subtitlesModal.classList.contains('hidden');
            const target = force !== undefined ? !force : !isHidden;
            const backdrop = document.getElementById('mobileModalBackdrop');
            if (target) {
                subtitlesModal.classList.add('hidden');
                if (backdrop) backdrop.classList.add('hidden');
            } else {
                closeAllOpenModals(false);
                subtitlesModal.classList.remove('hidden');
                if (backdrop) backdrop.classList.remove('hidden');
                detectAndPopulateAudioTracks();
                populateSubtitlesList();
            }
        }

        // ==========================================
        // ANISKIP TIMESTAMPS CONTROLLER (MAL ID)
        // ==========================================
        function getSkipTypeName(type) {
            if (!type) return 'Intro';
            switch (type) {
                case 'op': return 'Opening';
                case 'ed': return 'Ending';
                case 'mixed-op': return 'Mixed Opening';
                case 'mixed-ed': return 'Mixed Ending';
                case 'recap': return 'Recap';
                default: return type.toUpperCase();
            }
        }

        function toggleAniSkipModal(force) {
            if (!aniSkipModal) return;
            const isHidden = aniSkipModal.classList.contains('hidden');
            const target = force !== undefined ? !force : !isHidden;
            const backdrop = document.getElementById('mobileModalBackdrop');
            if (target) {
                aniSkipModal.classList.add('hidden');
                if (backdrop) backdrop.classList.add('hidden');
            } else {
                closeAllOpenModals(false);
                aniSkipModal.classList.remove('hidden');
                if (backdrop) backdrop.classList.remove('hidden');
                if (inputMalId && MAL_ID) inputMalId.value = MAL_ID;
            }
            if (window.lucide) lucide.createIcons();
        }

        function toggleAniSkipAuto(checked) {
            aniSkipAutoSkip = checked;
            localStorage.setItem('stalker_aniskip_autoskip', checked ? 'true' : 'false');
            showToast(`AniSkip Auto-Skip: ${checked ? 'Enabled' : 'Disabled'}`);
        }

        function seekToAniSkip(sec) {
            if (mainVideo) mainVideo.currentTime = sec;
            toggleAniSkipModal(false);
            showToast(`Seeked to ${formatTime(sec)}`);
        }

        function applyCustomMalId() {
            const val = inputMalId ? inputMalId.value.trim() : '';
            if (!val || isNaN(parseInt(val, 10))) {
                showToast('Please enter a valid numeric MAL ID');
                return;
            }
            MAL_ID = parseInt(val, 10);
            window.MAL_ID = MAL_ID;
            saveStoredMalId(MAL_ID);
            
            try {
                const url = new URL(window.location.href);
                url.searchParams.set('malId', MAL_ID);
                window.history.replaceState({}, '', url.toString());
            } catch (e) {}

            showToast(`MAL ID #${MAL_ID} Saved`);
            fetchAniSkipData(MAL_ID, MEDIA_EPISODE);
        }

        function setQuickMalPreset(malId, name) {
            if (inputMalId) inputMalId.value = malId;
            MAL_ID = parseInt(malId, 10);
            window.MAL_ID = MAL_ID;
            saveStoredMalId(MAL_ID);

            try {
                const url = new URL(window.location.href);
                url.searchParams.set('malId', MAL_ID);
                window.history.replaceState({}, '', url.toString());
            } catch (e) {}

            showToast(`Preset: ${name} (MAL #${malId})`);
            fetchAniSkipData(MAL_ID, MEDIA_EPISODE);
        }

        async function autoDetectMalId(showFeedback = true) {
            const titleToSearch = MEDIA_TITLE || '';
            if (!titleToSearch || titleToSearch === 'Cinema Presentation') {
                if (showFeedback) showToast('No title available to detect MAL ID');
                return;
            }
            if (showFeedback) showToast(`Detecting MAL ID for "${titleToSearch}"...`);
            if (aniSkipStatusBadge) {
                aniSkipStatusBadge.textContent = 'Searching MAL...';
                aniSkipStatusBadge.className = 'text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold animate-pulse';
            }

            try {
                const res = await fetch(`/api/anime/mal/resolve?title=${encodeURIComponent(titleToSearch)}`);
                const data = await res.json();
                if (data && data.found && data.malId) {
                    MAL_ID = parseInt(data.malId, 10);
                    window.MAL_ID = MAL_ID;
                    saveStoredMalId(MAL_ID);
                    if (inputMalId) inputMalId.value = MAL_ID;
                    try {
                        const url = new URL(window.location.href);
                        url.searchParams.set('malId', MAL_ID);
                        window.history.replaceState({}, '', url.toString());
                    } catch (e) {}
                    if (showFeedback) showToast(`Found MAL ID #${data.malId} (${data.title || titleToSearch})`);
                    fetchAniSkipData(MAL_ID, MEDIA_EPISODE);
                } else {
                    if (showFeedback) showToast(`Could not auto-detect MAL ID. Please enter manually.`);
                    if (aniSkipStatusBadge) {
                        aniSkipStatusBadge.textContent = 'Manual Entry Needed';
                        aniSkipStatusBadge.className = 'text-[9px] px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300 font-bold';
                    }
                }
            } catch (e) {
                console.warn('Auto detect MAL failed:', e);
                if (showFeedback) showToast('Auto-detection error. Enter MAL ID directly.');
            }
        }

        async function fetchAniSkipData(malId, episode) {
            episode = parseInt(episode || MEDIA_EPISODE || 1, 10);
            aniSkipCurrentRequestEp = episode;
            const targetEp = episode;

            if (aniSkipEpisodeDisplay) aniSkipEpisodeDisplay.textContent = episode;
            if (aniSkipStatusBadge) {
                aniSkipStatusBadge.textContent = `Catching Ep ${episode}...`;
                aniSkipStatusBadge.className = 'text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold animate-pulse';
            }

            const epLength = Math.floor(mainVideo ? (mainVideo.duration || 0) : 0);
            const effectiveMalId = malId || MAL_ID || getStoredMalId();

            try {
                let response = null;
                // Query server skip-times proxy
                try {
                    const qParams = new URLSearchParams();
                    if (effectiveMalId) qParams.set('malId', effectiveMalId);
                    if (MEDIA_TITLE && MEDIA_TITLE !== 'Cinema Presentation') qParams.set('title', MEDIA_TITLE);
                    qParams.set('episode', episode);
                    if (epLength > 0) qParams.set('episodeLength', epLength);

                    response = await fetch(`/api/anime/skip-times?${qParams.toString()}`);
                } catch (e) {
                    console.warn('Backend skip-times proxy failed, trying public aniskip API directly', e);
                }

                if ((!response || !response.ok) && effectiveMalId) {
                    response = await fetch(`https://api.aniskip.com/v2/skip-times/${effectiveMalId}/${episode}?types=op&types=ed&episodeLength=${epLength}`);
                }

                if (!response) {
                    throw new Error('AniSkip service unreachable');
                }

                const data = await response.json();

                // If user switched to another episode while this request was running, discard stale data
                if (targetEp !== MEDIA_EPISODE) {
                    console.log(`Discarding AniSkip data for Ep ${targetEp}, current is Ep ${MEDIA_EPISODE}`);
                    return;
                }

                if (data && data.malId && !MAL_ID) {
                    MAL_ID = parseInt(data.malId, 10);
                    window.MAL_ID = MAL_ID;
                    saveStoredMalId(MAL_ID);
                    if (inputMalId) inputMalId.value = MAL_ID;
                    try {
                        const u = new URL(window.location.href);
                        u.searchParams.set('malId', MAL_ID);
                        window.history.replaceState({}, '', u.toString());
                    } catch (e) {}
                }

                // Filter strictly for pure intro ('op') and outro ('ed') - NEVER mixed-op or mixed-ed
                const filteredResults = (data && data.found && Array.isArray(data.results))
                    ? data.results.filter(r => {
                        const t = (r.skipType || '').toLowerCase().trim();
                        return t === 'op' || t === 'ed';
                    })
                    : [];

                if (filteredResults.length > 0) {
                    aniSkipResults = filteredResults;
                    lastAutoSkippedId = null; // Reset auto-skip trigger for new episode

                    if (aniSkipStatusBadge) {
                        aniSkipStatusBadge.textContent = `Active: Ep ${episode} (${aniSkipResults.length} intervals)`;
                        aniSkipStatusBadge.className = 'text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold';
                    }
                    if (aniSkipBadge) {
                        aniSkipBadge.classList.remove('hidden');
                        aniSkipBadge.textContent = aniSkipResults.map(r => r.skipType.toUpperCase()).join('/');
                    }

                    renderAniSkipSegmentsList();
                    updateTimelineAniSkipMarkers();
                    showToast(`AniSkip: Caught Ep ${episode} timestamps (${aniSkipResults.length} intervals)`);
                } else {
                    aniSkipResults = [];
                    lastAutoSkippedId = null;
                    if (aniSkipStatusBadge) {
                        aniSkipStatusBadge.textContent = `No Skip Times (Ep ${episode})`;
                        aniSkipStatusBadge.className = 'text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-400 font-bold';
                    }
                    if (aniSkipBadge) aniSkipBadge.classList.add('hidden');
                    if (aniSkipSegmentsList) {
                        aniSkipSegmentsList.innerHTML = `<div class="p-3 text-center text-xs text-zinc-400 glass-sub-panel rounded-xl">No AniSkip timestamps found for Ep ${episode}${effectiveMalId ? ' (MAL #' + effectiveMalId + ')' : ''}.</div>`;
                    }
                    updateTimelineAniSkipMarkers();
                }
            } catch (err) {
                console.error('AniSkip fetch failed:', err);
                if (targetEp === MEDIA_EPISODE && aniSkipStatusBadge) {
                    aniSkipStatusBadge.textContent = 'Error';
                    aniSkipStatusBadge.className = 'text-[9px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold';
                }
            } finally {
                if (window.lucide) lucide.createIcons();
            }
        }

        function renderAniSkipSegmentsList() {
            if (!aniSkipSegmentsList) return;
            if (!aniSkipResults || aniSkipResults.length === 0) {
                aniSkipSegmentsList.innerHTML = `<div class="p-3 text-center text-xs text-zinc-400 glass-sub-panel rounded-xl">No timestamps loaded.</div>`;
                return;
            }

            aniSkipSegmentsList.innerHTML = aniSkipResults.map((seg, idx) => {
                const type = seg.skipType;
                const start = Math.floor(seg.interval.startTime);
                const end = Math.floor(seg.interval.endTime);
                const dur = Math.max(0, end - start);
                let colorClass = 'border-amber-400/40 bg-amber-500/10 text-amber-300';
                let iconName = 'zap';

                if (type.includes('ed')) {
                    colorClass = 'border-purple-400/40 bg-purple-500/10 text-purple-300';
                    iconName = 'skip-forward';
                } else if (type === 'recap') {
                    colorClass = 'border-sky-400/40 bg-sky-500/10 text-sky-300';
                    iconName = 'fast-forward';
                }

                return `
                    <div class="p-2.5 rounded-xl border ${colorClass} flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2">
                            <i data-lucide="${iconName}" class="w-4 h-4"></i>
                            <div>
                                <div class="text-xs font-extrabold capitalize">${getSkipTypeName(type)}</div>
                                <div class="text-[10px] text-zinc-400 font-mono">${formatTime(start)} &rarr; ${formatTime(end)} (${dur}s)</div>
                            </div>
                        </div>
                        <div class="flex items-center gap-1">
                            <button onclick="seekToAniSkip(${start})" class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white transition-all cursor-pointer">
                                Jump to Start
                            </button>
                            <button onclick="seekToAniSkip(${end + 0.5})" class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white transition-all cursor-pointer">
                                Jump to End
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            if (window.lucide) lucide.createIcons();
        }

        function updateTimelineAniSkipMarkers() {
            const duration = mainVideo ? (mainVideo.duration || 0) : 0;
            if (!duration || !aniSkipResults || aniSkipResults.length === 0) {
                if (timelineOpMarker) timelineOpMarker.classList.add('hidden');
                if (timelineEdMarker) timelineEdMarker.classList.add('hidden');
                if (timelineRecapMarker) timelineRecapMarker.classList.add('hidden');
                return;
            }

            const op = aniSkipResults.find(s => (s.skipType || '').toLowerCase().trim() === 'op');
            if (op && timelineOpMarker) {
                const left = (op.interval.startTime / duration) * 100;
                const width = ((op.interval.endTime - op.interval.startTime) / duration) * 100;
                timelineOpMarker.style.left = left + '%';
                timelineOpMarker.style.width = width + '%';
                timelineOpMarker.classList.remove('hidden');
            } else if (timelineOpMarker) {
                timelineOpMarker.classList.add('hidden');
            }

            const ed = aniSkipResults.find(s => (s.skipType || '').toLowerCase().trim() === 'ed');
            if (ed && timelineEdMarker) {
                const left = (ed.interval.startTime / duration) * 100;
                const width = ((ed.interval.endTime - ed.interval.startTime) / duration) * 100;
                timelineEdMarker.style.left = left + '%';
                timelineEdMarker.style.width = width + '%';
                timelineEdMarker.classList.remove('hidden');
            } else if (timelineEdMarker) {
                timelineEdMarker.classList.add('hidden');
            }

            const recap = aniSkipResults.find(s => s.skipType === 'recap');
            if (recap && timelineRecapMarker) {
                const left = (recap.interval.startTime / duration) * 100;
                const width = ((recap.interval.endTime - recap.interval.startTime) / duration) * 100;
                timelineRecapMarker.style.left = left + '%';
                timelineRecapMarker.style.width = width + '%';
                timelineRecapMarker.classList.remove('hidden');
            } else if (timelineRecapMarker) {
                timelineRecapMarker.classList.add('hidden');
            }
        }

        function initAniSkip() {
            if (chkAutoSkip) chkAutoSkip.checked = aniSkipAutoSkip;
            if (aniSkipEpisodeDisplay) aniSkipEpisodeDisplay.textContent = MEDIA_EPISODE;

            const effectiveMalId = MAL_ID || getStoredMalId();
            if (effectiveMalId) {
                if (inputMalId) inputMalId.value = effectiveMalId;
                fetchAniSkipData(effectiveMalId, MEDIA_EPISODE);
            } else {
                // Automatically catch AniSkip data in background on load
                fetchAniSkipData(null, MEDIA_EPISODE);
            }
        }

        function toggleMoreLikeThisDrawer(force) {
            const isClosed = moreLikeThisTray.classList.contains('translate-y-full');
            const shouldOpen = force !== undefined ? force : isClosed;
            if (shouldOpen) {
                moreLikeThisTray.classList.remove('translate-y-full');
                moreLikeThisChevron.classList.add('rotate-180');
                if (episodesDrawer) episodesDrawer.classList.add('translate-y-full');
            } else {
                moreLikeThisTray.classList.add('translate-y-full');
                moreLikeThisChevron.classList.remove('rotate-180');
            }
        }

        function toggleEpisodesDrawer(force) {
            if (MEDIA_TYPE !== 'tv' || !episodesDrawer) return;
            const isClosed = episodesDrawer.classList.contains('translate-y-full');
            const shouldOpen = force !== undefined ? force : isClosed;
            if (shouldOpen) {
                episodesDrawer.classList.remove('translate-y-full');
                moreLikeThisTray.classList.add('translate-y-full');
                moreLikeThisChevron.classList.remove('rotate-180');
            } else {
                episodesDrawer.classList.add('translate-y-full');
            }
        }

        function toggleSleepModal(force) {
            const isHidden = sleepModal.classList.contains('hidden');
            const target = force !== undefined ? !force : !isHidden;
            if (target) {
                sleepModal.classList.add('hidden');
            } else {
                sleepModal.classList.remove('hidden');
            }
        }

        function setSleepTimer(minutes) {
            if (sleepTimerInterval) clearInterval(sleepTimerInterval);
            if (minutes === 0) {
                sleepIndicator.style.display = 'none';
                toggleSleepModal(false);
                showToast('Sleep Timer Disabled');
                return;
            }
            sleepEndTime = Date.now() + (minutes * 60 * 1000);
            sleepIndicator.style.display = 'flex';
            toggleSleepModal(false);
            showToast(`Sleep Timer Set: ${minutes}m`);

            sleepTimerInterval = setInterval(() => {
                const remaining = Math.max(0, Math.floor((sleepEndTime - Date.now()) / 1000));
                const m = Math.floor(remaining / 60);
                const s = remaining % 60;
                document.getElementById('sleep-time').textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
                if (remaining <= 0) {
                    clearInterval(sleepTimerInterval);
                    safePauseVideo();
                    sleepIndicator.style.display = 'none';
                    showToast('Playback paused by Sleep Timer');
                }
            }, 1000);
        }

        let subtitleSettings = {
            fontSize: '1.15rem',
            color: '#ffffff',
            bg: 'rgba(0,0,0,0.55)',
            shadow: '1px 1px 2px black, 0 0 1em black'
        };

        function loadStoredSubtitleSettings() {
            try {
                const stored = localStorage.getItem('bingr_sub_settings');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    subtitleSettings = Object.assign(subtitleSettings, parsed);
                }
            } catch (_) {}
            applySubtitleStyles();
        }

        function applySubtitleStyles() {
            // 1. Update CSS custom properties on documentElement
            document.documentElement.style.setProperty('--sub-font-size', subtitleSettings.fontSize);
            document.documentElement.style.setProperty('--sub-color', subtitleSettings.color);
            document.documentElement.style.setProperty('--sub-bg', subtitleSettings.bg);
            document.documentElement.style.setProperty('--sub-shadow', subtitleSettings.shadow);

            // 2. Update Live Preview Box
            const preview = document.getElementById('subPreviewBox');
            if (preview) {
                preview.style.fontSize = subtitleSettings.fontSize;
                preview.style.color = subtitleSettings.color;
                preview.style.backgroundColor = subtitleSettings.bg;
                preview.style.textShadow = subtitleSettings.shadow;
            }

            // 3. Update High-Precision Custom Subtitle Overlay
            const overlayText = document.getElementById('customSubtitleText');
            if (overlayText) {
                overlayText.style.fontSize = subtitleSettings.fontSize;
                overlayText.style.color = subtitleSettings.color;
                overlayText.style.backgroundColor = subtitleSettings.bg;
                overlayText.style.textShadow = subtitleSettings.shadow;
            }

            // 4. Inject explicit ::cue rule into head to guarantee browser engine rendering
            let cueStyle = document.getElementById('dynamicCueStyle');
            if (!cueStyle) {
                cueStyle = document.createElement('style');
                cueStyle.id = 'dynamicCueStyle';
                document.head.appendChild(cueStyle);
            }
            cueStyle.textContent = `
                ::cue, video::cue {
                    font-size: ${subtitleSettings.fontSize} !important;
                    color: ${subtitleSettings.color} !important;
                    background-color: ${subtitleSettings.bg} !important;
                    text-shadow: ${subtitleSettings.shadow} !important;
                    line-height: 1.4 !important;
                    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
                    border-radius: 8px !important;
                    padding: 4px 12px !important;
                }
            `;

            try {
                localStorage.setItem('bingr_sub_settings', JSON.stringify(subtitleSettings));
            } catch (_) {}
        }

        function applyAndConfirmSubtitleStyles() {
            applySubtitleStyles();
            updateSubtitleOverlay();

            const btn = document.getElementById('btnApplySubStyles');
            const label = document.getElementById('btnApplySubStylesLabel');
            if (btn && label) {
                const originalText = label.textContent;
                btn.className = 'flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 transition-all';
                label.textContent = 'Styles Applied!';
                setTimeout(() => {
                    btn.className = 'flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-900/40 transition-all cursor-pointer';
                    label.textContent = originalText;
                }, 1800);
            }
            showToast('Subtitle styles applied successfully');
        }

        function resetSubtitleStylesToDefault() {
            subtitleSettings = {
                fontSize: '1.15rem',
                color: '#ffffff',
                bg: 'rgba(0,0,0,0.55)',
                shadow: '1px 1px 2px black, 0 0 1em black'
            };
            applySubtitleStyles();
            updateSubtitleOverlay();

            // Refresh UI button states
            document.querySelectorAll('.sub-font-btn').forEach((b, idx) => {
                b.className = idx === 1 
                    ? 'sub-font-btn py-1 px-1.5 bg-zinc-900 border border-white/40 ring-1 ring-white/20 text-white rounded-lg text-[11px] font-bold shadow-lg transition-all'
                    : 'sub-font-btn py-1 px-1.5 bg-black/70 hover:bg-zinc-900 border border-white/10 hover:border-white/20 rounded-lg text-[11px] font-bold text-zinc-300 transition-all';
            });
            document.querySelectorAll('.sub-color-btn').forEach((b, idx) => {
                b.classList.remove('border-white/50', 'ring-1', 'ring-white/30');
                if (idx === 0) {
                    b.classList.add('border-white/50', 'ring-1', 'ring-white/30');
                } else {
                    b.classList.add('border-white/10');
                }
            });
            document.querySelectorAll('.sub-bg-btn').forEach((b, idx) => {
                b.classList.remove('border-white/50', 'ring-1', 'ring-white/30');
                if (idx === 1) {
                    b.classList.add('border-white/50', 'ring-1', 'ring-white/30');
                } else {
                    b.classList.add('border-white/10');
                }
            });
            document.querySelectorAll('.sub-shadow-btn').forEach((b, idx) => {
                b.classList.remove('border-white/50', 'ring-1', 'ring-white/30');
                if (idx === 1) {
                    b.classList.add('border-white/50', 'ring-1', 'ring-white/30');
                } else {
                    b.classList.add('border-white/10');
                }
            });

            showToast('Subtitle styles reset to defaults');
        }

        function setSubtitleFontSize(size, btnElement) {
            subtitleSettings.fontSize = size;
            applySubtitleStyles();
            if (btnElement) {
                document.querySelectorAll('.sub-font-btn').forEach(btn => {
                    btn.className = 'sub-font-btn py-1 px-1.5 bg-black/70 hover:bg-zinc-900 border border-white/10 hover:border-white/20 rounded-lg text-[11px] font-bold text-zinc-300 transition-all';
                });
                btnElement.className = 'sub-font-btn py-1 px-1.5 bg-zinc-900 border border-white/40 ring-1 ring-white/20 text-white rounded-lg text-[11px] font-bold shadow-lg transition-all';
            }
        }

        function setSubtitleColor(color, btnElement) {
            subtitleSettings.color = color;
            applySubtitleStyles();
            if (btnElement) {
                document.querySelectorAll('.sub-color-btn').forEach(btn => {
                    btn.classList.remove('border-white/50', 'ring-1', 'ring-white/30');
                    btn.classList.add('border-white/10');
                });
                btnElement.classList.remove('border-white/10');
                btnElement.classList.add('border-white/50', 'ring-1', 'ring-white/30');
            }
        }

        function setSubtitleBg(bg, btnElement) {
            subtitleSettings.bg = bg;
            applySubtitleStyles();
            if (btnElement) {
                document.querySelectorAll('.sub-bg-btn').forEach(btn => {
                    btn.classList.remove('border-white/50', 'ring-1', 'ring-white/30');
                    btn.classList.add('border-white/10');
                });
                btnElement.classList.remove('border-white/10');
                btnElement.classList.add('border-white/50', 'ring-1', 'ring-white/30');
            }
        }

        function setSubtitleShadow(shadow, btnElement) {
            subtitleSettings.shadow = shadow;
            applySubtitleStyles();
            if (btnElement) {
                document.querySelectorAll('.sub-shadow-btn').forEach(btn => {
                    btn.classList.remove('border-white/50', 'ring-1', 'ring-white/30');
                    btn.classList.add('border-white/10');
                });
                btnElement.classList.remove('border-white/10');
                btnElement.classList.add('border-white/50', 'ring-1', 'ring-white/30');
            }
        }

        function adjustSubtitleSync(delta) {
            subtitleSyncOffset = parseFloat((subtitleSyncOffset + delta).toFixed(2));
            const disp = document.getElementById('subOffsetDisplay');
            if (disp) {
                disp.textContent = (subtitleSyncOffset >= 0 ? '+' : '') + subtitleSyncOffset.toFixed(2) + 's';
            }
            if (mainVideo && mainVideo.textTracks) {
                for (let i = 0; i < mainVideo.textTracks.length; i++) {
                    const track = mainVideo.textTracks[i];
                    if (track.cues) {
                        for (let j = 0; j < track.cues.length; j++) {
                            track.cues[j].startTime += delta;
                            track.cues[j].endTime += delta;
                        }
                    }
                }
            }
            updateSubtitleOverlay();
        }

        function resetSubtitleSync() {
            adjustSubtitleSync(-subtitleSyncOffset);
        }

        async function loadMediaHudMetadata() {
            try {
                const endpoint = MEDIA_TYPE === 'tv' ? '/api/bingr/tv/' + MEDIA_ID : '/api/bingr/movie/' + MEDIA_ID;
                const res = await fetch(endpoint);
                const data = await res.json();

                if (data) {
                    if (data.year) document.getElementById('hudYear').textContent = data.year;
                    if (data.rating) document.getElementById('hudRating').textContent = `${Number(data.rating).toFixed(1)} / 10`;
                    if (data.runtime) {
                        const h = Math.floor(data.runtime / 60);
                        const m = data.runtime % 60;
                        document.getElementById('hudRuntime').textContent = h > 0 ? (h + 'h ' + m + 'm') : (m + 'm');
                    }
                    if (data.certification) document.getElementById('hudCert').textContent = data.certification;
                    if (data.overview) document.getElementById('hudOverview').textContent = data.overview;
                }

                const imgEndpoint = '/api/bingr/tmdb-proxy?endpoint=' + MEDIA_TYPE + '/' + MEDIA_ID + '/images&include_image_language=en,null';
                const imgRes = await fetch(imgEndpoint);
                const imgData = await imgRes.json();

                if (imgData && imgData.logos && imgData.logos.length > 0) {
                    const logo = imgData.logos.find(l => l.file_path && l.file_path.endsWith('.png')) || imgData.logos[0];
                    if (logo && logo.file_path) {
                        const hudLogoImg = document.getElementById('hudLogoImg');
                        hudLogoImg.src = 'https://image.tmdb.org/t/p/w500' + logo.file_path;
                        hudLogoImg.classList.remove('hidden');
                        document.getElementById('hudTitleText').classList.add('hidden');
                    }
                }
            } catch (e) {
                console.warn('HUD info load notice:', e);
            }
        }

        /* ---------------- REDESIGNED MORE LIKE THIS (TRANSPARENT GLASS & NO STARS) ---------------- */
        async function loadMoreLikeThis() {
            const grid = document.getElementById('moreLikeThisGrid');
            if (!grid) return;

            try {
                const endpoint = '/api/bingr/tmdb-proxy?endpoint=' + MEDIA_TYPE + '/' + MEDIA_ID + '/recommendations';
                const res = await fetch(endpoint);
                const data = await res.json();
                const items = data.results ? data.results.slice(0, 12) : []; window.recommendations = items;

                if (items.length === 0) {
                    grid.innerHTML = '<div class="col-span-full py-8 text-center text-xs text-zinc-500">No related titles found.</div>';
                    return;
                }

                grid.innerHTML = items.map(item => {
                    const title = item.title || item.name || 'Title';
                    const rating = item.vote_average ? item.vote_average.toFixed(1) : '7.0';
                    const year = (item.release_date || item.first_air_date || '2024').slice(0, 4);
                    const thumb = item.backdrop_path ? 'https://image.tmdb.org/t/p/w500' + item.backdrop_path : (item.poster_path ? 'https://image.tmdb.org/t/p/w500' + item.poster_path : '');
                    
                    return `
                        <div onclick="switchMovie(${item.id}, '${item.media_type || MEDIA_TYPE}', '${title.replace(/'/g, "\\'")}')" class="group cursor-pointer space-y-2 transition-all duration-300 transform hover:scale-[1.04] active:scale-95">
                            <div class="relative aspect-video rounded-2xl overflow-hidden glass-sub-panel border border-white/10 shadow-xl group-hover:border-white/30 group-hover:shadow-2xl">
                                <img src="${thumb}" alt="${title}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5">
                                    <span class="px-2 py-1 rounded-lg bg-red-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-lg">
                                        <i data-lucide="play" class="w-3 h-3 fill-white"></i> Play
                                    </span>
                                </div>
                                <div class="absolute top-2 right-2 px-1.5 py-0.5 rounded-md glass-panel text-amber-300 text-[10px] font-black tracking-wide border border-white/10">
                                    ${rating}
                                </div>
                            </div>
                            <div class="space-y-0.5 px-0.5">
                                <h4 class="text-xs font-bold text-white truncate group-hover:text-red-400 transition-colors">${title}</h4>
                                <div class="flex items-center gap-1.5 text-[10px] text-zinc-400 uppercase font-semibold">
                                    <span>${year}</span>
                                    <span>&bull;</span>
                                    <span class="text-zinc-500">${MEDIA_TYPE === 'tv' ? 'Series' : 'Cinema'}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');

                if (window.lucide) lucide.createIcons();
            } catch (e) {
                grid.innerHTML = '<div class="col-span-full py-8 text-center text-xs text-zinc-500">Failed to load recommendations.</div>';
            }
        }

        async function loadTvSeasonsAndEpisodes() {
            if (MEDIA_TYPE !== 'tv') return;
            const seasonSelect = document.getElementById('seasonSelect');
            const grid = document.getElementById('episodesGrid');
            if (!seasonSelect || !grid) return;

            try {
                const res = await fetch('/api/bingr/tv/' + MEDIA_ID);
                const data = await res.json();
                if (!data || !data.seasons) return;

                const seasons = data.seasons.filter(s => (s.season !== undefined ? s.season : s.season_number) > 0);
                seasonSelect.innerHTML = seasons.map(s => {
                    const sNum = s.season !== undefined ? s.season : s.season_number;
                    const eCount = s.episodes !== undefined ? s.episodes : s.episode_count;
                    const sName = s.name && s.name !== `Season ${sNum}` ? ` - ${s.name}` : '';
                    return `<option value="${sNum}" ${sNum === MEDIA_SEASON ? 'selected' : ''}>Season ${sNum}${sName} (${eCount} eps)</option>`;
                }).join('');

                loadEpisodesForSeason(MEDIA_SEASON);
            } catch (e) {
                console.warn('Seasons load error:', e);
            }
        }

        async function changeSeason(seasonNum) {
            MEDIA_SEASON = parseInt(seasonNum);
            loadEpisodesForSeason(MEDIA_SEASON);
        }

        async function loadEpisodesForSeason(seasonNum) {
            const grid = document.getElementById('episodesGrid');
            if (!grid) return;
            grid.innerHTML = '<div class="col-span-full py-6 text-center text-xs text-zinc-500">Loading episodes...</div>';

            try {
                const res = await fetch(`/api/bingr/tmdb-proxy?endpoint=tv/${MEDIA_ID}/season/${seasonNum}`);
                const data = await res.json();
                const episodes = data.episodes || [];

                if (episodes.length === 0) {
                    grid.innerHTML = '<div class="col-span-full py-6 text-center text-xs text-zinc-500">No episodes found.</div>';
                    return;
                }

                grid.innerHTML = episodes.map(ep => {
                    const isCurrent = ep.episode_number === MEDIA_EPISODE && seasonNum === MEDIA_SEASON;
                    const thumb = ep.still_path ? 'https://image.tmdb.org/t/p/w300' + ep.still_path : '';
                    return `
                        <div onclick="switchEpisode(${seasonNum}, ${ep.episode_number})" data-season="${seasonNum}" data-episode="${ep.episode_number}" class="episode-card-item group cursor-pointer space-y-1.5 transition-all transform hover:scale-[1.03] active:scale-95">
                            <div class="episode-thumb-container relative aspect-video rounded-2xl overflow-hidden glass-sub-panel border ${isCurrent ? 'border-red-500 ring-2 ring-red-500/50' : 'border-white/10'} shadow-lg">
                                ${thumb ? `<img src="${thumb}" alt="Ep ${ep.episode_number}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-600">EP ${ep.episode_number}</div>`}
                                <div class="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-md glass-panel text-white text-[10px] font-black">
                                    EP ${ep.episode_number}
                                </div>
                            </div>
                            <div class="text-[11px] font-bold text-white truncate group-hover:text-red-400 transition-colors px-0.5">
                                ${ep.name || `Episode ${ep.episode_number}`}
                            </div>
                        </div>
                    `;
                }).join('');
            } catch (e) {
                grid.innerHTML = '<div class="col-span-full py-6 text-center text-xs text-zinc-500">Failed to load episodes.</div>';
            }
        }

        function highlightCurrentEpisode(season, episode) {
            const cards = document.querySelectorAll('.episode-card-item');
            cards.forEach(card => {
                const epNum = parseInt(card.dataset.episode, 10);
                const sNum = parseInt(card.dataset.season, 10);
                const thumb = card.querySelector('.episode-thumb-container');
                if (epNum === episode && sNum === season) {
                    if (thumb) {
                        thumb.classList.add('border-red-500', 'ring-2', 'ring-red-500/50');
                        thumb.classList.remove('border-white/10');
                    }
                } else {
                    if (thumb) {
                        thumb.classList.remove('border-red-500', 'ring-2', 'ring-red-500/50');
                        thumb.classList.add('border-white/10');
                    }
                }
            });
        }

        function switchEpisode(season, episode) {
            MEDIA_SEASON = parseInt(season, 10) || 1;
            MEDIA_EPISODE = parseInt(episode, 10) || 1;
            window.MEDIA_SEASON = MEDIA_SEASON;
            window.MEDIA_EPISODE = MEDIA_EPISODE;

            // 1. Update browser URL history without reloading the page
            try {
                const url = new URL(window.location.href);
                url.searchParams.set('s', MEDIA_SEASON);
                url.searchParams.set('season', MEDIA_SEASON);
                url.searchParams.set('e', MEDIA_EPISODE);
                url.searchParams.set('episode', MEDIA_EPISODE);
                if (MAL_ID) url.searchParams.set('malId', MAL_ID);
                window.history.replaceState({ season: MEDIA_SEASON, episode: MEDIA_EPISODE }, '', url.toString());
            } catch (e) {}

            // 2. Update UI titles and labels
            const mediaTitleEl = document.getElementById('mediaTitle');
            if (mediaTitleEl) mediaTitleEl.textContent = `${MEDIA_TITLE} - S${MEDIA_SEASON}E${MEDIA_EPISODE}`;
            const hudTitleEl = document.getElementById('hudMediaTitle');
            if (hudTitleEl) hudTitleEl.textContent = `${MEDIA_TITLE} - S${MEDIA_SEASON}E${MEDIA_EPISODE}`;
            document.title = `${MEDIA_TITLE} - S${MEDIA_SEASON}E${MEDIA_EPISODE} | Bingr 4K Cinema Player`;

            if (aniSkipEpisodeDisplay) aniSkipEpisodeDisplay.textContent = MEDIA_EPISODE;

            // 3. Clear previous episode's AniSkip / skip states
            aniSkipResults = [];
            activeAniSkipSegment = null;
            lastAutoSkippedId = null;
            updateTimelineAniSkipMarkers();
            if (aniSkipBadge) aniSkipBadge.classList.add('hidden');
            if (btnSkipIntro) {
                btnSkipIntro.classList.remove('show');
                btnSkipIntro.classList.add('hidden');
            }
            if (btnNextEpisode) {
                btnNextEpisode.classList.remove('show');
                btnNextEpisode.classList.add('hidden');
            }

            // 4. Close episodes drawer and highlight new episode
            toggleEpisodesDrawer(false);
            highlightCurrentEpisode(MEDIA_SEASON, MEDIA_EPISODE);

            showToast(`Loading S${MEDIA_SEASON} E${MEDIA_EPISODE}...`);

            // 5. AUTOMATICALLY CATCH ANISKIP IN THE BACKGROUND FOR THIS SPECIFIC EPISODE!
            fetchAniSkipData(MAL_ID, MEDIA_EPISODE);

            // 6. Play new episode stream
            if (playerMode === 'embed') {
                const provId = (embedFrame && embedFrame.dataset.provider) ? embedFrame.dataset.provider : 'vidrift';
                const prov = EMBED_PROVIDERS.find(p => p.id === provId) || EMBED_PROVIDERS[0];
                if (embedFrame && prov) {
                    embedFrame.src = prov.url(MEDIA_TYPE, MEDIA_ID, MEDIA_SEASON, MEDIA_EPISODE);
                }
            } else {
                fetchAndPlayStream(CURRENT_SERVER);
            }

            // 7. Refresh subtitles for this episode
            fetchExternalSubtitles();
        }

        function switchMovie(newId, newType, newTitle) {
            window.location.href = `/play_bingr.php?id=${newId}&tmdbId=${newId}&type=${newType}&title=${encodeURIComponent(newTitle)}&srv=${CURRENT_SERVER}&source=${SOURCE_ORIGIN}`;
        }

        const EMBED_PROVIDERS = [
            { id: 'vidlink_pro', name: 'VidLink Pro', url: (t, id, s, e) => (t === 'tv' || t === 'series') ? `https://vidlink.pro/tv/${id}/${s}/${e}?autoplay=true` : `https://vidlink.pro/movie/${id}?autoplay=true` },
            { id: 'vidrift', name: 'Vidrift', url: (t, id, s, e) => (t === 'tv' || t === 'series') ? `https://embed.vidrift.in/embed/tv/${id}/${s}/${e}` : `https://embed.vidrift.in/embed/movie/${id}` },
            { id: 'vidsrc_pm', name: 'VidSrc PM', url: (t, id, s, e) => (t === 'tv' || t === 'series') ? `https://vidsrc.pm/embed/tv/${id}/${s}/${e}` : `https://vidsrc.pm/embed/movie/${id}` },
            { id: 'vidsrc_to', name: 'VidSrc TO', url: (t, id, s, e) => (t === 'tv' || t === 'series') ? `https://vidsrc.to/embed/tv/${id}/${s}/${e}` : `https://vidsrc.to/embed/movie/${id}` },
            { id: 'vidsrc_in', name: 'VidSrc IN', url: (t, id, s, e) => (t === 'tv' || t === 'series') ? `https://vidsrc.in/embed/tv/${id}/${s}/${e}` : `https://vidsrc.in/embed/movie/${id}` },
            { id: 'smashy', name: 'SmashyStream', url: (t, id, s, e) => (t === 'tv' || t === 'series') ? `https://embed.smashystream.com/playere.php?tmdb=${id}&season=${s}&episode=${e}` : `https://embed.smashystream.com/playere.php?tmdb=${id}` },
            { id: 'filmu', name: 'Filmu Stream', url: (t, id, s, e) => (t === 'tv' || t === 'series') ? `https://embed.filmu.in/tv/${id}/${s}/${e}` : `https://embed.filmu.in/movie/${id}` },
            { id: 'cinezo', name: 'Cinezo HD', url: (t, id, s, e) => (t === 'tv' || t === 'series') ? `https://player.cinezo.live/embed/tv/${id}/${s}/${e}` : `https://player.cinezo.live/embed/movie/${id}` },
            { id: '2embed', name: '2Embed Multi', url: (t, id, s, e) => (t === 'tv' || t === 'series') ? `https://www.2embed.cc/embedtv/${id}?s=${s}&e=${e}` : `https://www.2embed.cc/embed/${id}` }
        ];

        function populateEmbedProviders() {
            const grid = document.getElementById('embedProvidersGrid');
            if (!grid) return;
            
            grid.innerHTML = EMBED_PROVIDERS.map(prov => {
                const isSelected = playerMode === 'embed' && embedFrame.dataset.provider === prov.id;
                return `
                    <button onclick="switchPlayerMode('embed', '${prov.id}', true)" class="flex flex-col items-start px-3 py-2 rounded-xl border ${isSelected ? 'border-white/40 bg-zinc-900 ring-1 ring-white/20 text-white shadow-lg' : 'border-white/10 bg-black/70 hover:bg-zinc-900 text-zinc-300'} transition-all cursor-pointer">
                        <span class="text-xs font-bold ${isSelected ? 'text-white' : 'text-zinc-300'}">${prov.name}</span>
                        <span class="text-[9px] text-zinc-500 font-medium mt-0.5">${isSelected ? 'Currently Playing' : 'Select Provider'}</span>
                    </button>
                `;
            }).join('');
        }

        function switchPlayerMode(mode, providerId = 'vidlink_pro', isManualTrigger = true) {
            playerMode = mode;
            const btnDirect = document.getElementById('btnModeDirect');
            const btnEmbed = document.getElementById('btnModeEmbed');
            const bottomControls = document.getElementById('bottomControlsBar');
            
            if (mode === 'embed') {
                if (hlsInstance) {
                    try { hlsInstance.stopLoad(); } catch (_) {}
                }
                safePauseVideo();
                if (mainVideo) {
                    mainVideo.classList.add('hidden');
                }
                document.body.classList.add('embed-active');
                
                embedFrame.dataset.provider = providerId;
                const prov = EMBED_PROVIDERS.find(p => p.id === providerId) || EMBED_PROVIDERS[0];
                embedFrame.src = prov.url(MEDIA_TYPE, MEDIA_ID, MEDIA_SEASON, MEDIA_EPISODE);
                embedFrame.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
                embedFrame.setAttribute('allowfullscreen', 'true');
                
                embedFrame.classList.remove('hidden');
                embedFrame.style.zIndex = '10'; // sit above mainVideo, but under controls
                
                if (bottomControls) bottomControls.style.display = 'none'; // fully remove timeline

                const btnSwitchDirect = document.getElementById('btnSwitchToDirect');
                if (btnSwitchDirect) btnSwitchDirect.classList.remove('hidden');

                if (mediaHudOverlay) {
                    mediaHudOverlay.classList.add('hidden', 'opacity-0', 'pointer-events-none');
                    mediaHudOverlay.classList.remove('opacity-100');
                }

                if (btnDirect) btnDirect.className = 'px-3 py-1.5 rounded-lg bg-black/70 hover:bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white font-bold transition-all';
                if (btnEmbed) btnEmbed.className = 'px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/40 ring-1 ring-white/20 text-white font-bold transition-all shadow-md';
                
                showToast(`Switched to Embed: ${prov.name}`);
                populateEmbedProviders();
                toggleQualityServerModal(false);
                resetControlsTimer(); // Ensure sensor gets initialized properly
            } else {
                embedFrame.classList.add('hidden');
                embedFrame.src = '';
                embedFrame.style.zIndex = '0';
                document.body.classList.remove('embed-active');

                const btnSwitchDirect = document.getElementById('btnSwitchToDirect');
                if (btnSwitchDirect) btnSwitchDirect.classList.add('hidden');

                if (mediaHudOverlay) {
                    mediaHudOverlay.classList.remove('hidden');
                }
                
                if (bottomControls) bottomControls.style.display = 'flex'; // restore timeline
                
                mainVideo.classList.remove('hidden');
                if (hlsInstance) {
                    try { hlsInstance.startLoad(); } catch (_) {}
                }
                if (mainVideo.src || (hlsInstance && hlsInstance.url)) {
                    safePlayVideo();
                }
                
                if (btnDirect) btnDirect.className = 'px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/40 ring-1 ring-white/20 text-white font-bold transition-all shadow-md';
                if (btnEmbed) btnEmbed.className = 'px-3 py-1.5 rounded-lg bg-black/70 hover:bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white font-bold transition-all';
                
                showToast('Switched to Direct Native Stream');
                populateEmbedProviders();
                toggleQualityServerModal(false);
                resetControlsTimer();
            }
        }

        function showLoading(show, msg) {
            if (msg) streamLoadingMsg.textContent = msg;
            if (show) {
                streamLoading.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
            } else {
                streamLoading.classList.add('opacity-0', 'pointer-events-none');
                setTimeout(() => streamLoading.classList.add('hidden'), 300);
            }
        }

        function showCenterBurst(iconName) {
            const burst = document.getElementById('centerPlayBurst');
            const icon = document.getElementById('centerBurstIcon');
            if (!burst || !icon) return;

            icon.setAttribute('data-lucide', iconName === 'pause' ? 'pause' : (iconName === 'forward' ? 'fast-forward' : (iconName === 'rewind' ? 'rewind' : 'play')));
            if (window.lucide) lucide.createIcons();

            burst.classList.remove('opacity-0', 'scale-75');
            burst.classList.add('burst-active');
            setTimeout(() => {
                burst.classList.remove('burst-active');
                burst.classList.add('opacity-0', 'scale-75');
            }, 380);
        }

        function updateFullscreenIcons(isFullscreen) {
            const icon = document.getElementById('fullscreenIcon');
            const iconMob = document.getElementById('fullscreenIconMob');
            const iconName = isFullscreen ? 'minimize' : 'maximize';
            if (icon) icon.setAttribute('data-lucide', iconName);
            if (iconMob) iconMob.setAttribute('data-lucide', iconName);
            if (window.lucide) lucide.createIcons();
        }

        document.addEventListener('fullscreenchange', () => {
            const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
            updateFullscreenIcons(isFs);
        });
        document.addEventListener('webkitfullscreenchange', () => {
            const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
            updateFullscreenIcons(isFs);
        });

        function toggleFullscreen() {
            const container = document.getElementById('playerContainer') || document.documentElement;
            const video = document.getElementById('mainVideo');
            
            const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;

            if (!isFullscreen) {
                if (container.requestFullscreen) {
                    container.requestFullscreen().catch(() => {});
                } else if (container.webkitRequestFullscreen) {
                    container.webkitRequestFullscreen();
                } else if (container.mozRequestFullScreen) {
                    container.mozRequestFullScreen();
                } else if (container.msRequestFullscreen) {
                    container.msRequestFullscreen();
                } else if (video && video.webkitEnterFullscreen) {
                    video.webkitEnterFullscreen();
                }
                updateFullscreenIcons(true);
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen().catch(() => {});
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
                updateFullscreenIcons(false);
            }
        }

        /* ---------------- ADVANCED MOBILE TOUCH GESTURES ---------------- */
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;
        let lastTapTime = 0;
        let lastTapX = 0;
        let isTouching = false;
        let isSwipeGesture = false;
        let swipeMode = null;
        let currentBrightness = 1.0;
        let initialSwipeVal = 0;
        let singleTapTimeout = null;

        const playerContainerEl = document.getElementById('playerContainer');
        const swipeHudEl = document.getElementById('swipeHud');
        const swipeHudIconEl = document.getElementById('swipeHudIcon');
        const swipeHudBarEl = document.getElementById('swipeHudBar');
        const swipeHudPercentEl = document.getElementById('swipeHudPercent');
        const seekRippleLeftEl = document.getElementById('seekRippleLeft');
        const seekRippleRightEl = document.getElementById('seekRippleRight');

        function triggerRipple(side) {
            const el = side === 'left' ? seekRippleLeftEl : seekRippleRightEl;
            if (!el) return;
            el.classList.remove('opacity-0');
            el.classList.add('opacity-100');
            setTimeout(() => {
                el.classList.remove('opacity-100');
                el.classList.add('opacity-0');
            }, 600);
        }

        function showSwipeHud(icon, percent, color = 'bg-red-500') {
            if (!swipeHudEl) return;
            if (swipeHudIconEl) swipeHudIconEl.setAttribute('data-lucide', icon);
            if (swipeHudBarEl) {
                swipeHudBarEl.style.width = Math.min(100, Math.max(0, percent)) + '%';
                swipeHudBarEl.className = 'h-full rounded-full transition-all duration-75 ' + color;
            }
            if (swipeHudPercentEl) swipeHudPercentEl.textContent = Math.round(percent) + '%';
            if (window.lucide) lucide.createIcons();

            swipeHudEl.classList.remove('opacity-0');
            swipeHudEl.classList.add('opacity-100');
        }

        function hideSwipeHud() {
            if (!swipeHudEl) return;
            setTimeout(() => {
                swipeHudEl.classList.remove('opacity-100');
                swipeHudEl.classList.add('opacity-0');
            }, 500);
        }

        /* ---------------- ADVANCED FINGER PINCH ZOOM & TOUCH PLAY/STOP ---------------- */
        let isPinching = false;
        let pinchStartDistance = 0;
        let initialZoomScale = 1.0;
        let currentZoomScale = 1.0;
        let zoomPanX = 0;
        let zoomPanY = 0;
        let panStartX = 0;
        let panStartY = 0;

        function applyVideoZoom() {
            if (!mainVideo) return;
            if (currentZoomScale <= 1.02) {
                currentZoomScale = 1.0;
                zoomPanX = 0;
                zoomPanY = 0;
                mainVideo.style.transform = '';
                mainVideo.style.transformOrigin = 'center center';
            } else {
                mainVideo.style.transformOrigin = 'center center';
                mainVideo.style.transform = `scale(${currentZoomScale}) translate(${zoomPanX / currentZoomScale}px, ${zoomPanY / currentZoomScale}px)`;
            }
        }

        function showZoomToast(text) {
            const ind = document.getElementById('zoom-indicator');
            if (!ind) return;
            ind.textContent = text;
            ind.style.opacity = '1';
            ind.style.transform = 'translateX(-50%) translateY(12px)';
            clearTimeout(ind._ztimer);
            ind._ztimer = setTimeout(() => {
                ind.style.opacity = '0';
                ind.style.transform = 'translateX(-50%) translateY(0)';
            }, 1200);
        }

        if (playerContainerEl) {
            playerContainerEl.addEventListener('touchstart', (e) => {
                const target = e.target;
                if (target.closest('button') || target.closest('.timeline-container') || target.closest('.glass-panel') || target.closest('input') || target.closest('select')) {
                    return;
                }

                // Two-finger Pinch Zoom In / Out
                if (e.touches.length === 2) {
                    isPinching = true;
                    isTouching = false;
                    isSwipeGesture = false;
                    pinchStartDistance = Math.hypot(
                        e.touches[0].clientX - e.touches[1].clientX,
                        e.touches[0].clientY - e.touches[1].clientY
                    );
                    initialZoomScale = currentZoomScale;
                    return;
                }

                if (e.touches.length !== 1) return;
                const touch = e.touches[0];
                touchStartX = touch.clientX;
                touchStartY = touch.clientY;
                touchStartTime = Date.now();
                isTouching = true;
                isSwipeGesture = false;
                swipeMode = null;

                if (currentZoomScale > 1.05) {
                    panStartX = touch.clientX - zoomPanX;
                    panStartY = touch.clientY - zoomPanY;
                }

                const rect = playerContainerEl.getBoundingClientRect();
                const relativeX = touchStartX - rect.left;
                if (relativeX < rect.width * 0.45) {
                    swipeMode = 'brightness';
                    initialSwipeVal = currentBrightness;
                } else if (relativeX > rect.width * 0.55) {
                    swipeMode = 'volume';
                    initialSwipeVal = mainVideo ? mainVideo.volume : 1;
                }
            }, { passive: false });

            playerContainerEl.addEventListener('touchmove', (e) => {
                // Two-finger pinch-to-zoom scaling
                if (isPinching && e.touches.length === 2) {
                    const curDist = Math.hypot(
                        e.touches[0].clientX - e.touches[1].clientX,
                        e.touches[0].clientY - e.touches[1].clientY
                    );
                    if (pinchStartDistance > 0) {
                        const factor = curDist / pinchStartDistance;
                        currentZoomScale = Math.max(1.0, Math.min(4.5, Math.round(initialZoomScale * factor * 100) / 100));
                        applyVideoZoom();
                        showZoomToast(`🔍 Zoom: ${Math.round(currentZoomScale * 100)}%`);
                    }
                    if (e.cancelable) e.preventDefault();
                    return;
                }

                if (!isTouching || e.touches.length !== 1) return;
                const touch = e.touches[0];
                const deltaX = touch.clientX - touchStartX;
                const deltaY = touch.clientY - touchStartY;

                // When zoomed in, allow dragging / panning the video
                if (currentZoomScale > 1.05 && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
                    zoomPanX = touch.clientX - panStartX;
                    zoomPanY = touch.clientY - panStartY;
                    applyVideoZoom();
                    return;
                }

                if (Math.abs(deltaY) > 15 && Math.abs(deltaY) > Math.abs(deltaX)) {
                    isSwipeGesture = true;
                    const rect = playerContainerEl.getBoundingClientRect();
                    const travel = -deltaY / (rect.height * 0.5);

                    if (swipeMode === 'brightness') {
                        currentBrightness = Math.max(0.3, Math.min(1.8, initialSwipeVal + travel));
                        if (mainVideo) mainVideo.style.filter = `brightness(${currentBrightness})`;
                        const pct = Math.round(((currentBrightness - 0.3) / 1.5) * 100);
                        showSwipeHud('sun', pct, 'bg-amber-400');
                    } else if (swipeMode === 'volume') {
                        const newVol = Math.max(0, Math.min(1, initialSwipeVal + travel));
                        if (mainVideo) {
                            mainVideo.volume = newVol;
                            mainVideo.muted = false;
                        }
                        updateVolumeIcon();
                        const icon = newVol === 0 ? 'volume-x' : (newVol < 0.5 ? 'volume-1' : 'volume-2');
                        showSwipeHud(icon, newVol * 100, 'bg-emerald-500');
                    }
                }
            }, { passive: false });

            playerContainerEl.addEventListener('touchend', (e) => {
                if (isPinching) {
                    if (e.touches.length < 2) {
                        isPinching = false;
                        if (currentZoomScale <= 1.05) {
                            currentZoomScale = 1.0;
                            applyVideoZoom();
                            showZoomToast('Fit to Screen (100%)');
                        }
                    }
                    return;
                }

                if (!isTouching) return;
                isTouching = false;

                if (isSwipeGesture) {
                    hideSwipeHud();
                    return;
                }

                const touchDuration = Date.now() - touchStartTime;
                const touch = e.changedTouches[0];
                if (!touch) return;
                const deltaX = Math.abs(touch.clientX - touchStartX);
                const deltaY = Math.abs(touch.clientY - touchStartY);

                if (touchDuration < 320 && deltaX < 15 && deltaY < 15) {
                    const now = Date.now();
                    const rect = playerContainerEl.getBoundingClientRect();
                    const clickX = touch.clientX - rect.left;
                    const widthFraction = clickX / rect.width;

                    // Double-tap handler
                    if (now - lastTapTime < 320 && Math.abs(clickX - lastTapX) < 90) {
                        clearTimeout(singleTapTimeout);
                        lastTapTime = 0;

                        if (currentZoomScale > 1.05) {
                            // Double-tap resets finger zoom
                            currentZoomScale = 1.0;
                            applyVideoZoom();
                            showZoomToast('Zoom Reset: 100%');
                        } else if (widthFraction < 0.35) {
                            seekRelative(-10);
                            triggerRipple('left');
                        } else if (widthFraction > 0.65) {
                            seekRelative(10);
                            triggerRipple('right');
                        } else {
                            toggleAspectRatio();
                            updateMobileStatusBadges();
                        }
                    } else {
                        // Single-tap: Touch Play / Stop toggle
                        lastTapTime = now;
                        lastTapX = clickX;
                        singleTapTimeout = setTimeout(() => {
                            togglePlayPause();
                            resetControlsTimer();
                        }, 240);
                    }
                }
            }, { passive: true });
        }

        function handleGoBack() {
            if (document.referrer && document.referrer.includes(window.location.host)) {
                window.history.back();
            } else {
                window.location.href = '/' + (SOURCE_ORIGIN || 'consumet.html');
            }
        }

        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
            switch (e.code) {
                case 'Space':
                case 'KeyK':
                    e.preventDefault();
                    togglePlayPause();
                    break;
                case 'ArrowLeft':
                case 'KeyJ':
                    seekRelative(-10);
                    break;
                case 'ArrowRight':
                case 'KeyL':
                    seekRelative(10);
                    break;
                case 'ArrowUp':
                    mainVideo.volume = Math.min(1, mainVideo.volume + 0.1);
                    document.getElementById('volumeSlider').value = mainVideo.volume;
                    updateVolumeIcon();
                    break;
                case 'ArrowDown':
                    mainVideo.volume = Math.max(0, mainVideo.volume - 0.1);
                    document.getElementById('volumeSlider').value = mainVideo.volume;
                    updateVolumeIcon();
                    break;
                case 'KeyF':
                    toggleFullscreen();
                    break;
                case 'KeyM':
                    toggleMute();
                    break;
                case 'KeyS':
                    skipIntro();
                    break;
                case 'KeyN':
                    if (MEDIA_TYPE === 'tv') playNextEpisode();
                    break;
                case 'KeyR':
                    toggleRotation();
                    break;
                case 'KeyA':
                    toggleAspectRatio();
                    break;
                case 'KeyZ':
                    toggleAniSkipModal();
                    break;
                case 'Escape':
                    toggleQualityServerModal(false);
                    toggleSubtitlesModal(false);
                    toggleAniSkipModal(false);
                    toggleSleepModal(false);
                    break;
            }
        });

        window.addEventListener('popstate', (e) => {
            try {
                const url = new URL(window.location.href);
                const s = parseInt(url.searchParams.get('s') || url.searchParams.get('season') || '1', 10);
                const ep = parseInt(url.searchParams.get('e') || url.searchParams.get('episode') || '1', 10);
                if (s !== MEDIA_SEASON || ep !== MEDIA_EPISODE) {
                    switchEpisode(s, ep);
                }
            } catch (err) {}
        });
    </script>
    <script src="/party-mode.js?v=7.0"></script>
</body>
</html>
