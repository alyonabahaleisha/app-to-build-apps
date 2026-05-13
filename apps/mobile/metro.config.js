// Learn more https://docs.expo.dev/guides/monorepos
const {getDefaultConfig} = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
config.resolver.disableHierarchicalLookup = true

// TS ESM compatibility: workspace packages import relative siblings with the
// `.js` extension (the TypeScript ESM convention with `moduleResolution: "Bundler"`),
// but Metro's default resolver doesn't fall through to `.ts`/`.tsx`. Strip the
// `.js` from relative imports inside our workspace and let Metro re-resolve.
// Stub Node built-ins that the renderer's import graph drags in but never
// actually calls at runtime (e.g. node:crypto via @app-creator/protocol's
// canonical.ts → renderHash, which is a server-side API).
const NODE_BUILTIN_STUBS = {
  'node:crypto': path.resolve(projectRoot, '.stubs/node-crypto-stub.js'),
  // react-native-ai-apple is in optionalDependencies (not published to npm).
  // Stub returns isAvailable() === false so AICapabilitiesProvider routes to
  // the "no-foundation-models" fallback (the device-too-old code path).
  'react-native-ai-apple': path.resolve(projectRoot, '.stubs/react-native-ai-apple-stub.js'),
  // expo-document-picker + react-native-svg: native modules registered with
  // the Pod system but not in the currently-installed dev-client binary.
  // Stubs let the renderer's static module graph evaluate cleanly so the
  // (currently active) demo specs can render. Calling these APIs throws or
  // returns a View no-op; safe because SAMPLE_SPEC doesn't exercise them.
  // Remove the stubs once the next dev-client rebuild includes the pods.
  'expo-document-picker': path.resolve(projectRoot, '.stubs/expo-document-picker-stub.js'),
  'react-native-svg': path.resolve(projectRoot, '.stubs/react-native-svg-stub.js'),
  // expo-apple-authentication native view manager isn't registered in the
  // currently-installed dev-client. Stub exports the enums + a no-op view +
  // a rejecting signInAsync so the SignInScreen renders ("Continue without
  // signing in" still works). Removes once the binary is rebuilt.
  'expo-apple-authentication': path.resolve(projectRoot, '.stubs/expo-apple-authentication-stub.js'),
}

const upstreamResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (NODE_BUILTIN_STUBS[moduleName]) {
    return {filePath: NODE_BUILTIN_STUBS[moduleName], type: 'sourceFile'}
  }
  if (
    (moduleName.startsWith('./') || moduleName.startsWith('../')) &&
    moduleName.endsWith('.js')
  ) {
    const stripped = moduleName.slice(0, -3)
    try {
      return context.resolveRequest(context, stripped, platform)
    } catch {
      // fall through to original behavior
    }
  }
  if (upstreamResolveRequest) {
    return upstreamResolveRequest(context, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
