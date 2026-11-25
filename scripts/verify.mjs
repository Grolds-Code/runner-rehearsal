import { readFile, stat } from 'node:fs/promises';
import { verifyProof } from '../app/proof.mjs';
import { limits } from '../app/tape.mjs';

try {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: node scripts/verify.mjs path-to-proof.json');
  const file = await stat(path);
  if (!file.isFile() || file.size > limits.fileBytes) throw new Error('Choose a proof under 192 KiB.');
  const proof = JSON.parse(await readFile(path, 'utf-8'));
  console.log(JSON.stringify(await verifyProof(proof), null, 2));
} catch (error) {
  console.error('Proof rejected. ' + error.message);
  process.exitCode = 1;
}
