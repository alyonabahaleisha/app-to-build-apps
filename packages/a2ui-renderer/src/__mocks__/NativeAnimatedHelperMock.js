/**
 * NativeAnimatedHelperMock.js
 *
 * Mock for react-native/src/private/animated/NativeAnimatedHelper.
 *
 * NativeAnimatedHelper.js in RN 0.76 uses the Flow utility type
 * `$NonMaybeType<typeof ...>['key']` (a cast expression) that
 * @babel/preset-flow at the current version cannot parse. This file is
 * imported by RTL's detectHostComponentNames() path which renders
 * TextInput/Text to identify host component element types.
 *
 * The renderer's tests never exercise native animation, so a minimal
 * stub is all that's needed to unblock the RTL render() call path.
 *
 * Referenced from jest.config.js moduleNameMapper.
 */

module.exports = {
  API: {
    getValue: () => {},
    setWaitingForIdentifier: () => {},
    unsetWaitingForIdentifier: () => {},
    disableQueue: () => {},
    queueAndExecuteBatchedOperations: () => {},
    createAnimatedNode: () => {},
    startListeningToAnimatedNodeValue: () => {},
    stopListeningToAnimatedNodeValue: () => {},
    connectAnimatedNodes: () => {},
    disconnectAnimatedNodes: () => {},
    startAnimatingNode: () => {},
    stopAnimation: () => {},
    setAnimatedNodeValue: () => {},
    setAnimatedNodeOffset: () => {},
    flattenAnimatedNodeOffset: () => {},
    extractAnimatedNodeOffset: () => {},
    connectAnimatedNodeToView: () => {},
    disconnectAnimatedNodeFromView: () => {},
    restoreDefaultValues: () => {},
    dropAnimatedNode: () => {},
    addAnimatedEventToView: () => {},
    removeAnimatedEventFromView: () => {},
    addListener: () => ({remove: () => {}}),
    removeAllListeners: () => {},
  },
  shouldUseNativeDriver: () => false,
  validateStyles: () => {},
  validateTransform: () => {},
  validateInterpolation: () => {},
  generateNewNodeTag: () => 0,
  generateNewAnimationId: () => 0,
  assertNativeAnimatedModule: () => {},
  transformDataType: value => value,
}
