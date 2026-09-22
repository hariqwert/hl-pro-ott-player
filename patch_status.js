const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
    /const isMaintenance = systemState\.status === 'offline' \|\| systemState\.status === 'killed' \|\| systemState\.maintenanceMode \|\| isSpecific;/,
    `let isMaintenance = systemState.status === 'offline' || systemState.status === 'killed' || systemState.maintenanceMode || isSpecific;

    // Check if admin is bypassed so we don't trigger automatic reloads for them on the frontend
    if (systemState.maintenanceAdminBypass) {
        const cookieHeader = req.headers.cookie || '';
        const cookies = cookieHeader.split(';').reduce((acc, c) => {
            const [name, val] = c.trim().split('=');
            if (name && val) acc[name] = val;
            return acc;
        }, {} as Record<string, string>);
        
        if (cookies.admin_auth) {
            try {
                const JWT_SECRET = process.env.JWT_SECRET || 'stalker_pro_super_secret_key_2024';
                const decoded = require('jsonwebtoken').verify(cookies.admin_auth, JWT_SECRET);
                if (decoded && decoded.role === 'admin') {
                    isMaintenance = false;
                }
            } catch (e) {}
        }
    }`
);

fs.writeFileSync('server.ts', code);
