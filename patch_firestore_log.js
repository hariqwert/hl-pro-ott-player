const fs = require('fs');
let code = fs.readFileSync('src/services/firestoreSyncService.ts', 'utf8');

const logCode = `
export async function logIpToFirestore(ip, reqPath) {
    if (!db) return;
    try {
        // Only log real IPs
        if (ip === '127.0.0.1' || ip === '::1') return;
        
        // We'll just append it to a daily doc
        const today = new Date().toISOString().split('T')[0];
        const docRef = doc(db, 'analytics', today);
        const docSnap = await getDoc(docRef);
        
        let data = { logs: [] };
        if (docSnap.exists()) {
            data = docSnap.data();
            if (!data.logs) data.logs = [];
        }
        
        data.logs.push({
            ip: ip,
            path: reqPath,
            time: Date.now()
        });
        
        // Trim to last 1000 logs per day to avoid huge docs
        if (data.logs.length > 1000) data.logs = data.logs.slice(-1000);
        
        await setDoc(docRef, data);
    } catch(e) {
        console.error("Failed to log IP to firestore:", e);
    }
}
`;

fs.writeFileSync('src/services/firestoreSyncService.ts', code + logCode);
