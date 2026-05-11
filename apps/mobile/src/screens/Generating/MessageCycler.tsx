/**
 * MessageCycler — cycles through 3 progress messages while generating.
 *
 * Messages change every 3 seconds (infinite loop until done).
 * accessibilityLiveRegion="polite" so VoiceOver announces each change.
 *
 * T-0011-233: cycled message has accessibilityLiveRegion="polite"
 */
import {useEffect, useState} from 'react'
import {StyleSheet, Text} from 'react-native'

import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

import {generatingCopy} from './generatingCopy'

const CYCLE_INTERVAL_MS = 3000

interface Props {
  /** When true, stop cycling and keep the last message. */
  frozen?: boolean
}

export function MessageCycler({frozen = false}: Props) {
  const theme = useAppShellTheme()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (frozen) return
    const id = setInterval(() => {
      setIndex(prev => (prev + 1) % generatingCopy.messages.length)
    }, CYCLE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [frozen])

  const message = generatingCopy.messages[index] ?? generatingCopy.messages[0]!

  return (
    <Text
      style={[
        styles.text,
        {
          fontSize: theme.type.body.size,
          fontWeight: String(theme.type.body.weight) as '400',
          lineHeight: theme.type.body.lineHeight,
          color: theme['fg-muted'],
        },
      ]}
      accessibilityLiveRegion="polite"
      testID="message-cycler"
    >
      {message}
    </Text>
  )
}

const styles = StyleSheet.create({
  text: {
    textAlign: 'center',
    marginTop: 12,
  },
})
