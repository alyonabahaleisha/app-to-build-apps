/**
 * MultiPickerRenderer — multi-select dropdown backed by a Gorhom sheet.
 *
 * Storage: valueBinding: StringBinding — stored as CSV string.
 * Renderer parses on read (split by ',' + filter empty), joins on write.
 * Option values must not contain commas (enforced by schema regex).
 *
 * Visual (trigger, closed): label above; current selection as Chip row inside
 *   the field (each chip dismissable via ×); placeholder when nothing selected.
 * Visual (sheet, open): Gorhom sheet with searchable list + checkbox per option.
 *   "Done" button confirms. Same border/radius as Picker.
 *
 * Accessibility:
 *   - Trigger: accessibilityRole="combobox", selection count + labels in label
 *   - Sheet options: accessibilityRole="checkbox" + accessibilityState.checked
 *   - Search field: accessibilityLabel="Search options"
 *
 * V1 Phase 1 Step 2 — ADR-0009
 * T-0009-040..043, T-0009-059 (snapshot), T-0009-233, T-0009-234, T-0009-067
 */
import React, {useRef, useState, useCallback} from 'react'
import {View, Text, Pressable, TextInput, ScrollView} from 'react-native'
import {BottomSheetModal, BottomSheetModalProvider, BottomSheetView} from '@gorhom/bottom-sheet'
import type {Node} from '@app-creator/protocol'
import {useTheme, useStance} from '../../theme/RendererThemeProvider.js'
import {useBinding} from '../../state/useBinding.js'
import {useRendererStateContext} from '../../state/useRendererState.js'
import {useListItemContext} from '../../state/ListItemContext.js'
import {INPUT_DEFAULTS} from './defaults.js'

type MultiPickerNode = Extract<Node, {type: 'MultiPicker'}>

// ---------------------------------------------------------------------------
// § CSV helpers (T-0009-233, T-0009-234)
// ---------------------------------------------------------------------------

/**
 * parseCSV — parse a CSV string to an array of selected values.
 * Empty string → [] (not ['']). Trailing commas are ignored.
 * T-0009-233: '' → []. T-0009-234: 'a,' → ['a'].
 */
export function parseCSV(csv: string): string[] {
  return csv.split(',').filter(Boolean)
}

/**
 * joinCSV — join selected values to a CSV string for storage.
 */
export function joinCSV(values: string[]): string {
  return values.join(',')
}

// ---------------------------------------------------------------------------
// § Renderer
// ---------------------------------------------------------------------------

