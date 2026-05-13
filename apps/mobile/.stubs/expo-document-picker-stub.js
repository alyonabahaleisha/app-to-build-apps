// Stub for expo-document-picker until the native binary is rebuilt.
//
// The renderer's compound/DocumentPicker.tsx imports `expo-document-picker`
// statically. The native binary on the simulator was built before
// expo-document-picker was added to apps/mobile/package.json, so the native
// module isn't registered and `import * as ExpoDocumentPicker from 'expo-document-picker'`
// throws at module-init time.
//
// This stub mirrors the shape of expo-document-picker so the import succeeds.
// Calling getDocumentAsync at runtime rejects with a clear "not available"
// error — but the renderer's static module graph evaluates cleanly. SAMPLE_SPEC
// doesn't use DocumentPicker, so this stub is never actually called.
async function getDocumentAsync() {
  throw new Error(
    '[expo-document-picker stub] Not available in this build. Rebuild the dev-client.',
  )
}

module.exports = {
  getDocumentAsync,
  // The package also exports a `DocumentPickerResult` type and constants;
  // they're TypeScript-only so they don't need runtime entries.
}
