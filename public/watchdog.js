(function() {
    if (window.__maintenanceWatchdogActive) return;
    window.__maintenanceWatchdogActive = true;

    // Sync unlock token from URL to localStorage, sessionStorage, and cookies
    try {
        var urlParams = new URLSearchParams(window.location.search);
        var urlUnlockToken = urlParams.get('unlock_token');
        if (urlUnlockToken) {
            localStorage.setItem('site_unlock_token', urlUnlockToken);
            sessionStorage.setItem('site_unlock_token', urlUnlockToken);
            var isHttps = window.location.protocol === 'https:';
            document.cookie = "site_unlock_token=" + encodeURIComponent(urlUnlockToken) + "; path=/; max-age=604800; " + (isHttps ? "SameSite=None; Secure" : "SameSite=Lax");
        } else {
            var savedToken = localStorage.getItem('site_unlock_token') || sessionStorage.getItem('site_unlock_token');
            if (savedToken && document.cookie.indexOf('site_unlock_token=') === -1) {
                var isHttps = window.location.protocol === 'https:';
                document.cookie = "site_unlock_token=" + encodeURIComponent(savedToken) + "; path=/; max-age=604800; " + (isHttps ? "SameSite=None; Secure" : "SameSite=Lax");
            }
        }
    } catch (e) {}

    // Detect if current page is explicitly the server-rendered 503 Maintenance / Offline page
    function checkIs503Page() {
        if (window.__IS_503_MAINTENANCE_PAGE__ === true) return true;
        if (document.getElementById('stalker-maintenance-portal') || document.querySelector('[data-page="maintenance-503"]')) {
            return true;
        }
        if (document.getElementById('broadcastOverlay') || document.getElementById('maintenanceAudioToggleBtn') || document.getElementById('musicControlBar')) {
            return true;
        }
        var title = (document.title || '').toLowerCase();
        if (title.includes('maintenance') || title.includes('downtime') || title.includes('offline') || title.includes('503')) {
            return true;
        }
        return false;
    }

    // Detect if current page is the Quantum Lock Screen
    function checkIsLockPage() {
        if (window.__IS_SITE_LOCKED_PAGE__ === true) return true;
        if (document.getElementById('stalker-lock-portal') || document.querySelector('[data-page="site-lock-screen"]')) {
            return true;
        }
        if (document.getElementById('lockCard') || document.getElementById('lockForm')) {
            return true;
        }
        var title = (document.title || '').toLowerCase();
        if (title.includes('restricted access') || title.includes('site locked') || title.includes('quantum lock') || title.includes('locked')) {
            return true;
        }
        return false;
    }

    var lastReloadTime = 0;
    function safeReload(reason) {
        var now = Date.now();
        // Prevent rapid reload loops (minimum 2.5s cooldown)
        if (now - lastReloadTime < 2500) {
            return;
        }
        lastReloadTime = now;
        console.log('[Watchdog] Triggering instant reload:', reason);
        window.location.reload();
    }

    async function checkStatus() {
        try {
            var is503Page = checkIs503Page();
            var isLockPage = checkIsLockPage();
            var currentPath = (window.location.pathname || '/') + (window.location.search || '');
            
            // Never trigger reload on Hari Admin Console or if admin is authenticated, but allow UI updates (banners/video)
            var isAdminOrHari = (document.cookie.indexOf('admin_auth=') !== -1 || window.location.pathname.startsWith('/hari'));

            var storedUnlockToken = '';
            try {
                storedUnlockToken = localStorage.getItem('site_unlock_token') || sessionStorage.getItem('site_unlock_token') || '';
            } catch(e) {}

            var reqHeaders = { 'X-Requested-With': 'XMLHttpRequest' };
            if (storedUnlockToken) {
                reqHeaders['X-Site-Unlock-Token'] = storedUnlockToken;
            }

            var res = await fetch('/api/system/public-status?page=' + encodeURIComponent(currentPath) + (storedUnlockToken ? ('&unlock_token=' + encodeURIComponent(storedUnlockToken)) : '') + '&t=' + Date.now(), {
                cache: 'no-store',
                credentials: 'same-origin',
                headers: reqHeaders
            });
            if (!res.ok) return;
            var data = await res.json();
            if (!data) return;

            // 1. Check Site Lock Mode State (Priority: Instant Lock Screen Gate)
            if (typeof data.locked === 'boolean' && !isAdminOrHari) {
                if (!isLockPage && data.locked === true) {
                    safeReload('Lock Mode activated! Redirecting to Lock Gate...');
                    return;
                } else if (isLockPage && data.locked === false) {
                    safeReload('Lock Mode deactivated or unlocked! Restoring website content...');
                    return;
                }
            }

            // 2. Check Maintenance Mode State
            if (typeof data.maintenance === 'boolean' && !data.locked && !isAdminOrHari) {
                if (!is503Page && data.maintenance === true) {
                    safeReload('Maintenance Mode activated! Reloading to show Maintenance Page...');
                } else if (is503Page && data.maintenance === false) {
                    safeReload('Maintenance Mode deactivated! Restoring Portal...');
                }
            }

            // 3. Live Broadcast Video Dynamic Update (No Reload Required)
            if (data.videoBroadcast && typeof window.applyLiveVideoBroadcastUpdate === 'function') {
                window.applyLiveVideoBroadcastUpdate(data.videoBroadcast);
            }

            // 4. Maintenance Schedule Banner & Countdown Update
            if (data.maintenanceSchedule && typeof window.updateMaintenanceScheduleBanner === 'function') {
                window.updateMaintenanceScheduleBanner(data.maintenanceSchedule);
            } else if (data.maintenanceSchedule) {
                var banner = document.getElementById('maintenanceScheduleBanner');
                if (banner) {
                    if (data.maintenanceSchedule.scheduled && data.maintenanceSchedule.timeRemainingSeconds > 0) {
                        banner.classList.remove('hidden');
                        var notice = document.getElementById('maintNoticeText');
                        if (notice && data.maintenanceSchedule.noticeText) {
                            notice.innerText = data.maintenanceSchedule.noticeText;
                        }
                        var timer = document.getElementById('maintCountdownTimer');
                        if (timer) {
                            var secs = data.maintenanceSchedule.timeRemainingSeconds;
                            var h = Math.floor(secs / 3600);
                            var m = Math.floor((secs % 3600) / 60);
                            var s = secs % 60;
                            timer.innerText = (h > 0 ? (h + 'h ') : '') + (m < 10 ? '0' : '') + m + 'm ' + (s < 10 ? '0' : '') + s + 's';
                        }
                    } else {
                        banner.classList.add('hidden');
                    }
                }
            }
        } catch(e) {}
    }

    // Run status check periodically (every 2 seconds for instant sync)
    setInterval(checkStatus, 2000);
    setTimeout(checkStatus, 600);
    setTimeout(checkStatus, 1500);

    // Also check immediately when window gains focus or visibility
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            checkStatus();
        }
    });
    window.addEventListener('focus', checkStatus);
})();

