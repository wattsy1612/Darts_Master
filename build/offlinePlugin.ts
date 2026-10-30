import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
const publicFiles = [
  'manifest.webmanifest',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
];
export function offlinePlugin(): Plugin {
  return {
    name: 'darts-offline-shell',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle)
        .filter((name) => !name.endsWith('.map'))
        .sort();
      const hash = createHash('sha256');
      for (const name of files) {
        const output = bundle[name];
        hash.update(name);
        hash.update(output.type === 'asset' ? output.source : output.code);
      }
      for (const name of publicFiles) {
        hash.update(name);
        hash.update(
          readFileSync(new URL(`../public/${name}`, import.meta.url)),
        );
      }
      const template = readFileSync(
        new URL('./offline-worker.js', import.meta.url),
        'utf8',
      );
      hash.update(template);
      const cache = `darts-master-shell-${hash.digest('hex').slice(0, 20)}`;
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template
          .replace('__CACHE_NAME__', JSON.stringify(cache))
          .replace(
            '__PRECACHE_FILES__',
            JSON.stringify([...files, ...publicFiles]),
          ),
      });
    },
  };
}
