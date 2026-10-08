// Dev-server endpoints for custom poses (used by the pose editor, the app and the MCP renderer):
//   GET  /__poses        -> JSON array of every poses/custom/*.json
//   POST /__poses/save   -> body = pose JSON; writes poses/custom/<id>.json
//   POST /__poses/delete -> body = {id}; removes it
import fs from 'node:fs';
import path from 'node:path';

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export function posesPlugin(root) {
  const dir = path.join(root, 'poses', 'custom');
  const readBody = (req) => new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 2e6) reject(new Error('too large')); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
  const send = (res, code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };
  return {
    name: 'poses-store',
    configureServer(server) {
      server.middlewares.use('/__poses', async (req, res, next) => {
        try {
          const url = (req.url || '/').split('?')[0];
          if (req.method === 'GET' && (url === '/' || url === '')) {
            if (!fs.existsSync(dir)) return send(res, 200, []);
            const list = [];
            for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
              try { list.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))); } catch { /* skip broken files */ }
            }
            return send(res, 200, list);
          }
          if (req.method === 'POST' && url === '/save') {
            const pose = JSON.parse(await readBody(req));
            if (!ID.test(pose?.id || '')) return send(res, 400, { error: 'id must be 1-64 letters, digits, - or _' });
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, `${pose.id}.json`), JSON.stringify(pose, null, 2));
            return send(res, 200, { ok: true, file: `poses/custom/${pose.id}.json` });
          }
          if (req.method === 'POST' && url === '/delete') {
            const { id } = JSON.parse(await readBody(req));
            if (!ID.test(id || '')) return send(res, 400, { error: 'bad id' });
            fs.rmSync(path.join(dir, `${id}.json`), { force: true });
            return send(res, 200, { ok: true });
          }
          next();
        } catch (e) {
          send(res, 500, { error: e.message });
        }
      });
    },
  };
}