// ==============================================================================
// STALKER PRO & AETHERIS ANTI-INSPECT / DEVTOOLS DEFENSE SHIELD
// Detects developer tools opening, inspect element, console access, keyboard shortcuts
// and redirects unauthorized inspection attempts to about:blank.
// ==============================================================================
(function() {
    'use strict';

    if (window.__stalkerSecurityGuardActive) return;
    window.__stalkerSecurityGuardActive = true;

    // Do not trigger lock/redirect if user is logged into the admin dashboard or on /hari
    function isAdminExempt() {
        try {
            var isAdminAuth = document.cookie.indexOf('admin_auth=') !== -1;
            var isHariPath = window.location.pathname.startsWith('/hari');
            var isLocalAdmin = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
            return isAdminAuth || isHariPath || !!isLocalAdmin;
        } catch (e) {
            return false;
        }
    }

    var triggered = false;
    function triggerDevToolsLock(reason) {
        if (triggered) return;
        if (isAdminExempt()) return;
        
        triggered = true;
        try {
            console.clear();
        } catch(e) {}

        // Immediate redirection to about:blank
        try {
            window.location.replace('about:blank');
        } catch (e) {
            window.location.href = 'about:blank';
        }
    }

    // 1. Block Keyboard Shortcuts for Developer Tools & Source Inspection
    window.addEventListener('keydown', function(e) {
        if (isAdminExempt()) return;

        var key = e.key ? e.key.toUpperCase() : '';
        var keyCode = e.keyCode || e.which;

        // F12 key
        if (key === 'F12' || keyCode === 123) {
            e.preventDefault();
            e.stopPropagation();
            triggerDevToolsLock('F12 pressed');
            return false;
        }

        // Ctrl + Shift + I (Inspect) or Cmd + Option + I (Mac)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === 'I' || keyCode === 73)) {
            e.preventDefault();
            e.stopPropagation();
            triggerDevToolsLock('Ctrl+Shift+I inspect attempt');
            return false;
        }

        // Ctrl + Shift + J (Console) or Cmd + Option + J (Mac)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === 'J' || keyCode === 74)) {
            e.preventDefault();
            e.stopPropagation();
            triggerDevToolsLock('Ctrl+Shift+J console attempt');
            return false;
        }

        // Ctrl + Shift + C (Element Inspector) or Cmd + Option + C (Mac)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === 'C' || keyCode === 67)) {
            e.preventDefault();
            e.stopPropagation();
            triggerDevToolsLock('Ctrl+Shift+C element inspector attempt');
            return false;
        }

        // Ctrl + U or Cmd + U (View Source)
        if ((e.ctrlKey || e.metaKey) && (key === 'U' || keyCode === 85)) {
            e.preventDefault();
            e.stopPropagation();
            triggerDevToolsLock('Ctrl+U view-source attempt');
            return false;
        }

        // Ctrl + S (Save Page)
        if ((e.ctrlKey || e.metaKey) && (key === 'S' || keyCode === 83)) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, true);

    // 2. Disable Right-Click Context Menu (stops 'Inspect' from context menu)
    document.addEventListener('contextmenu', function(e) {
        if (isAdminExempt()) return;
        var target = e.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
            return;
        }
        e.preventDefault();
        return false;
    }, true);

    // 3. Window Dimension Delta Check (Docked DevTools Detection)
    function checkWindowDelta() {
        if (isAdminExempt()) return;
        var threshold = 160;
        var widthDiff = window.outerWidth - window.innerWidth;
        var heightDiff = window.outerHeight - window.innerHeight;

        // If width or height disparity is significantly larger than browser chrome/scrollbars
        if (widthDiff > threshold || heightDiff > threshold) {
            triggerDevToolsLock('Docked devtools dimension change detected');
        }
    }

    // 4. Debugger Timing & Execution Delay Detection (Undocked / Docked DevTools Detection)
    function checkDebuggerTiming() {
        if (isAdminExempt()) return;
        var start = performance.now();
        /* eslint-disable no-debugger */
        (function() {
            var fn = new Function('debugger');
            fn();
        })();
        /* eslint-enable no-debugger */
        var end = performance.now();
        if (end - start > 100) {
            triggerDevToolsLock('Debugger pause detected in devtools');
        }
    }

    // 5. Console toString / Getter Probe Check
    function checkConsoleProbe() {
        if (isAdminExempt()) return;
        var element = new Image();
        Object.defineProperty(element, 'id', {
            get: function() {
                triggerDevToolsLock('Console probe getter evaluated');
                return 'probe';
            }
        });
        try {
            console.log('%c', element);
            console.clear();
        } catch(e) {}
    }

    // Periodic detection loops with jitter
    setInterval(function() {
        checkDebuggerTiming();
        checkWindowDelta();
    }, 1000);

    setInterval(function() {
        checkConsoleProbe();
    }, 2500);

    window.addEventListener('resize', checkWindowDelta);
})();



