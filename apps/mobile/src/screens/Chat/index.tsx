/**
 * Chat screen — ADR-0002 Step 8 full implementation.
 *
 * State machine (mutually exclusive):
 *   empty       → No messages, no remixParams → WelcomeCard + disabled Send
 *   remix-entry → remixParams present → RemixChip + pre-filled input + Send enabled
 *   typing      → User has typed ≥1 char → WelcomeCard hidden, Send enabled
 *   submitting  → generate() called → user ChatBubble + LoadingBubble + input disabled
 *   building    → SSE building_started → LoadingBubble copy changes
 *   stalled     → 30s silence → LoadingBubble copy "Still working…"
 *   done        → SSE done → navigate to AppRunner, pop Chat
 *   error       → SSE error → error ChatBubble, Send re-enabled, input preserved
 *   conn_lost   → error code=connection_lost → toast + popToTop
 *
 * Back arrow during generation: iOS Alert confirmation (T-0002-147).
 * The AbortController cancels the fetch — server continues and saves
 * to My apps. User finds it on next refresh.
 *
 * Navigation carries:
 *   - parentProjectId → included in /generate body until chip is dismissed.
 *   - prefilledPrompt → populates input on mount.
 *   - parentAuthorHandle → shown in RemixChip.
 */
import {useCallback, useEffect, useRef, useState} from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import {BackButton} from '#/components/BackButton'
import {SafeContainer} from '#/components/SafeContainer'
import {useToast} from '#/components/ToastProvider'
import {useGenerateMutation, isActivePhase} from '#/state/queries/generate'
import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

import type {NativeStackScreenProps} from '@react-navigation/native-stack'
import type {RootStackParamList} from '#/lib/routes/types'

import {chatCopy} from './copy'
import {ChatBubble} from './components/ChatBubble'
import {LoadingBubble} from './components/LoadingBubble'
import {PromptInputBar} from './components/PromptInputBar'
import {RemixChip} from './components/RemixChip'
import {WelcomeCard} from './components/WelcomeCard'

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>

interface Message {
  id: string
  role: 'user' | 'assistant' | 'error'
  text: string
}

