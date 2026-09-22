const fs = require('fs');

let code = fs.readFileSync('src/services/firestoreSyncService.ts', 'utf8');

const getAnalyticsCode = `
export async function getAnalyticsFromFirestore(days = 7) {
    if (!db) return { error: "Firestore not initialized" };
    try {
        const results = {};
        for (let i = 0; i < days; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const docRef = doc(db, 'analytics', dateStr);
            const docSnap = await getDoc(docRef).catch(()=>null);
            if (docSnap && docSnap.exists()) {
                results[dateStr] = docSnap.data().logs || [];
            }
        }
        return results;
    } catch(e) {
        console.error("Failed to fetch analytics:", e);
        return { error: e.message };
    }
}
`;

if (!code.includes('getAnalyticsFromFirestore')) {
    fs.writeFileSync('src/services/firestoreSyncService.ts', code + '\n' + getAnalyticsCode);
}

// 2. Add endpoint to server.ts
let serverCode = fs.readFileSync('server.ts', 'utf8');
if (!serverCode.includes('/api/admin/analytics')) {
    serverCode = serverCode.replace(
        "import { syncFromFirestore, syncM3uFromFirestore, logIpToFirestore } from './src/services/firestoreSyncService';",
        "import { syncFromFirestore, syncM3uFromFirestore, logIpToFirestore, getAnalyticsFromFirestore } from './src/services/firestoreSyncService';"
    );
    
    const endpoint = `
app.get('/api/admin/analytics', requireAdmin, async (req, res) => {
    try {
        const data = await getAnalyticsFromFirestore(7);
        res.json({ status: 'success', data });
    } catch(e) {
        res.status(500).json({ status: 'error', message: String(e) });
    }
});
`;
    // Insert endpoint near /api/admin/system/logs
    serverCode = serverCode.replace("app.get('/api/admin/system/logs'", endpoint + "\napp.get('/api/admin/system/logs'");
    fs.writeFileSync('server.ts', serverCode);
}
console.log('Patched analytics backend');
