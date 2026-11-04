import { MidiStatus } from './components/MidiStatus'
import { NoteReadout } from './components/NoteReadout'
import { Scratchpad } from './components/Scratchpad'
import { BeatsPanel } from './features/beats/BeatsPanel'
import { BuildLog } from './features/buildlog/BuildLog'
import { ChallengesPanel } from './features/challenges/ChallengesPanel'
import { SmartReadout } from './features/harmony/SmartReadout'
import { CoachTips } from './features/harmony/CoachTips'
import { Mentor } from './features/mentor/Mentor'
import { PreflightPanel } from './features/preflight/PreflightPanel'
import { RequestBar } from './features/requests/RequestBar'
import { SongsPanel } from './features/songs/SongsPanel'
import { SynthHistoryPanel } from './features/synth-history/SynthHistoryPanel'
import { TestRigPanel } from './features/test-rig/TestRigPanel'
import { Visualizer } from './features/visualizer/Visualizer'
import { PianoStrip } from './features/keyboard/PianoStrip'
import { ErrorBoundary } from './layout/ErrorBoundary'
import { Instrument, type ModeDef } from './layout/Instrument'
import { Icon } from './ui/Icon'
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
import { DrumsDock, DrumsScreen } from './features/drumpads/DrumPads'
import { LoopsDock } from './features/loopstation/LoopsDock'
import { KodeDock } from './features/kode/KodePanel'
import { MimicChip } from './features/mimic/MimicChip'
import { ModesLauncher } from './features/modes/ModesLauncher'
import { PedalboardDock } from './features/pedalboard/Pedalboard'
import { SmartBandChip } from './features/smartband/SmartBandChip'
import { useEffect } from 'react'
import { startLinks } from './links/sync'
import { LinkNote } from './links/LinkNote'
import { GlobalClearedToast } from './features/loopstation/GlobalClearedToast'
import { Gallery } from './features/gallery/Gallery'
import { BossStoreEntry } from './features/appstore/AppStore'
import { PerfHud } from './features/perfmon/PerfHud'
import './music/judge'
import './ui/chrome.css'

export function App() {
  const mode = useProfile((s) => s.mode)
  const player = useProfile((s) => s.active)
  const badgeCount = useChallengeStore((s) => Object.keys(s.badges).length)
  const dad = mode === 'dad'
  useEffect(() => startLinks(), [])
  const modes: ModeDef[] = [
    { id: 'play', icon: <Icon name="keys" />, label: 'PLAY', title: 'Play' },
    { id: 'songs', icon: <Icon name="note" />, label: 'SONGS', title: 'Songs', node: <SongsPanel key={'so-' + player} /> },
    // key = player: switching kids remounts these so they load that kid's saved progress
    { id: 'challenges', icon: <Icon name="trophy" />, label: 'CHALLENGE', title: 'Challenges', badge: badgeCount > 0 ? badgeCount : undefined, node: <ChallengesPanel key={'ch-' + player} /> },
    { id: 'games', icon: <Icon name="game" />, label: 'GAMES', title: 'Games', node: <GamesPanel key={'gm-' + player} /> },
    { id: 'beats', icon: <Icon name="drum" />, label: 'BEATS', title: 'Beats', node: <BeatsPanel /> },
    { id: 'synth', icon: <Icon name="knobs" />, label: 'SYNTH', title: 'Synth History', node: <SynthHistoryPanel /> },
    { id: 'log', icon: <Icon name="wrench" />, label: 'LOG', title: 'Behind the scenes', node: <BuildLog /> },
  ]
  // BOSS mode (= Dad mode): a lean studio. No visualizer, songs, games, challenges, build log, idea box, coach or tour.
  if (dad) {
    const diag = (<><ProfileManager /><MidiStatus /><PreflightPanel /><TestRigPanel /><NoteReadout /><Scratchpad /></>)
    const boss: ModeDef[] = [
      { id: 'play', icon: <Icon name="sliders" />, label: 'STUDIO', title: 'Studio' },
      { id: 'dj', icon: <Icon name="phones" />, label: 'DJ', title: 'DJ decks', node: <DjScreen /> },
      { id: 'loops', icon: <Icon name="loop" />, label: 'LOOPS', title: 'Loop station', node: <LoopsScreen /> },
      { id: 'drums', icon: <Icon name="drum" />, label: 'DRUMS', title: 'Drum pads', node: <DrumsScreen /> },
      { id: 'synth', icon: <Icon name="knobs" />, label: 'SYNTHS', title: 'Emulator rack', node: <SynthsScreen /> },
      { id: 'scenes', icon: <Icon name="scenes" />, label: 'SCENES', title: 'Scenes', node: <ScenesScreen key={'sc-' + player} /> },
    ]
    return (
      <ErrorBoundary>
        <Instrument lean strip={<><ProfileBar /><StripControls /></>} idea={null} display={<ProStudio key={'bx-' + player} diag={diag} />} overlay={<><DuoDeck /><MimicChip /><Mentor tech /><PedalboardDock /></>} keybed={<PianoStrip />} sheet={<><SheetOverlay /><ControllerOverlay /></>} modes={boss} />
        <WhoIsPlaying />
        <LinkNote /><GlobalClearedToast />
        <Gallery />
        <BossStoreEntry />
        <PerfHud />
      </ErrorBoundary>
    )
  }
  return (
    <ErrorBoundary>
      <Instrument strip={<><ProfileBar /><StripControls /></>} idea={<RequestBar />} display={<Visualizer />} overlay={<><SmartReadout /><CoachTips /><ModesLauncher /><DuoDeck chip={false} /><DrumsDock /><LoopsDock /><KodeDock /><MimicChip launcher /><SmartBandChip pill /><Mentor /><PedalboardDock /></>} keybed={<PianoStrip />} sheet={<><SheetOverlay /><ControllerOverlay /></>} modes={modes} />
      <WhoIsPlaying />
      <LinkNote /><GlobalClearedToast />
      <Gallery />
      <PerfHud />
      <Tour />
    </ErrorBoundary>
  )
}
