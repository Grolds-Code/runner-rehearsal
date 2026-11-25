import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

const dist = new URL('../dist/', import.meta.url);
const mime = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
const port = Number(process.env.PORT ?? 5173);

createServer(async (request, response) => {
  const method = request.method;
  if (method !== 'GET' && method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const path = (request.url ?? '').split('?')[0];
  const file = path === '/' ? 'index.html' : path.slice(1);
  const allowed = /^(?:index\.html|favicon\.png|app\/[a-z.-]+\.(?:css|mjs))$/.test(file);
  if (!allowed) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const bytes = await readFile(new URL(file, dist));
    response.writeHead(200, { 'Content-Type': mime[extname(file)], 'Content-Length': bytes.length,
      'X-Content-Type-Options': 'nosniff' });
    response.end(method === 'GET' ? bytes : undefined);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log('Runner Rehearsal at http://127.0.0.1:' + port);
});
