// Creates the paired Figma companion from bundled resources without printing its installation credential.
import { prepareCompanion } from '../src/companion.ts';
const args = process.argv.slice(2);
if (args.length && (args[0] !== '--output' || args.length !== 2)) throw new Error('Usage: node prepare-companion.mjs [--output <directory>]');
console.log(JSON.stringify(await prepareCompanion(new URL('../', import.meta.url), args[1]), null, 2));
