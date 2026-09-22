const fs = require('fs');

let content = fs.readFileSync('src/services/firestoreSyncService.ts', 'utf8');

// Add imports
content = content.replace("import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';", "import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';");

// Append new functions
const newFunctions = `
const MAX_CHUNK_SIZE = 900000;

export async function syncM3uFromFirestore() {
    if (!db) return;
    try {
        const vaultDir = path.join(process.cwd(), 'doctor_strange', 'm3u_playlists');
        if (!fs.existsSync(vaultDir)) fs.mkdirSync(vaultDir, { recursive: true });

        const m3uRef = collection(db, 'm3u_playlists');
        const qSnap = await getDocs(m3uRef);
        
        const fileChunks: { [filename: string]: { [index: number]: { content: string, total: number } } } = {};
        
        qSnap.forEach(docSnap => {
            const data = docSnap.data();
            const filename = data.filename;
            const index = data.index || 0;
            const content = data.content || '';
            const total = data.totalChunks || 1;
            
            if (filename) {
                if (!fileChunks[filename]) fileChunks[filename] = {};
                fileChunks[filename][index] = { content, total };
            }
        });
        
        for (const filename of Object.keys(fileChunks)) {
            const chunksMap = fileChunks[filename];
            const maxIndex = Math.max(...Object.keys(chunksMap).map(Number));
            // Ensure we use the totalChunks from the chunk to know how many valid chunks there are
            let totalChunks = 0;
            if (chunksMap[0]) totalChunks = chunksMap[0].total;
            else if (chunksMap[maxIndex]) totalChunks = chunksMap[maxIndex].total;
            
            let fullContent = '';
            for (let i = 0; i < totalChunks; i++) {
                if (chunksMap[i]) {
                    fullContent += chunksMap[i].content;
                }
            }
            
            if (fullContent.length > 0) {
                const filePath = path.join(vaultDir, filename);
                fs.writeFileSync(filePath, fullContent, 'utf8');
            }
        }
        console.log(\`[Firestore] Successfully downloaded \${Object.keys(fileChunks).length} M3U playlists from Firestore.\`);
    } catch (e) {
        console.error('[Firestore] Error syncing M3U from Firestore:', e);
    }
}

export async function syncM3uToFirestore(filename: string, content: string) {
    if (!db) return;
    try {
        const chunks = [];
        for (let i = 0; i < content.length; i += MAX_CHUNK_SIZE) {
            chunks.push(content.substring(i, i + MAX_CHUNK_SIZE));
        }
        
        for (let i = 0; i < chunks.length; i++) {
            const docRef = doc(db, 'm3u_playlists', \`\${filename}_chunk_\${i}\`);
            await setDoc(docRef, {
                filename,
                index: i,
                content: chunks[i],
                totalChunks: chunks.length,
                updatedAt: Date.now()
            });
        }
        
        for (let i = chunks.length; i < chunks.length + 50; i++) {
            const docRef = doc(db, 'm3u_playlists', \`\${filename}_chunk_\${i}\`);
            await deleteDoc(docRef).catch(() => {});
        }
        
        console.log(\`[Firestore] Successfully uploaded M3U \${filename} to Firestore in \${chunks.length} chunks.\`);
    } catch (e) {
        console.error(\`[Firestore] Error syncing M3U \${filename} to Firestore:\`, e);
    }
}

export async function deleteM3uFromFirestore(filename: string) {
    if (!db) return;
    try {
        for (let i = 0; i < 50; i++) {
            const docRef = doc(db, 'm3u_playlists', \`\${filename}_chunk_\${i}\`);
            await deleteDoc(docRef).catch(() => {});
        }
        console.log(\`[Firestore] Successfully deleted M3U \${filename} from Firestore.\`);
    } catch (e) {
        console.error(\`[Firestore] Error deleting M3U \${filename} from Firestore:\`, e);
    }
}
`;

fs.writeFileSync('src/services/firestoreSyncService.ts', content + newFunctions);
console.log('Patched firestoreSyncService.ts');
