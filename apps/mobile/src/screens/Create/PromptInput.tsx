/**
 * PromptInput — multi-line text input for the Create screen.
 *
 * Layout: input box with mic icon on the right. Character counter below
 * at 1800+ chars, turning danger color at 1900+.
 *
 * T-0011-191: mic icon visible in default state
 * T-0011-192: ≥1 non-whitespace char enables FAB
 * T-0011-193: 2000 chars → counter danger color, FAB enabled
 * T-0011-194: 2001 chars → FAB disabled (enforced by parent via maxLength)
 * T-0011-195: whitespace-only → FAB disabled
 * T-0011-197: tap mic → VoiceMicWaitlistSheet (handled by parent via prop)
 * T-0011-199: counter at 1900 announces "Approaching length limit" via live-region
 */
import {useEffect, useRef} from 'react'
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

import {
  COUNTER_DANGER_AT,
  COUNTER_VISIBLE_AT,
  createCopy,
  MAX_PROMPT_LENGTH,
} from './copy'

interface Props {
  value: string
  onChangeText: (text: string) => void
  onMicPress: () => void
  editable?: boolean
  testID?: string
}

export function PromptInput({value, onChangeText, onMicPress, editable = true, testID}: Props) {
  const theme = useAppShellTheme()
  const charCount = value.length
  const showCounter = charCount >= COUNTER_VISIBLE_AT
  const isDanger = charCount >= COUNTER_DANGER_AT
  const counterColor = isDanger ? theme.danger : theme['fg-faint']

  // Live-region announcement at 1900 and 2000 (T-0011-199).
  // Announce once per threshold crossing — track the last announced threshold.
  const lastAnnouncedThresholdRef = useRef<number | null>(null)

  useEffect(() => {
    if (charCount >= MAX_PROMPT_LENGTH && lastAnnouncedThresholdRef.current !== MAX_PROMPT_LENGTH) {
      lastAnnouncedThresholdRef.current = MAX_PROMPT_LENGTH
      AccessibilityInfo.announceForAccessibility(createCopy.counterApproachingLimit)
    } else if (
      charCount >= COUNTER_DANGER_AT &&
      charCount < MAX_PROMPT_LENGTH &&
      lastAnnouncedThresholdRef.current !== COUNTER_DANGER_AT
    ) {
      lastAnnouncedThresholdRef.current = COUNTER_DANGER_AT
      AccessibilityInfo.announceForAccessibility(createCopy.counterApproachingLimit)
    } else if (charCount < COUNTER_DANGER_AT) {
      lastAnnouncedThresholdRef.current = null
    }
  }, [charCount])

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: theme['bg-elevated'],
            borderColor: theme.divider,
            borderRadius: theme.radii['radius-md'],
          },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel={createCopy.inputA11yLabel}
          placeholder={createCopy.inputPlaceholder}
          placeholderTextColor={theme['fg-muted']}
          multiline
          maxLength={MAX_PROMPT_LENGTH + 1} // allow 2001 for disabled-FAB test; parent guards
          editable={editable}
          style={[
            styles.input,
            {
              fontSize: theme.type.body.size,
              fontWeight: String(theme.type.body.weight) as '400',
              lineHeight: theme.type.body.lineHeight,
              color: theme.fg,
            },
          ]}
          testID={testID ?? 'prompt-input'}
          // 5-line max visible; internally scrollable.
          numberOfLines={5}
          scrollEnabled
        />

        {/* Mic icon — V0 placeholder */}
        <Pressable
          onPress={onMicPress}
          accessibilityRole="button"
          accessibilityLabel={createCopy.micA11yLabel}
          accessibilityHint={createCopy.micA11yHint}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          style={styles.micButton}
          testID="prompt-mic-button"
        >
          {/* Mic icon placeholder — Feather 'mic' */}
          <View
            style={[
              styles.micIcon,
              {borderColor: theme['fg-muted']},
            ]}
            testID="icon-mic"
          >
            <Text
              style={{fontSize: 16, color: theme['fg-muted']}}
              accessibilityElementsHidden
            >
              🎤
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Character counter */}
      {showCounter ? (
        <Text
          style={[
            styles.counter,
            {
              fontSize: theme.type.micro.size,
              fontWeight: String(theme.type.micro.weight) as '500',
              lineHeight: theme.type.micro.lineHeight,
              color: counterColor,
            },
          ]}
          accessibilityLiveRegion="polite"
          testID="char-counter"
        >
          {charCount}/{MAX_PROMPT_LENGTH}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    gap: 4,
  },
  inputWrap: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 100,
    maxHeight: 5 * 24, // 5-line max
    textAlignVertical: 'top',
    padding: 0,
  },
  micButton: {
    marginTop: 4,
  },
  micIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counter: {
    textAlign: 'right',
  },
})
