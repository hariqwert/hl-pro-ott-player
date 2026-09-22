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

    // 2. Disable Right-Click Context Menu (optional safety, stops 'Inspect' from context menu)
    document.addEventListener('contextmenu', function(e) {
        if (isAdminExempt()) return;
        // Check if user is clicking inside an input or editable field
        var target = e.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        return false;
    }, true);

    // 3. Window Dimension Delta Check (Docked DevTools Detection)
    function checkWindowDelta() {
        if (isAdminExempt()) return;
        var threshold = 100;
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
        if (end - start > 40) {
            triggerDevToolsLock('Debugger pause detected in devtools');
        }
    }

    // 5. Console toString / Getter Probe Check
    var probeElement = new Image();
    Object.defineProperty(probeElement, 'id', {
        get: function() {
            triggerDevToolsLock('Console probe getter evaluated');
            return 'probe';
        }
    });

    function checkConsoleProbe() {
        if (isAdminExempt()) return;
        try {
            console.log('%c', probeElement);
            console.clear();
        } catch(e) {}
    }

    // High-frequency active detection loops (every 250ms for instant reaction)
    setInterval(function() {
        checkDebuggerTiming();
        checkWindowDelta();
    }, 250);

    setInterval(function() {
        checkConsoleProbe();
    }, 600);

    window.addEventListener('resize', checkWindowDelta);
    checkWindowDelta();
    checkDebuggerTiming();
})();
