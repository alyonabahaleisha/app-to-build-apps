/**
 * Server-side re-export of the shared canonicalization utilities.
 *
 * Per ADR-0001 §Step 4 (Cal): the API consumes the same canonicalize +
 * renderHash impl as the renderer/client to guarantee that two specs with
 * identical bytes produce identical hashes on both ends. We re-export here
 * rather than importing the package path inline at every call site so the
 * import surface stays inside `services/api/src/`.
 *
 * Imported via the package main rather than the `./canonical` subpath export
 * because the api tsconfig uses CommonJS / Node module resolution, which
 * doesn't honour the package.json `exports` map. The package re-exports
 * canonicalize/renderHash from its main `index.ts` for this reason.
 *
 * If the canonicalization rules change, only this file (and the underlying
 * package) change — call sites stay put.
 */
export {canonicalize, renderHash} from '@app-creator/a2ui-schema'
