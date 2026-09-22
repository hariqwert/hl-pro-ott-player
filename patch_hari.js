const fs = require('fs');

let html = fs.readFileSync('public/hari.html', 'utf8');

const injectUploadBtn = (id) => `
    <div class="flex gap-2 w-full mt-2">
        <input type="text" id="${id}" placeholder="URL or Video ID" class="w-full bg-gray-900/80 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 transition-all outline-none">
        <button type="button" onclick="document.getElementById('${id}Upload').click()" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all whitespace-nowrap"><i data-lucide="upload" class="w-4 h-4 inline"></i> Upload</button>
        <input type="file" id="${id}Upload" class="hidden" accept="video/mp4,video/webm,image/jpeg,image/png,image/webp" onchange="handleBgUpload(event, '${id}')">
    </div>
`;

// Replace inputs with inputs + upload button
html = html.replace('<input type="text" id="bgConsumet" placeholder="e.g. jfKfPfyJRdk" class="w-full bg-gray-900/80 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 transition-all outline-none">', injectUploadBtn('bgConsumet'));
html = html.replace('<input type="text" id="bgIndex" placeholder="e.g. jfKfPfyJRdk" class="w-full bg-gray-900/80 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 transition-all outline-none">', injectUploadBtn('bgIndex'));
html = html.replace('<input type="text" id="bgMusic" placeholder="e.g. jfKfPfyJRdk" class="w-full bg-gray-900/80 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 transition-all outline-none">', injectUploadBtn('bgMusic'));
html = html.replace('<input type="text" id="bgHero" placeholder="e.g. jfKfPfyJRdk" class="w-full bg-gray-900/80 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 transition-all outline-none">', injectUploadBtn('bgHero'));

// Inject upload handler
html = html.replace('</body>', `
<script>
async function handleBgUpload(e, targetId) {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('videoFile', file);
    
    showToast('Uploading file...', 'info');
    try {
        const res = await fetch('/api/admin/maintenance/upload-video', {
            method: 'POST',
            body: formData,
            headers: { 'Authorization': 'Bearer ' + (window.adminToken || '') }
        });
        const data = await res.json();
        if (data.status === 'success') {
            document.getElementById(targetId).value = data.fileUrl;
            document.getElementById(targetId + 'Type').value = file.type.startsWith('image/') ? 'image' : 'video';
            showToast('File uploaded successfully', 'success');
        } else {
            showToast(data.message || 'Upload failed', 'error');
        }
    } catch(err) {
        showToast('Upload error', 'error');
    }
}
</script>
</body>`);

fs.writeFileSync('public/hari.html', html);
console.log('Patched hari.html');
