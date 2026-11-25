import { cp, mkdir, readdir, rm } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
await rm(output, { recursive: true, force: true });
await mkdir(new URL('app/', output), { recursive: true });
for (const file of ['index.html', 'favicon.png']) {
  await cp(new URL(file, root), new URL(file, output));
}
for (const item of await readdir(new URL('app/', root), { withFileTypes: true })) {
  if (item.isFile() && /\.(mjs|css)$/.test(item.name)) {
    await cp(new URL('app/' + item.name, root), new URL('app/' + item.name, output));
  }
}
console.log('Built static application in dist/');
