/**
 * LibraryCard — single library row per Sable's §Screen 2.
 *
 * Title (bold, 1 line, ellipsize) + subtitle ("Created {time-ago}") +
 * trailing chevron. Whole row is the hit target.
 *
 * Defense-in-depth (T-0001-111): even though the server derives titles
 * server-side (§Step 4) and falls back to "Untitled", we re-apply the
 * fallback here in case a malformed row sneaks through — a "" title on the
 * client would otherwise render as a blank line with just the subtitle.
 */
import {Feather} from '@expo/vector-icons'
import {StyleSheet, Text, View} from 'react-native'

import {Card} from '#/components/Card'
import {timeAgo} from '#/lib/timeAgo'
import {useTheme} from '#/theme'

import {homeCopy} from '../copy'

interface Props {
  projectId: string
  title: string
  /** ISO timestamp from the server. */
  createdAt: string
  onPress: (projectId: string) => void
  /** Optional now-override for deterministic tests. */
  now?: Date
}

export function LibraryCard({projectId, title, createdAt, onPress, now}: Props) {
  const theme = useTheme()
  const safeTitle = title.trim() === '' ? homeCopy.cardUntitled : title
  const subtitle = `${homeCopy.cardCreatedPrefix}${timeAgo(createdAt, now)}`
  const a11yLabel = `Open ${safeTitle}, ${subtitle.toLowerCase()}`

  return (
    <Card
      onPress={() => onPress(projectId)}
      accessibilityLabel={a11yLabel}
      accessibilityRole="button"
      testID="library-card"
    >
      <View style={styles.row}>
        <View style={styles.text}>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[
              theme.typography.heading3,
              {color: theme.palette.text.primary},
            ]}
          >
            {safeTitle}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.subtitle,
              theme.typography.caption,
              {color: theme.palette.text.muted},
            ]}
          >
            {subtitle}
          </Text>
        </View>
        <Feather
          name="chevron-right"
          size={20}
          color={theme.palette.text.muted}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', gap: 12},
  text: {flex: 1, gap: 4},
  subtitle: {marginTop: 2},
})
