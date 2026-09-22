const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// The string `};\n\n`;\n\n// Real-time Event Emitter`
// Wait, let's just manually replace it.
code = code.replace('}};\n`;\n// Real-time Event Emitter for Live Video Broadcast Updates (SSE & status sync)\n`;\n\nexport const videoBroadcastEmitter = new EventEmitter();', '}};\n\n// Real-time Event Emitter for Live Video Broadcast Updates (SSE & status sync)\nexport const videoBroadcastEmitter = new EventEmitter();');

// Also remove `;\n\nexport const videoBroadcastEmitter = new EventEmitter();` if it exists.
code = code.replace(/`\s*;\s*\/\/\s*Real-time[\s\S]*?export const videoBroadcastEmitter = new EventEmitter\(\);/g, '// Real-time Event Emitter for Live Video Broadcast Updates (SSE & status sync)\nexport const videoBroadcastEmitter = new EventEmitter();');

fs.writeFileSync('server.ts', code);
console.log('Fixed early backticks');
