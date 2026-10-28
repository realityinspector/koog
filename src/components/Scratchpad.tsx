import { useAppStore } from '../store/appStore'

export function Scratchpad() {
  const counter = useAppStore((s) => s.counter)
  const text = useAppStore((s) => s.text)
  return (
    <section>
      <h2>State check</h2>
      <p>
        <button onClick={() => useAppStore.setState((s) => ({ counter: s.counter + 1 }))}>
          Count: {counter}
        </button>
      </p>
      <input
        value={text}
        placeholder="Type here, then edit code..."
        onChange={(e) => useAppStore.setState({ text: e.target.value })}
      />
    </section>
  )
}
