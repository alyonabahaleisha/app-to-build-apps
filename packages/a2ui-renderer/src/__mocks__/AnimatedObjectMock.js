/**
 * AnimatedObjectMock.js
 *
 * Mock for react-native/Libraries/Animated/nodes/AnimatedObject.
 *
 * AnimatedObject.js in RN 0.76 uses Flow's `value is T` return-type
 * predicate syntax (e.g. `value is $ReadOnly<{...}>`) that
 * @babel/preset-flow at the current version cannot parse. The module is
 * transitively imported by ScrollView → AnimatedProps → AnimatedObject.
 *
 * The renderer tests never exercise Animated object internals directly,
 * so a minimal stub is sufficient to unblock the ScrollView render path.
 *
 * Referenced from jest.config.js moduleNameMapper.
 */
'use strict'

function isPlainObject(_value) {
  return false
}

class AnimatedObject {
  constructor(value) {
    this._value = value
  }
  getValue() {
    return this._value
  }
  __attach() {}
  __detach() {}
  __makeNative() {}
  __getNativeConfig() {
    return {type: 'object', value: {}}
  }
}

AnimatedObject.isPlainObject = isPlainObject

module.exports = AnimatedObject
