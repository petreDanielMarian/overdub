# Overdub

Record a phrase, loop it, layer more takes on top, mark one as an intro or outro, export a
finished track. A companion app for [DnDash](../claude) — launched from its Tools → Music
Library, and the exported `.wav` gets imported back in from there.

## Setup

```
npm install
npm run electron
```

## How it works

1. **Enable Microphone**, then **Record First Layer** and stop it when you're done — that
   take's length becomes the loop length.
2. Pick a role (**Loop** / **Intro** / **Outro**) and **Record New Layer**. A loop layer waits
   for the next pass to start, so it locks in phase with what's already playing; intro/outro
   layers are one-shots and record immediately, free-length.
3. Mute, solo, adjust volume, or **Redo** any layer independently.
4. **Export Track…** renders intro-once → loop×N → outro-once with a short fade, and saves a
   `.wav` via a normal save dialog.
5. In DnDash: Tools → Music Library → **Import Audio File…**, pick the file you just saved.

## Testing

```
npm test    # pure logic: loop-boundary timing math, the WAV encoder
npm run check
```

The recording/looping engine itself (mic capture, phase-locked playback, the actual export
sound) needs a real browser with a real microphone to verify — see the plan's own verification
notes for what to listen for (a "clap on the beat" test is the fastest way to hear drift, if
any creeps in over many loop passes).
