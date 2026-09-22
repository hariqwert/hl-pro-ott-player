const fs = require('fs');

// Inject UI into hari.html
let html = fs.readFileSync('public/hari.html', 'utf8');

const analyticsHTML = `
<!-- Analytics Tab -->
<div id="tab-analytics" class="hidden space-y-6">
    <div class="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none"></div>
        <div class="relative z-10 flex items-center justify-between mb-6 border-b border-gray-800 pb-4">
            <div>
                <h2 class="text-xl font-black text-white flex items-center gap-2"><i data-lucide="activity" class="w-5 h-5 text-indigo-400"></i> Firebase Analytics</h2>
                <p class="text-xs text-gray-500 mt-1">Live traffic logs, IP tracking and paths (Last 7 Days)</p>
            </div>
            <button onclick="loadAnalytics()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20"><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Refresh</button>
        </div>
        
        <div id="analyticsContent" class="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            <div class="text-center py-10 text-gray-500 text-xs font-bold uppercase tracking-widest animate-pulse">Loading Analytics...</div>
        </div>
    </div>
</div>
`;

// Insert the tab button
html = html.replace(
    '<button onclick="switchTab(\'channels\')" id="btn-channels"',
    '<button onclick="switchTab(\'analytics\')" id="btn-analytics" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-gray-400 hover:text-white hover:bg-gray-800/50 transition-all border border-transparent"><i data-lucide="activity" class="w-4 h-4"></i> Analytics</button>\n<button onclick="switchTab(\'channels\')" id="btn-channels"'
);

// Insert the tab content
html = html.replace(
    '<!-- App & Feature Settings Tab -->',
    analyticsHTML + '\n<!-- App & Feature Settings Tab -->'
);

html = html.replace('const tabs = [', 'const tabs = [\'analytics\', ');

fs.writeFileSync('public/hari.html', html);

// Inject logic into hari.js
let js = fs.readFileSync('public/hari.js', 'utf8');

const analyticsJS = `
async function loadAnalytics() {
    const container = document.getElementById('analyticsContent');
    if (!container) return;
    container.innerHTML = '<div class="text-center py-10 text-gray-500 text-xs font-bold uppercase tracking-widest animate-pulse">Loading Analytics from Firestore...</div>';
    
    try {
        const res = await fetch('/api/admin/analytics', { headers: { 'Authorization': 'Bearer ' + window.adminToken }});
        const data = await res.json();
        if (data.status === 'success' && data.data) {
            let html = '';
            for (const [date, logs] of Object.entries(data.data)) {
                if (!logs || !logs.length) continue;
                html += \`
                    <div class="bg-black/40 rounded-xl border border-gray-800 p-4">
                        <h3 class="text-sm font-bold text-indigo-400 mb-3">\${date} <span class="text-xs text-gray-500 font-normal ml-2">(\${logs.length} hits)</span></h3>
                        <div class="space-y-1">
                            \${logs.reverse().slice(0, 50).map(l => \`
                                <div class="flex items-center gap-3 text-[11px] py-1 border-b border-gray-800/50 last:border-0">
                                    <span class="text-gray-500 w-16">\${new Date(l.time).toLocaleTimeString()}</span>
                                    <span class="text-cyan-400 font-mono w-28 truncate">\${l.ip}</span>
                                    <span class="text-white truncate flex-1">\${l.path}</span>
                                </div>
                            \`).join('')}
                        </div>
                    </div>
                \`;
            }
            container.innerHTML = html || '<div class="text-center py-10 text-gray-500 text-xs font-bold uppercase tracking-widest">No traffic logged yet.</div>';
        } else {
            container.innerHTML = '<div class="text-center py-10 text-red-400 text-xs font-bold uppercase tracking-widest">Failed to load analytics</div>';
        }
    } catch(e) {
        container.innerHTML = '<div class="text-center py-10 text-red-400 text-xs font-bold uppercase tracking-widest">Error fetching analytics</div>';
    }
}

// Hook it into switchTab
const originalSwitchTab = window.switchTab;
window.switchTab = function(tabId) {
    if (originalSwitchTab) originalSwitchTab(tabId);
    else {
        // Fallback if originalSwitchTab is not easily wrappable
        const tabsList = ['dashboard', 'm3u', 'channels', 'health', 'settings', 'backgrounds', 'logs', 'analytics'];
        tabsList.forEach(t => {
            const el = document.getElementById('tab-' + t);
            const btn = document.getElementById('btn-' + t);
            if (el) el.classList.add('hidden');
            if (btn) {
                btn.classList.remove('bg-indigo-600/10', 'text-indigo-400', 'border-indigo-500/30');
                btn.classList.add('text-gray-400', 'border-transparent');
            }
        });
        const activeEl = document.getElementById('tab-' + tabId);
        const activeBtn = document.getElementById('btn-' + tabId);
        if (activeEl) activeEl.classList.remove('hidden');
        if (activeBtn) {
            activeBtn.classList.remove('text-gray-400', 'border-transparent');
            activeBtn.classList.add('bg-indigo-600/10', 'text-indigo-400', 'border-indigo-500/30');
        }
    }
    if (tabId === 'analytics') loadAnalytics();
};
`;

fs.writeFileSync('public/hari.js', js + '\n' + analyticsJS);
console.log('Patched hari.js and hari.html with analytics');
