function buildPatch() {
    return `// 3. SPORTS CHANNELS ENGINE
async function loadSportsChannels() {
try {
    const ts = Date.now();
    const [proxyRes, containersRes, hubRes, adminRes, m3uRes] = await Promise.all([
        fetch('/api/sports/proxy-streams').catch(() => null),
        fetch('/api/sports/containers?_t=' + ts).catch(() => null),
        fetch('/api/sports/hub-config?_t=' + ts).catch(() => null),
        fetch('/api/sports?_t=' + ts).catch(() => null),
        fetch('/sports.m3u?refresh=1&nocache=' + ts).catch(() => null)
    ]);
`;
}
