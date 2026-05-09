/**
 * PickerRenderer — single-select field backed by a Gorhom Bottom Sheet option list.
 *
 * Binding: valueBinding: StringBinding resolved via useBinding<string>.
 *   literal      → static display (read-only)
 *   state        → reads slot; selection dispatches set(target, selectedValue)
 *   collectionField → reads row field; writes back via updateItem
 *
 * Options: up to 12 (enforced by PickerSchema max(12), T-0006-105).
 *
 * Step 10 closure (Step 6 deferral, Roz Deviation 2):
 *   Full Gorhom BottomSheetModal integration replaces the Step 6 stub.
 *   Tapping the field presents a BottomSheetModal with a Pressable option list.
 *   Selecting an option dispatches set / updateItem and closes the sheet.
 *
 * Surface: tappable Pressable, label caption above, selected label in type-body,
 *   chevron-right at right, bg-elevated bg, radius-md, divider border.
 *
 * Accessibility:
 *   - accessibilityRole="combobox" on trigger
 *   - accessibilityLabel: node.accessibilityLabel ?? node.label
 *   - accessibilityState: {expanded: sheetOpen}
 *   - accessibilityRole="menuitem" on each option
 *
 * T-0006-093 / T-0006-094: snapshots at productive×focus + expressive×health
 * T-0006-100: selection dispatches set (Step 10 closure: via sheet option press)
 * T-0006-102: 3 binding kinds render without error
 * T-0006-105: options min(1)/max(12) enforced at schema parse
 */
import React, {useRef, useState, useCallback} from 'react'
import {View, Text, Pressable} from 'react-native'
import {BottomSheetModal, BottomSheetModalProvider, BottomSheetView} from '@gorhom/bottom-sheet'
import type {Node} from '@app-creator/protocol'
import {useTheme, useStance} from '../../theme/RendererThemeProvider.js'
import {useBinding} from '../../state/useBinding.js'
import {useRendererStateContext} from '../../state/useRendererState.js'
import {useListItemContext} from '../../state/ListItemContext.js'
import {INPUT_DEFAULTS} from './defaults.js'

type PickerNode = Extract<Node, {type: 'Picker'}>

export function PickerRenderer({node}: {node: PickerNode}) {
  const theme = useTheme()
  const stance = useStance()
  const defaults = INPUT_DEFAULTS[stance]
  const {dispatch} = useRendererStateContext()
  const listItemCtx = useListItemContext()
  const sheetRef = useRef<BottomSheetModal>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const boundValue = useBinding<string>(node.valueBinding)

  // Find the label for the currently selected value.
  const selectedOption = node.options.find(opt => opt.value === boundValue)
  const displayLabel = selectedOption?.label ?? node.options[0]?.label ?? '—'

  const captionSpec = theme.type.caption
  const bodySpec = theme.type.body

  const handleSelect = useCallback((selectedValue: string) => {
    if (node.valueBinding.kind === 'state') {
      dispatch({type: 'set', target: node.valueBinding.slot, value: selectedValue})
    } else if (node.valueBinding.kind === 'collectionField' && listItemCtx !== null) {
      dispatch({
        type: 'updateItem',
        collection: node.valueBinding.collectionId,
        itemId: listItemCtx.rowId,
        patch: {[node.valueBinding.field]: selectedValue},
      })
    }
    sheetRef.current?.dismiss()
    setSheetOpen(false)
  }, [dispatch, node.valueBinding, listItemCtx])

  function handlePress() {
    setSheetOpen(true)
    sheetRef.current?.present()
  }

  function handleSheetChange(index: number) {
    if (index === -1) {
      setSheetOpen(false)
    }
  }

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

        {/* Tappable field */}
        <Pressable
          onPress={handlePress}
          style={({pressed}) => ({
            minHeight: defaults.fieldMinHeight,
            backgroundColor: pressed ? theme['bg-overlay'] : theme['bg-elevated'],
            borderRadius: theme.radii['radius-md'],
            borderWidth: 1,
            borderColor: theme.divider,
            paddingHorizontal: theme.spacing['space-md'],
            paddingVertical: theme.spacing['space-sm'],
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          })}
          accessibilityRole="combobox"
          accessibilityLabel={node.accessibilityLabel ?? node.label}
          accessibilityState={{expanded: sheetOpen}}
          testID={`picker-trigger-${node.id}`}
        >
          <Text
            style={{
              fontSize: bodySpec.size,
              lineHeight: bodySpec.lineHeight,
              color: selectedOption ? theme.fg : theme['fg-faint'],
            }}
          >
            {displayLabel}
          </Text>
          <Text style={{color: theme['fg-faint'], fontSize: 14}}>{'›'}</Text>
        </Pressable>
      </View>

      {/* Gorhom Bottom Sheet with option list */}
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['45%']}
        onChange={handleSheetChange}
        enablePanDownToClose
      >
        <BottomSheetView style={{flex: 1, paddingVertical: 8}}>
          {node.options.map(opt => {
            const isSelected = opt.value === boundValue
            return (
              <Pressable
                key={opt.value}
                onPress={() => handleSelect(opt.value)}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
                accessibilityRole="menuitem"
                accessibilityLabel={opt.label}
                accessibilityState={{selected: isSelected}}
                testID={`picker-option-${opt.value}`}
              >
                <Text
                  style={{
                    fontSize: bodySpec.size,
                    lineHeight: bodySpec.lineHeight,
                    color: isSelected ? theme.accent : theme.fg,
                    fontWeight: isSelected ? '600' : '400',
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
        </BottomSheetView>
      </BottomSheetModal>
    </BottomSheetModalProvider>
  )
}
