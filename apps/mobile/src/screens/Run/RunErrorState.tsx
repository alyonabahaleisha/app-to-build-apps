/**
 * RunErrorState — fetch error / 404 branch for RunScreen.
 *
 * Renders a full-screen error view with RunHeader.Loading and RunFailedBanner.
 * Used when useMiniAppQuery returns an error (including 404) or no data.
 */
import {View, StyleSheet} from 'react-native'

import {SafeContainer} from '#/components/SafeContainer'
import {RunFailedBanner} from './RunFailedBanner'
import {RunHeader} from './RunHeader'
import {runCopy} from './copy'

export interface RunErrorStateProps {
  is404: boolean
  onBack: () => void
  onRecreate: () => void
}

export function RunErrorState({is404, onBack, onRecreate}: RunErrorStateProps) {
  return (
    <SafeContainer>
      <View style={styles.root} testID="run-screen-root">
        <RunHeader.Loading onBack={onBack} />
        <RunFailedBanner
          onBackToLibrary={onBack}
          headlineOverride={is404 ? runCopy.notFound : undefined}
          hideRecreate={is404}
          onRecreate={onRecreate}
        />
      </View>
    </SafeContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
})
