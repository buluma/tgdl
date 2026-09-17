import { loadConfig } from '../src/config/manager.js';
import { runPeopleScan } from '../src/core/ai/manager.js';

const started = new Date().toISOString();
const cfg = loadConfig().advanced?.ai || {};
console.log(`[${started}] Starting face detection + people clustering...`);

const result = await runPeopleScan(cfg, {
    onProgress: (p) => {
        if (p.stage === 'detecting_faces' && p.processed % 5 !== 0 && p.processed !== p.total) return;
        console.log(`[${new Date().toISOString()}] progress ${JSON.stringify(p)}`);
    },
    onLog: (e) => console.log(`[${new Date().toISOString()}] [${e.level || 'info'}] ${e.msg || JSON.stringify(e)}`),
});

console.log(`[${new Date().toISOString()}] RESULT ${JSON.stringify(result, null, 2)}`);
