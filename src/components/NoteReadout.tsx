import { useAppStore } from '../store/appStore'

export function NoteReadout() {
  const notes = useAppStore((s) => s.recentNotes)
  return (
    <section>
      <h2>Recent notes</h2>
      {notes.length === 0 ? (
        <em>Play something...</em>
      ) : (
        <ul>
          {notes.map((n) => (
            <li key={n.id}>
              {n.on ? 'on ' : 'off'} {n.name} (#{n.note}) vel {n.velocity}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
