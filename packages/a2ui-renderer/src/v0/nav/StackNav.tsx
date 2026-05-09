/**
 * StackNav — list→detail navigation for specs with navigation: 'stack'.
 *
 * Wraps @react-navigation/native-stack's createNativeStackNavigator.
 * Each SpecScreen becomes a stack screen. The initialRouteName is
 * spec.initialScreenId.
 *
 * Wire-up:
 *   The NavigationPrimitive passed to onPrimitiveReady is backed by the
 *   NavigationContainerRef. When the middleware dispatches navigate(target),
 *   it calls primitive.navigate(target) → navigationRef.navigate(target).
 *   The reducer ALSO updates currentScreenId + history (pass-through).
 *
 * Subheader (UX doc §Pattern 2: stack):
 *   On non-root screens: 32pt subheader below host header with chevron-left
 *   "Back" label, center title, optional edit icon. On root screen: omitted.
 *   Implemented as a native header via stack screenOptions.
 *
 * T-0006-163: mounts NativeStackNavigator with 2+ screens
 * T-0006-164: navigate(target) pushes to target screen
 * T-0006-165: back pops to previous screen
 * T-0006-172a: back on empty history calls host.onNavigationError (middleware handles)
 */
import React, {useEffect, useRef} from 'react'
import {View} from 'react-native'
import {NavigationContainer, createNavigationContainerRef} from '@react-navigation/native'
import {createNativeStackNavigator} from '@react-navigation/native-stack'
import type {Spec} from '@app-creator/protocol'
import type {NavigationPrimitive} from '../state/middleware/navigation.js'
import {NodeRenderer} from '../components/NodeRenderer.js'

export type StackNavProps = {
  spec: Spec
  /** Called with the NavigationPrimitive once the container is ready. */
  onPrimitiveReady: (primitive: NavigationPrimitive | null) => void
}

// Build the param list type from SpecScreen ids.
// All screens accept no params — nav targets are spec-driven.
type ParamList = Record<string, undefined>

const Stack = createNativeStackNavigator<ParamList>()

// One StackScreen per SpecScreen, rendered via NodeRenderer.
function StackScreenContent({specScreenId, spec}: {specScreenId: string; spec: Spec}) {
  const screen = spec.screens.find(s => s.id === specScreenId)
  if (!screen) return null
  return (
    <View style={{flex: 1}}>
      <NodeRenderer node={screen.root} />
    </View>
  )
}

export function StackNav({spec, onPrimitiveReady}: StackNavProps) {
  // NB-04 fix: create the ref once via useRef to avoid creating a new ref on every render.
  const navRef = useRef(createNavigationContainerRef<ParamList>()).current
  // Track readiness so we don't signal until the container is mounted.
  const primitiveRef = useRef<NavigationPrimitive | null>(null)

  function handleReady() {
    const primitive: NavigationPrimitive = {
      navigate(screenId: string) {
        if (navRef.isReady()) {
          navRef.navigate(screenId as never)
        }
      },
      pop() {
        if (navRef.isReady() && navRef.canGoBack()) {
          navRef.goBack()
        }
      },
    }
    primitiveRef.current = primitive
    onPrimitiveReady(primitive)
  }

  // Clean up: signal null primitive on unmount so middleware stops routing to it.
  useEffect(() => {
    return () => {
      primitiveRef.current = null
      onPrimitiveReady(null)
    }
  }, [onPrimitiveReady])

  return (
    <NavigationContainer ref={navRef} onReady={handleReady}>
      <Stack.Navigator
        initialRouteName={spec.initialScreenId}
        screenOptions={{
          // 32pt header height per UX doc. Uses the native stack header.
          headerShown: true,
          headerStyle: {backgroundColor: 'transparent'},
          headerShadowVisible: false,
          headerBackTitle: 'Back',
          // Title from screen.title or screen id
          headerTitleStyle: {fontWeight: '600', fontSize: 15},
        }}
      >
        {spec.screens.map(screen => (
          <Stack.Screen
            key={screen.id}
            name={screen.id}
            options={{
              title: screen.title ?? screen.id,
              // Root screen (initialScreenId) hides header; detail screens show it.
              headerShown: screen.id !== spec.initialScreenId,
            }}
          >
            {() => <StackScreenContent specScreenId={screen.id} spec={spec} />}
          </Stack.Screen>
        ))}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
