import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { get } from 'node:https';

export async function download(url: string, outPath: string) {
  const dir = dirname(outPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  await new Promise<void>((resolve, reject) => {
    get(url, (res) => {
      if (!res || (res.statusCode && res.statusCode >= 400)) return reject(new Error(String(res?.statusCode)));
      const file = createWriteStream(outPath);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    }).on('error', reject);
  });
}

export function localAssetPath(url: string) {
  const u = new URL(url);
  const file = u.pathname.split('/').filter(Boolean).pop() || `img-${Date.now()}`;
  return join('public', 'notion-assets', file);
}

export function publicAssetUrl(fileName: string) {
  return `/notion-assets/${fileName}`;
}

export { basename };
