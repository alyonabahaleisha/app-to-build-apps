// Empty stub for node:crypto in the React Native bundle.
//
// `@app-creator/protocol` exports `canonicalize` and `renderHash` (the latter
// uses node:crypto), and Metro pulls the whole module graph through the export
// chain even though the renderer never calls `renderHash()` at runtime.
// Stubbing keeps the bundle building. If something at runtime ever calls into
// these APIs, it will throw — which is what we want, because that would be a
// bug in the renderer (hashing is a server-side concern).
function notImplemented(name) {
  return function () {
    throw new Error(
      `[node:crypto stub] ${name} is not available in the React Native bundle. ` +
        'This API is server-side only.',
    )
  }
}

module.exports = {
  createHash: notImplemented('createHash'),
  randomBytes: notImplemented('randomBytes'),
  createHmac: notImplemented('createHmac'),
}
