import {Text, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import type {NativeStackScreenProps} from '@react-navigation/native-stack'
import type {RootStackParamList} from '#/lib/routes/types'

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>

export function HomeScreen(_: Props) {
  const insets = useSafeAreaInsets()
  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top,
        paddingHorizontal: 24,
        justifyContent: 'center',
      }}
    >
      <Text style={{fontSize: 24, fontWeight: '600'}}>App Creator</Text>
      <Text style={{marginTop: 8, color: '#666'}}>
        Skeleton screen. Chat and library land in M1 vertical-slice tickets.
      </Text>
    </View>
  )
}
