import { MidiStatus } from './components/MidiStatus'
import { NoteReadout } from './components/NoteReadout'
import { Scratchpad } from './components/Scratchpad'
import { BeatsPanel } from './features/beats/BeatsPanel'
import { BuildLog } from './features/buildlog/BuildLog'
import { ChallengesPanel } from './features/challenges/ChallengesPanel'
import { SmartReadout } from './features/harmony/SmartReadout'
import { CoachTips } from './features/harmony/CoachTips'
import { PreflightPanel } from './features/preflight/PreflightPanel'
import { RequestBar } from './features/requests/RequestBar'
import { SongsPanel } from './features/songs/SongsPanel'
import { SynthHistoryPanel } from './features/synth-history/SynthHistoryPanel'
import { TestRigPanel } from './features/test-rig/TestRigPanel'
import { Visualizer } from './features/visualizer/Visualizer'
import { PianoStrip } from './features/keyboard/PianoStrip'
import { Instrument, type ModeDef } from './layout/Instrument'
import { ProfileBar, ProfileManager, WhoIsPlaying } from './profile/ProfileBar'
import { useChallengeStore } from './features/challenges/store'
import { useProfile } from './profile/profile'
import { Tour } from './features/tour/Tour'
import { GamesPanel } from './features/games/GamesPanel'
import { StripControls } from './layout/StripControls'
import { SheetOverlay } from './features/sheet/SheetOverlay'
import { DuoDeck } from './features/dj/DjDeck'
import { ControllerOverlay } from './features/controller/ControllerOverlay'
import { ProStudio } from './features/pro/ProStudio'
import { DjScreen, LoopsScreen, ScenesScreen, SynthsScreen } from './features/pro/ProScreens'
import './music/judge'

export function App() {
  const mode = useProfile((s) => s.mode)
  const player = useProfile((s) => s.active)
  const badgeCount = useChallengeStore((s) => Object.keys(s.badges).length)
  const dad = mode === 'dad'
  const modes: ModeDef[] = [
    { id: 'play', icon: '🎹', label: 'PLAY', title: 'Play' },
    { id: 'songs', icon: '🎵', label: 'SONGS', title: 'Songs', node: <SongsPanel key={'so-' + player} /> },
    // key = player: switching kids remounts these so they load that kid's saved progress
    { id: 'challenges', icon: '🏆', label: 'CHALLENGE', title: 'Challenges', badge: badgeCount > 0 ? badgeCount : undefined, node: <ChallengesPanel key={'ch-' + player} /> },
    { id: 'games', icon: '🎮', label: 'GAMES', title: 'Games', node: <GamesPanel key={'gm-' + player} /> },
    { id: 'beats', icon: '🥁', label: 'BEATS', title: 'Beats', node: <BeatsPanel /> },
    { id: 'synth', icon: '🎛️', label: 'SYNTH', title: 'Synth History', node: <SynthHistoryPanel /> },
    { id: 'log', icon: '🔧', label: 'LOG', title: 'Behind the scenes', node: <BuildLog /> },
  ]
  // BOSS mode (= Dad mode): a lean studio. No visualizer, songs, games, challenges, build log, idea box, coach or tour.
  if (dad) {
    const diag = (<><ProfileManager /><MidiStatus /><PreflightPanel /><TestRigPanel /><NoteReadout /><Scratchpad /></>)
    const boss: ModeDef[] = [
      { id: 'play', icon: '🎚️', label: 'STUDIO', title: 'Studio' },
      { id: 'dj', icon: '🎧', label: 'DJ', title: 'DJ decks', node: <DjScreen /> },
      { id: 'loops', icon: '🔁', label: 'LOOPS', title: 'Loop station', node: <LoopsScreen /> },
      { id: 'synth', icon: '🎛️', label: 'SYNTHS', title: 'Emulator rack', node: <SynthsScreen /> },
      { id: 'scenes', icon: '🎬', label: 'SCENES', title: 'Scenes', node: <ScenesScreen key={'sc-' + player} /> },
    ]
    return (
      <>
        <Instrument lean strip={<><ProfileBar /><StripControls /></>} idea={null} display={<ProStudio key={'bx-' + player} diag={diag} />} overlay={<DuoDeck />} keybed={<PianoStrip />} sheet={<><SheetOverlay /><ControllerOverlay /></>} modes={boss} />
        <WhoIsPlaying />
      </>
    )
  }
  return (
    <>
      <Instrument strip={<><ProfileBar /><StripControls /></>} idea={<RequestBar />} display={<Visualizer />} overlay={<><SmartReadout /><CoachTips /><DuoDeck /></>} keybed={<PianoStrip />} sheet={<><SheetOverlay /><ControllerOverlay /></>} modes={modes} />
      <WhoIsPlaying />
      <Tour />
    </>
  )
}
