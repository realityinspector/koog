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
import { AppShell, type TabDef } from './layout/AppShell'
import { ProfileBar, ProfileManager, WhoIsPlaying } from './profile/ProfileBar'
import { useChallengeStore } from './features/challenges/store'
import { useProfile } from './profile/profile'

export function App() {
  const mode = useProfile((s) => s.mode)
  const player = useProfile((s) => s.active)
  const badgeCount = useChallengeStore((s) => Object.keys(s.badges).length)
  const dad = mode === 'dad'
  const tabs: TabDef[] = [
    { id: 'play', icon: '🎹', label: 'Play', node: (<><HarmonyHud /><Visualizer /><BeatsPanel /></>) },
    // key = player: switching kids remounts these so they load that kid's saved progress
    { id: 'challenges', icon: '🏆', label: 'Challenges', badge: badgeCount > 0 ? badgeCount : undefined, node: <ChallengesPanel key={'ch-' + player} /> },
    { id: 'songs', icon: '🎵', label: 'Songs', node: <SongsPanel key={'so-' + player} /> },
    { id: 'synth', icon: '🎛️', label: 'Synth History', node: <SynthHistoryPanel /> },
    { id: 'log', icon: '🔧', label: 'Behind the scenes', node: <BuildLog /> },
  ]
  if (dad) {
    tabs.push({
      id: 'dev', icon: '🛠️', label: 'Dev', dev: true,
      node: (<><ProfileManager /><MidiStatus /><PreflightPanel /><TestRigPanel /><NoteReadout /><Scratchpad /></>),
    })
  }
  return (
    <>
      <AppShell header={<ProfileBar />} top={<RequestBar />} tabs={tabs} />
      <WhoIsPlaying />
    </>
  )
}