export function ChatScreen({route, navigation}: Props) {
  const theme = useAppShellTheme()
  const toast = useToast()
  const {phase, result, error, generate, reset} = useGenerateMutation()

  // Remix params from route (optional).
  const remixParams = route.params

  const [prompt, setPrompt] = useState(remixParams?.prefilledPrompt ?? '')
  const [messages, setMessages] = useState<Message[]>([])
  // When remixParams are present and chip hasn't been dismissed.
  const [remixActive, setRemixActive] = useState(!!remixParams)
  const [parentProjectId, setParentProjectId] = useState<string | undefined>(
    remixParams?.parentProjectId,
  )
  const [authorHandle, setAuthorHandle] = useState<string | undefined>(
    remixParams?.parentAuthorHandle,
  )

  const scrollRef = useRef<ScrollView>(null)
  const messageIdRef = useRef(0)

  const nextId = () => {
    messageIdRef.current += 1
    return String(messageIdRef.current)
  }

  const isGenerating = phase === 'thinking' || phase === 'building' || phase === 'stalled'
  const showWelcome = messages.length === 0 && !isGenerating

  // --- Done: navigate to AppRunner -------------------------------------------

  useEffect(() => {
    if (phase === 'done' && result) {
      navigation.replace('AppRunner', {projectId: result.miniApp.id})
    }
  }, [phase, result, navigation])

  // --- Connection lost: toast + pop to top -----------------------------------

  useEffect(() => {
    if (phase === 'error' && error?.code === 'connection_lost') {
      toast.show(chatCopy.connectionLostToast, {variant: 'error', durationMs: 4000})
      navigation.popToTop()
    }
  }, [phase, error, toast, navigation])

  // --- Error: add error bubble to thread ------------------------------------

  useEffect(() => {
    if (phase === 'error' && error && error.code !== 'connection_lost') {
      const copy = chatCopy.errorCodes[error.code] ?? chatCopy.errorCodes['internal']!
      setMessages(prev => [...prev, {id: nextId(), role: 'error', text: copy}])
    }
    // Intentionally only runs when phase flips to 'error'; error.code is stable
    // within a single error phase so omitting it from deps is safe.
  }, [phase, error?.code])

  // --- Scroll to bottom on new messages -------------------------------------

  useEffect(() => {
    if (messages.length > 0 || isGenerating) {
      setTimeout(() => scrollRef.current?.scrollToEnd({animated: true}), 50)
    }
  }, [messages.length, isGenerating])

  // --- Handlers --------------------------------------------------------------

  const handleSend = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return

    const sentPrompt = prompt.trim()
    const capturedParentId = remixActive ? parentProjectId : undefined

    // Add user bubble immediately.
    setMessages(prev => [...prev, {id: nextId(), role: 'user', text: sentPrompt}])
    setPrompt('')

    // Dismiss remix chip on send.
    if (remixActive) {
      setRemixActive(false)
    }

    try {
      await generate({prompt: sentPrompt, parentProjectId: capturedParentId})
    } catch {
      // In-flight guard or other sync throw — surface as error bubble.
      const errMsg = chatCopy.errorCodes['internal']!
      setMessages(prev => [...prev, {id: nextId(), role: 'error', text: errMsg}])
    }
  }, [prompt, isGenerating, remixActive, parentProjectId, generate])

  const handleSelectExample = useCallback((examplePrompt: string) => {
    setPrompt(examplePrompt)
  }, [])

  const handleClearRemix = useCallback(() => {
    setRemixActive(false)
    setParentProjectId(undefined)
    setAuthorHandle(undefined)
  }, [])

  // --- Back arrow: confirmation during generation (T-0002-147) -------------

  const handleBack = useCallback(() => {
    if (isGenerating) {
      Alert.alert(chatCopy.cancelAlertTitle, chatCopy.cancelAlertBody, [
        {text: chatCopy.cancelAlertStay, style: 'cancel'},
        {
          text: chatCopy.cancelAlertConfirm,
          style: 'destructive',
          onPress: () => {
            // Abort the fetch — server continues and project will save.
            reset()
            navigation.goBack()
          },
        },
      ])
      return
    }
    navigation.goBack()
  }, [isGenerating, reset, navigation])

  // --- Render ----------------------------------------------------------------

  return (
    <SafeContainer>
      {/* Top bar */}
      <View style={styles.topBar}>
        <BackButton
          onPress={handleBack}
          accessibilityLabel={chatCopy.backButtonLabel}
          testID="chat-back-button"
        />
        <Text
          style={[
            {
              fontSize: theme.type.h2.size,
              fontWeight: String(theme.type.h2.weight) as '600',
              lineHeight: theme.type.h2.lineHeight,
              color: theme.fg,
            },
          ]}
          accessibilityRole="header"
        >
          {chatCopy.topBarTitle}
        </Text>
        {/* Spacer to center the title */}
        <View style={{width: 44}} />
      </View>

      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Message thread / empty state */}
        {showWelcome ? (
          <WelcomeCard onSelectExample={handleSelectExample} />
        ) : (
          <ScrollView
            ref={scrollRef}
            style={{flex: 1}}
            contentContainerStyle={styles.thread}
            keyboardDismissMode="interactive"
            testID="chat-thread"
          >
            {messages.map(msg => (
              <ChatBubble
                key={msg.id}
                variant={
                  msg.role === 'user' ? 'user' : msg.role === 'error' ? 'error' : 'assistant'
                }
                text={msg.text}
                testID={`chat-bubble-${msg.role}`}
              />
            ))}
            {isActivePhase(phase) ? <LoadingBubble phase={phase} /> : null}
          </ScrollView>
        )}

        {/* Remix chip — sticky above input, shown when remix active */}
        {remixActive && authorHandle ? (
          <RemixChip authorHandle={authorHandle} onClear={handleClearRemix} />
        ) : null}

        {/* Prompt input bar */}
        <PromptInputBar
          value={prompt}
          onChangeText={setPrompt}
          onSend={handleSend}
          isLoading={isGenerating}
          testID="prompt-input-bar"
        />
      </KeyboardAvoidingView>
    </SafeContainer>
  )
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  thread: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
})
