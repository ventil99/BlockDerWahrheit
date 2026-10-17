import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const root = resolve('../../publish/wwwroot');
const basePath = process.env.PWA_BASE_PATH ?? '/';
const prefix = basePath.endsWith('/') ? basePath : `${basePath}/`;
const contentTypes = {
  '.blat': 'application/octet-stream',
  '.css': 'text/css; charset=utf-8',
  '.dat': 'application/octet-stream',
  '.dll': 'application/octet-stream',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  if (!pathname.startsWith(prefix)) {
    response.writeHead(404).end();
    return;
  }

  const relativePath = decodeURIComponent(pathname.slice(prefix.length)) || 'index.html';
  const filePath = resolve(root, relativePath);
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    response.writeHead(400).end();
    return;
  }

  try {
    if (!(await stat(filePath)).isFile()) {
      response.writeHead(404).end();
      return;
    }
  } catch {
    response.writeHead(404).end();
    return;
  }

  response.writeHead(200, {
    'Cache-Control': 'no-cache',
    'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
  });
  if (request.method === 'HEAD') response.end();
  else createReadStream(filePath).pipe(response);
});

server.listen(Number(process.env.PORT ?? 5179), '127.0.0.1');
