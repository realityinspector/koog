import { MidiStatus } from './components/MidiStatus'
import { NoteReadout } from './components/NoteReadout'
import { Scratchpad } from './components/Scratchpad'
import { BeatsPanel } from './features/beats/BeatsPanel'
import { BuildLog } from './features/buildlog/BuildLog'
import { ChallengesPanel } from './features/challenges/ChallengesPanel'
import { HarmonyHud } from './features/harmony/HarmonyHud'
import { PreflightPanel } from './features/preflight/PreflightPanel'
import { RequestBar } from './features/requests/RequestBar'
import { SongsPanel } from './features/songs/SongsPanel'
import { SynthHistoryPanel } from './features/synth-history/SynthHistoryPanel'
import { TestRigPanel } from './features/test-rig/TestRigPanel'
import { Visualizer } from './features/visualizer/Visualizer'
import { ProfileBar, ProfileManager, WhoIsPlaying } from './profile/ProfileBar'
import { useProfile } from './profile/profile'

export function App() {
  const mode = useProfile((s) => s.mode)
  const player = useProfile((s) => s.active)
  const dad = mode === 'dad'
  return (
    <main>
      <ProfileBar />
      <RequestBar />
      <h1>Koog</h1>
      <WhoIsPlaying />
      <HarmonyHud />
      <Visualizer />
      <BeatsPanel />
      {/* key = player: switching kids remounts these so they load that kid's saved progress */}
      <ChallengesPanel key={'ch-' + player} />
      <SongsPanel key={'so-' + player} />
      <SynthHistoryPanel />
      <BuildLog />
      {dad && (
        <>
          <ProfileManager />
          <MidiStatus />
          <PreflightPanel />
          <TestRigPanel />
          <NoteReadout />
          <Scratchpad />
        </>
      )}
    </main>
  )
}
