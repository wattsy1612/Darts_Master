// Test-only production-file server. Release controls are never bundled into the app.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve('dist');
let release = 1,
  failAsset = false;
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
};
createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/__test/release' && request.method === 'POST') {
    let text = '';
    for await (const chunk of request) text += chunk;
    const input = JSON.parse(text);
    release = input.release;
    failAsset = !!input.failAsset;
    response.writeHead(204).end();
    return;
  }
  const path = pathname === '/' ? '/index.html' : pathname;
  const file = resolve(root, `.${path}`);
  if (!file.startsWith(`${root}/`)) {
    response.writeHead(403).end();
    return;
  }
  try {
    if (failAsset && path === '/icon-512.png') {
      response.writeHead(503).end();
      return;
    }
    let body = await readFile(file);
    if (path === '/sw.js')
      body = Buffer.from(
        body
          .toString()
          .replace(
            /darts-master-shell-([a-f0-9]+)/g,
            `darts-master-shell-$1-test${release}`,
          ),
      );
    if (path === '/index.html')
      body = Buffer.from(
        body
          .toString()
          .replace(
            '</head>',
            `<meta name="test-release" content="${release}" /></head>`,
          ),
      );
    response
      .writeHead(200, {
        'content-type': types[extname(path)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      })
      .end(body);
  } catch {
    response.writeHead(404).end();
  }
}).listen(5180, '127.0.0.1');
