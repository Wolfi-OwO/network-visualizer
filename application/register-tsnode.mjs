// Registers the ts-node ESM loader via the stable `register()` API
// (replaces the deprecated `--experimental-loader` / `--loader` flag).
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('ts-node/esm', pathToFileURL('./'));