export function MultiPickerRenderer({node}: {node: MultiPickerNode}) {
  const theme = useTheme()
  const stance = useStance()
  const defaults = INPUT_DEFAULTS[stance]
  const {dispatch} = useRendererStateContext()
  const listItemCtx = useListItemContext()
  const sheetRef = useRef<BottomSheetModal>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const captionSpec = theme.type.caption
  const bodySpec = theme.type.body
  const microSpec = theme.type.micro

  const boundValue = useBinding<string>(node.valueBinding)
  const rawCSV = typeof boundValue === 'string' ? boundValue : ''
  // Local selection state (mirrors bound value; not persisted until sheet closes).
  const [localSelected, setLocalSelected] = useState<string[]>(() => parseCSV(rawCSV))

  // Sync localSelected from external bound value when sheet is not open.
  const prevBoundRef = useRef(rawCSV)
  if (prevBoundRef.current !== rawCSV && !sheetOpen) {
    prevBoundRef.current = rawCSV
    setLocalSelected(parseCSV(rawCSV))
  }

  // Options filtered by search query.
  const filteredOptions = searchQuery.trim()
    ? node.options.filter(opt =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : node.options

  const selectedLabels = localSelected
    .map(v => node.options.find(o => o.value === v)?.label ?? v)
    .filter(Boolean)

  const handleOpen = useCallback(() => {
    setSearchQuery('')
    setLocalSelected(parseCSV(rawCSV))
    setSheetOpen(true)
    sheetRef.current?.present()
  }, [rawCSV])

  const handleDone = useCallback(() => {
    const csv = joinCSV(localSelected)
    if (node.valueBinding.kind === 'state') {
      dispatch({type: 'set', target: node.valueBinding.slot, value: csv})
    } else if (node.valueBinding.kind === 'collectionField' && listItemCtx !== null) {
      dispatch({
        type: 'updateItem',
        collection: node.valueBinding.collectionId,
        itemId: listItemCtx.rowId,
        patch: {[node.valueBinding.field]: csv},
      })
    }
    sheetRef.current?.dismiss()
    setSheetOpen(false)
  }, [localSelected, node.valueBinding, dispatch, listItemCtx])

  const toggleOption = useCallback((value: string) => {
    setLocalSelected(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value],
    )
  }, [])

  const removeChip = useCallback((value: string) => {
    const next = localSelected.filter(v => v !== value)
    setLocalSelected(next)
    const csv = joinCSV(next)
    if (node.valueBinding.kind === 'state') {
      dispatch({type: 'set', target: node.valueBinding.slot, value: csv})
    }
  }, [localSelected, node.valueBinding, dispatch])

  const handleSheetChange = useCallback((index: number) => {
    if (index === -1) setSheetOpen(false)
  }, [])

  // Accessibility label for the trigger.
  const a11yLabel = localSelected.length > 0
    ? `${node.accessibilityLabel ?? node.label}, ${localSelected.length} selected: ${selectedLabels.join(', ')}`
    : node.accessibilityLabel ?? node.label

  return (
    <BottomSheetModalProvider>
      <View>
        {/* Label */}
        <Text
          style={{
            fontSize: captionSpec.size,
            lineHeight: captionSpec.lineHeight,
            fontWeight: '400',
            letterSpacing: captionSpec.letterSpacing,
            color: theme['fg-muted'],
            marginBottom: theme.spacing['space-xs'],
          }}
          accessibilityElementsHidden
        >
          {node.label}
        </Text>

        {/* Tappable field (trigger) */}
        <Pressable
          onPress={handleOpen}
          style={({pressed}) => ({
            minHeight: defaults.fieldMinHeight,
            backgroundColor: pressed ? theme['bg-overlay'] : theme['bg-elevated'],
            borderRadius: theme.radii['radius-md'],
            borderWidth: sheetOpen ? 2 : 1,
            borderColor: sheetOpen ? theme.accent : theme.divider,
            paddingHorizontal: theme.spacing['space-md'],
            paddingVertical: theme.spacing['space-sm'],
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 4,
          })}
          accessibilityRole="combobox"
          accessibilityLabel={a11yLabel}
          accessibilityState={{expanded: sheetOpen}}
          testID={`multipicker-trigger-${node.id}`}
        >
          {localSelected.length === 0 ? (
            <Text
              style={{
                fontSize: bodySpec.size,
                lineHeight: bodySpec.lineHeight,
                color: theme['fg-faint'],
              }}
            >
              {node.placeholder ?? 'Select options'}
            </Text>
          ) : (
            localSelected.map(value => {
              const label = node.options.find(o => o.value === value)?.label ?? value
              return (
                <View
                  key={value}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: theme.accent + '22',
                    borderRadius: theme.radii['radius-sm'],
                    paddingHorizontal: theme.spacing['space-xs'],
                    paddingVertical: 2,
                  }}
                >
                  <Text
                    style={{fontSize: microSpec.size, color: theme.accent}}
                    testID={`multipicker-chip-label-${value}`}
                  >
                    {label}
                  </Text>
                  <Pressable
                    onPress={() => removeChip(value)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${label}`}
                    testID={`multipicker-chip-remove-${value}`}
                  >
                    <Text style={{fontSize: 12, color: theme.accent, marginLeft: 4}}>×</Text>
                  </Pressable>
                </View>
              )
            })
          )}
        </Pressable>
      </View>

      {/* Gorhom Bottom Sheet with option list */}
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['50%', '85%']}
        onChange={handleSheetChange}
        enablePanDownToClose
      >
        <BottomSheetView style={{flex: 1}}>
          {/* Search field */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: theme.divider,
            }}
          >
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search options"
              placeholderTextColor={theme['fg-faint']}
              style={{
                fontSize: bodySpec.size,
                color: theme.fg,
                height: 36,
                backgroundColor: theme['bg-elevated'],
                borderRadius: theme.radii['radius-sm'],
                paddingHorizontal: 12,
              }}
              accessibilityLabel="Search options"
              testID={`multipicker-search-${node.id}`}
            />
          </View>

          {/* Options list */}
          <ScrollView style={{flex: 1}}>
            {filteredOptions.map(opt => {
              const isSelected = localSelected.includes(opt.value)
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => toggleOption(opt.value)}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  accessibilityRole="checkbox"
                  accessibilityLabel={opt.label}
                  accessibilityState={{checked: isSelected}}
                  testID={`multipicker-option-${opt.value}`}
                >
                  <Text
                    style={{
                      fontSize: bodySpec.size,
                      lineHeight: bodySpec.lineHeight,
                      color: isSelected ? theme.accent : theme.fg,
                      fontWeight: isSelected ? '600' : '400',
                      flex: 1,
                    }}
                  >
                    {opt.label}
                  </Text>
                  {isSelected && (
                    <Text style={{color: theme.accent, fontSize: 16}}>{'✓'}</Text>
                  )}
                </Pressable>
              )
            })}
          </ScrollView>

          {/* Done button */}
          <View
            style={{
              padding: 16,
              borderTopWidth: 1,
              borderTopColor: theme.divider,
            }}
          >
            <Pressable
              onPress={handleDone}
              style={{
                backgroundColor: theme.accent,
                borderRadius: theme.radii['radius-md'],
                paddingVertical: 12,
                alignItems: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel="Done"
              testID={`multipicker-done-${node.id}`}
            >
              <Text
                style={{
                  fontSize: bodySpec.size,
                  fontWeight: '600',
                  color: theme['accent-fg'],
                }}
              >
                Done
              </Text>
            </Pressable>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    </BottomSheetModalProvider>
  )
}
