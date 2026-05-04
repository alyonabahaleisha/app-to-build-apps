/**
 * EventEmitterMock.js
 *
 * Mock for react-native/Libraries/vendor/emitter/EventEmitter.
 *
 * The real EventEmitter.js uses Flow mapped-type syntax (`[K in keyof T]`)
 * that @babel/preset-flow at the current version cannot parse. Since the
 * renderer package's tests never exercise native event emission, this mock
 * provides the minimal surface that react-native's Image component resolution
 * requires so the Jest transform chain does not fail.
 *
 * Referenced from jest.config.js moduleNameMapper.
 */
class EventEmitter {
  addListener() {}
  removeListener() {}
  emit() {}
  removeAllListeners() {}
}

module.exports = EventEmitter
