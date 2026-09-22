const fs = require('fs');
let code = fs.readFileSync('play_bingr.php', 'utf8');

const targetStr = `        const EMBED_PROVIDERS = [
            { id: 'vidlink_pro', name: 'VidLink Pro', url: (t, id, s, e) => t === 'tv' ? \`https://vidlink.pro/tv/\${id}/\${s}/\${e}?autoplay=true\` : \`https://vidlink.pro/movie/\${id}?autoplay=true\` },
            { id: 'vidrift', name: 'Vidrift', url: (t, id, s, e) => t === 'tv' ? \`https://embed.vidrift.in/embed/tv/\${id}/\${s}/\${e}\` : \`https://embed.vidrift.in/embed/movie/\${id}\` },
            { id: 'vidsrc_pm', name: 'VidSrc PM', url: (t, id, s, e) => t === 'tv' ? \`https://vidsrc.pm/embed/tv/\${id}/\${s}/\${e}\` : \`https://vidsrc.pm/embed/movie/\${id}\` },
            { id: 'vidsrc_to', name: 'VidSrc TO', url: (t, id, s, e) => t === 'tv' ? \`https://vidsrc.to/embed/tv/\${id}/\${s}/\${e}\` : \`https://vidsrc.to/embed/movie/\${id}\` },
            { id: 'vidsrc_in', name: 'VidSrc IN', url: (t, id, s, e) => t === 'tv' ? \`https://vidsrc.in/embed/tv/\${id}/\${s}/\${e}\` : \`https://vidsrc.in/embed/movie/\${id}\` },
            { id: 'smashy', name: 'SmashyStream', url: (t, id, s, e) => t === 'tv' ? \`https://embed.smashystream.com/playere.php?tmdb=\${id}&season=\${s}&episode=\${e}\` : \`https://embed.smashystream.com/playere.php?tmdb=\${id}\` },
            { id: 'filmu', name: 'Filmu Stream', url: (t, id, s, e) => t === 'tv' ? \`https://embed.filmu.in/tv/\${id}/\${s}/\${e}\` : \`https://embed.filmu.in/movie/\${id}\` },
            { id: 'cinezo', name: 'Cinezo HD', url: (t, id, s, e) => t === 'tv' ? \`https://player.cinezo.live/embed/tv/\${id}/\${s}/\${e}\` : \`https://player.cinezo.live/embed/movie/\${id}\` },
            { id: '2embed', name: '2Embed Multi', url: (t, id, s, e) => t === 'tv' ? \`https://www.2embed.cc/embedtv/\${id}?s=\${s}&e=\${e}\` : \`https://www.2embed.cc/embed/\${id}\` }
        ];`;

const replaceStr = `        const EMBED_PROVIDERS = [
            { id: 'vidlink_pro', name: 'VidLink Pro', url: (t, id, s, e) => (t === 'tv' || t === 'series') ? \`https://vidlink.pro/tv/\${id}/\${s}/\${e}?autoplay=true\` : \`https://vidlink.pro/movie/\${id}?autoplay=true\` },
            { id: 'vidrift', name: 'Vidrift', url: (t, id, s, e) => (t === 'tv' || t === 'series') ? \`https://embed.vidrift.in/embed/tv/\${id}/\${s}/\${e}\` : \`https://embed.vidrift.in/embed/movie/\${id}\` },
            { id: 'vidsrc_pm', name: 'VidSrc PM', url: (t, id, s, e) => (t === 'tv' || t === 'series') ? \`https://vidsrc.pm/embed/tv/\${id}/\${s}/\${e}\` : \`https://vidsrc.pm/embed/movie/\${id}\` },
            { id: 'vidsrc_to', name: 'VidSrc TO', url: (t, id, s, e) => (t === 'tv' || t === 'series') ? \`https://vidsrc.to/embed/tv/\${id}/\${s}/\${e}\` : \`https://vidsrc.to/embed/movie/\${id}\` },
            { id: 'vidsrc_in', name: 'VidSrc IN', url: (t, id, s, e) => (t === 'tv' || t === 'series') ? \`https://vidsrc.in/embed/tv/\${id}/\${s}/\${e}\` : \`https://vidsrc.in/embed/movie/\${id}\` },
            { id: 'smashy', name: 'SmashyStream', url: (t, id, s, e) => (t === 'tv' || t === 'series') ? \`https://embed.smashystream.com/playere.php?tmdb=\${id}&season=\${s}&episode=\${e}\` : \`https://embed.smashystream.com/playere.php?tmdb=\${id}\` },
            { id: 'filmu', name: 'Filmu Stream', url: (t, id, s, e) => (t === 'tv' || t === 'series') ? \`https://embed.filmu.in/tv/\${id}/\${s}/\${e}\` : \`https://embed.filmu.in/movie/\${id}\` },
            { id: 'cinezo', name: 'Cinezo HD', url: (t, id, s, e) => (t === 'tv' || t === 'series') ? \`https://player.cinezo.live/embed/tv/\${id}/\${s}/\${e}\` : \`https://player.cinezo.live/embed/movie/\${id}\` },
            { id: '2embed', name: '2Embed Multi', url: (t, id, s, e) => (t === 'tv' || t === 'series') ? \`https://www.2embed.cc/embedtv/\${id}?s=\${s}&e=\${e}\` : \`https://www.2embed.cc/embed/\${id}\` }
        ];`;

code = code.replace(targetStr, replaceStr);

fs.writeFileSync('play_bingr.php', code);
