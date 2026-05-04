/**
 * Babel config for the a2ui-renderer package (used by Jest only).
 *
 * Handles:
 * - @babel/preset-flow: strips Flow type annotations in react-native source
 *   files (e.g. @react-native/js-polyfills/error-guard.js) so Jest can parse them.
 * - @babel/preset-react: handles JSX in .tsx source files when babel-jest
 *   is used for coverage collection (collectCoverageFrom passes source files
 *   through babel-jest for instrumentation, not ts-jest).
 * - @babel/preset-env: transpiles modern syntax for the jest Node environment.
 * - @babel/preset-typescript: strips TypeScript types when babel-jest handles
 *   a .tsx source file (coverage instrumentation path).
 */
module.exports = {
  presets: [
    ['@babel/preset-env', {targets: {node: 'current'}}],
    ['@babel/preset-react', {runtime: 'classic'}],
    '@babel/preset-typescript',
    '@babel/preset-flow',
  ],
}
