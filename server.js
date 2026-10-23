import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(import.meta.dirname);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ttl': 'text/turtle', '.png': 'image/png', '.jpg': 'image/jpeg' };
createServer(async (request, response) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/\/$/, '/index.html'));
    if (!path.startsWith(root + sep) || path.includes(sep + '.') || path.includes(sep + 'node_modules' + sep)) {
      response.writeHead(403).end(); return;
    }
    const data = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' }).end(data);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(8080, '127.0.0.1', () => console.log('Local: http://127.0.0.1:8080'));
