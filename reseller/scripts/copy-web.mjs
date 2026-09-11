// tsc only emits .js from .ts, so the static UI has to be copied into dist/.
import { cp, mkdir } from 'node:fs/promises';

await mkdir('dist/web', { recursive: true });
await cp('src/web', 'dist/web', { recursive: true });
console.log('copied src/web -> dist/web');
