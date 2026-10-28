import CoreMIDI
func name(_ o: MIDIObjectRef) -> String { var s: Unmanaged<CFString>?; MIDIObjectGetStringProperty(o, kMIDIPropertyDisplayName, &s); return (s?.takeRetainedValue() as String?) ?? "?" }
for i in 0..<MIDIGetNumberOfSources() { print("src:" + name(MIDIGetSource(i))) }
for i in 0..<MIDIGetNumberOfDestinations() { print("dst:" + name(MIDIGetDestination(i))) }
