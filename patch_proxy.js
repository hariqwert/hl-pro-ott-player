const fs = require('fs');
let code = fs.readFileSync('src/proxy.ts', 'utf8');
code = code.replace(/QuarantineService\.quarantineStreamOnFailure\(stream, \`Non-playlist upstream response\`, 502, req_id\);/, `QuarantineService.quarantineStreamOnFailure(stream, \`Non-playlist upstream response\`, 502, req_id);
                        if (req_id) {
                            const cacheFile = require("path").join(process.cwd(), "cache_stalker", \`\${req_id}.json\`);
                            if (require("fs").existsSync(cacheFile)) {
                                try { require("fs").unlinkSync(cacheFile); } catch(e){}
                            }
                        }`);
fs.writeFileSync('src/proxy.ts', code);
