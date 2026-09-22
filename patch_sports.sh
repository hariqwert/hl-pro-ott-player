sed -i -e '/async function loadSportsChannels() {/!b' -e ':a' -e 'N' -e '/const text = await response.text();/!ba' -e 'c\
async function loadSportsChannels() {\
try {\
    const ts = Date.now();\
    const [proxyReq, containersReq, hubReq, adminReq, m3uReq] = await Promise.all([\
        fetch("/api/sports/proxy-streams").catch(() => null),\
        fetch("/api/sports/containers?_t=" + ts).catch(() => null),\
        fetch("/api/sports/hub-config?_t=" + ts).catch(() => null),\
        fetch("/api/sports?_t=" + ts).catch(() => null),\
        fetch("/sports.m3u?refresh=1&nocache=" + ts).catch(() => null)\
    ]);\
    let proxyStreams = [];\
    if (proxyReq) {\
        try {\
            const proxyData = await proxyReq.json();\
            if (proxyData && proxyData.channels && Array.isArray(proxyData.channels)) {\
                proxyStreams = proxyData.channels.map(ps => ({\
                    name: ps.name || "⚡ Proxy Channel",\
                    url: ps.url || ps.stream_url || ("/api/play_stream/" + ps.channel_id),\
                    stream_url: ps.stream_url || ps.url || ("/api/play_stream/" + ps.channel_id),\
                    logo: ps.logo || "",\
                    genre: "Proxy Streams",\
                    source: ps.source || "dlhd",\
                    isProxyStream: true\
                }));\
            }\
        } catch(e) {}\
    }\
    window.proxyStreamsList = proxyStreams;\
    window.sportsContainersList = [];\
    window.sportsHubConfig = { title: "CUSTOM SPORTS STREAMS", subtitle: "High-speed live sports broadcasts.", badge: "EXCLUSIVE FEEDS", bgUrl: "", playerPng: "", gridBgUrl: "", displayMode: "shelf" };\
    if (containersReq) {\
        try {\
            const cData = await containersReq.json();\
            if (cData && cData.status === "success" && Array.isArray(cData.containers)) {\
                window.sportsContainersList = cData.containers;\
                if (cData.containers[0]) window.sportsHubConfig = { ...window.sportsHubConfig, ...cData.containers[0], displayMode: cData.containers[0].gridStyle || "shelf" };\
            }\
        } catch(e) {}\
    }\
    if (window.sportsContainersList.length === 0 && hubReq) {\
        try {\
            const hData = await hubReq.json();\
            if (hData && hData.title) window.sportsHubConfig = hData;\
        } catch(e) {}\
    }\
    let customSports = [];\
    if (adminReq) {\
        try {\
            const aData = await adminReq.json();\
            if (Array.isArray(aData)) customSports = aData.map(s => ({ name: "💎 " + s.title, url: s.url, logo: s.icon || "", bgUrl: s.bgUrl || "" }));\
        } catch(e) {}\
    }\
    const text = m3uReq ? await m3uReq.text() : "";\
' consumet.html
