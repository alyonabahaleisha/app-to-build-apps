/**
 * Manual mock for react-native-reanimated.
 *
 * The official react-native-reanimated/mock.js imports real source files that
 * contain Flow type annotations (AnimatedObject.js etc.) which Babel cannot
 * parse in the Jest environment. This inline mock provides no-op stubs for
 * every Reanimated export used by the a2ui-renderer V0 components:
 *   - Animated (View, ScrollView, FlatList, Text, Image)
 *   - useSharedValue, useAnimatedStyle
 *   - withTiming, withRepeat, withSequence, withSpring, withDelay
 *   - FadeIn, FadeOut, LinearTransition
 *   - useReducedMotion (re-export — renderer uses a11y/useReducedMotion.ts instead)
 *   - runOnJS, runOnUI
 *   - Easing
 *   - default export (Animated namespace)
 */
'use strict'

const React = require('react')
// Only require View and Text — ScrollView and FlatList pull in Flow-typed
// AnimatedObject.js via ScrollView.js → AnimatedImplementation.js which
// Babel cannot parse in the Jest environment.
const {View, Text, Image} = require('react-native')

// ---------------------------------------------------------------------------
// Shared value — plain object whose .value property can be read/written.
// ---------------------------------------------------------------------------
function useSharedValue(initial) {
  const ref = React.useRef(initial)
  // Accept animation objects (no-op) or raw values
  const sharedValue = React.useMemo(() => ({
    get value() {
      return ref.current
    },
    set value(v) {
      // If it's an animation descriptor object (has .___type), ignore.
      // Otherwise store the raw value.
      if (v !== null && typeof v === 'object' && v.___isAnimation) return
      ref.current = v
    },
  }), [])
  return sharedValue
}

// ---------------------------------------------------------------------------
// useAnimatedStyle — returns a plain style object (no worklet involvement).
// ---------------------------------------------------------------------------
function useAnimatedStyle(styleFactory) {
  try {
    return styleFactory()
  } catch {
    return {}
  }
}

// ---------------------------------------------------------------------------
// Animation builders — return a tagged sentinel so SharedValue.set can skip them.
// ---------------------------------------------------------------------------
function makeAnimation(type, value) {
  return {___isAnimation: true, ___type: type, value}
}

function withTiming(toValue) {
  return makeAnimation('withTiming', toValue)
}

function withSpring(toValue) {
  return makeAnimation('withSpring', toValue)
}

function withRepeat(animation) {
  return makeAnimation('withRepeat', animation)
}

function withSequence(...animations) {
  return makeAnimation('withSequence', animations)
}

function withDelay(delayMs, animation) {
  return makeAnimation('withDelay', {delayMs, animation})
}

// ---------------------------------------------------------------------------
// Layout animations — no-ops (class-like objects with .duration()).
// ---------------------------------------------------------------------------
function makeLayoutAnimation(name) {
  const obj = {
    ___isLayoutAnimation: true,
    ___name: name,
    duration() { return this },
    delay() { return this },
    easing() { return this },
    springify() { return this },
    damping() { return this },
    stiffness() { return this },
    mass() { return this },
    overshootClamping() { return this },
  }
  return obj
}

const FadeIn = makeLayoutAnimation('FadeIn')
const FadeOut = makeLayoutAnimation('FadeOut')
const FadeInDown = makeLayoutAnimation('FadeInDown')
const FadeOutDown = makeLayoutAnimation('FadeOutDown')
const LinearTransition = makeLayoutAnimation('LinearTransition')
const SlideInRight = makeLayoutAnimation('SlideInRight')
const SlideOutLeft = makeLayoutAnimation('SlideOutLeft')

// ---------------------------------------------------------------------------
// Animated — wraps real RN components (renders them transparently).
// ---------------------------------------------------------------------------
function AnimatedView({entering: _e, exiting: _x, layout: _l, style, ...rest}) {
  return React.createElement(View, {style, ...rest})
}
function AnimatedScrollView({entering: _e, exiting: _x, layout: _l, style, ...rest}) {
  // Use View instead of ScrollView to avoid pulling in Flow-typed AnimatedObject.js
  return React.createElement(View, {style, ...rest})
}
function AnimatedText({entering: _e, exiting: _x, layout: _l, style, ...rest}) {
  return React.createElement(Text, {style, ...rest})
}
function AnimatedImage({entering: _e, exiting: _x, layout: _l, style, ...rest}) {
  return React.createElement(Image, {style, ...rest})
}
function AnimatedFlatList({entering: _e, exiting: _x, layout: _l, style, ...rest}) {
  // Use View instead of FlatList to avoid pulling in Flow-typed AnimatedObject.js
  return React.createElement(View, {style, ...rest})
}

const Animated = {
  View: AnimatedView,
  ScrollView: AnimatedScrollView,
  Text: AnimatedText,
  Image: AnimatedImage,
  FlatList: AnimatedFlatList,
  createAnimatedComponent: (Component) => {
    const WrappedComponent = ({entering: _e, exiting: _x, layout: _l, ...props}) =>
      React.createElement(Component, props)
    WrappedComponent.displayName = `Animated(${Component.displayName || Component.name || 'Component'})`
    return WrappedComponent
  },
}

// ---------------------------------------------------------------------------
// Utility exports
// ---------------------------------------------------------------------------
function runOnJS(fn) { return fn }
function runOnUI(fn) { return fn }
function cancelAnimation() {}
function makeMutable(initial) { return {value: initial} }

const Easing = {
  linear: (t) => t,
  ease: (t) => t,
  quad: (t) => t,
  cubic: (t) => t,
  bezier: () => ({factory: () => (t) => t}),
  in: (easing) => easing,
  out: (easing) => easing,
  inOut: (easing) => easing,
}

// useReducedMotion — always returns false in test env (no AccessibilityInfo mock needed here;
// the renderer's own useReducedMotion hook handles the real logic)
function useReducedMotion() { return false }

// ---------------------------------------------------------------------------
// Default export (the Animated namespace) and named exports
// ---------------------------------------------------------------------------
module.exports = {
  __esModule: true,
  default: Animated,
  Animated,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
  FadeIn,
  FadeOut,
  FadeInDown,
  FadeOutDown,
  LinearTransition,
  SlideInRight,
  SlideOutLeft,
  runOnJS,
  runOnUI,
  cancelAnimation,
  makeMutable,
  Easing,
  useReducedMotion,
}
