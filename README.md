# Stadium Dogs

A point-and-click business game inspired by 1990s educational CD-ROMs. You run a hot dog stand at the city stadium
for a season of events: check the calendar and the TV weather, order from suppliers, pay them by check, set your
prices, hire helpers, and try to finish with $2,200 in the bank while beating the two rival stands.

## Play

No install or build step. Open `index.html` in a browser:

```sh
open index.html      # macOS
```

or run `npm start`, which does the same. Everything runs locally; an internet connection is only used to load the
fonts, and the game falls back to system fonts without one. Progress saves in the browser, so **Quit** and
**Continue Season** pick up where you left off. The 🔊 button turns the sound and voices on or off.

## Run the tests

Requires [Node.js](https://nodejs.org) 18 or later:

```sh
npm test
```

## Project layout

| Path | What it is |
|---|---|
| `js/sim.js` | Game rules: events, weather, suppliers, prices, customers, rivals |
| `js/art.js` | The scenes, drawn as SVG |
| `js/game.js` | Screens, navigation, sound, and the event animation |
| `js/voice-lines.js` | The script for every recorded line, with each character's voice and emotion |
| `audio/` | The recorded voice lines |
| `tools/` | Scripts that record the voice lines (only needed to change them) |
| `test/` | Tests for the rules and the recordings |

## Changing a voice line

Edit the line in `js/voice-lines.js`, then re-record it. Recording is only needed when lines change, and it uses
[Chatterbox](https://github.com/resemble-ai/chatterbox) with Whisper and an accent classifier to check each take.
The one-time setup and the command are at the top of `tools/record_voice.py`. `npm test` fails if a line changed
without being re-recorded.

## Credits

- Voices: recorded with Chatterbox (MIT license) from reference voices made with
  [Kokoro](https://github.com/hexgrad/kokoro) (Apache 2.0). Chatterbox adds an inaudible watermark to its audio.
- Fonts: Chewy, Patrick Hand, and Schoolbell from Google Fonts (SIL Open Font License).
- Artwork and writing are original to this project.
