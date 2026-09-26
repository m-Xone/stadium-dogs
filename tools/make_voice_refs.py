"""Make a ~10 second reference sample for every voice used in js/voice-lines.js, saved to tools/voice-refs/<voice>.wav.

record_voice.py clones these samples, so each character keeps the same voice across re-recordings. The samples come
from Kokoro (https://github.com/hexgrad/kokoro, Apache 2.0); regenerate them only to change a character's voice.

Setup (one time):
    brew install espeak-ng
    uv venv -p 3.12 .kokoro-venv && uv pip install -p .kokoro-venv/bin/python kokoro-onnx soundfile
    Download kokoro-v1.0.onnx and voices-v1.0.bin from
    https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0

Run:
    .kokoro-venv/bin/python tools/make_voice_refs.py --models <folder with the two model files> [--force]
"""
import argparse
import json
import subprocess
from pathlib import Path

import soundfile as sf
from kokoro_onnx import EspeakConfig, Kokoro

ROOT = Path(__file__).resolve().parent.parent
REFS = Path(__file__).resolve().parent / "voice-refs"
# Varied sentences (a question, an exclamation, a list, numbers) give the cloner a fuller picture of the voice.
PASSAGE = ("Welcome to the stadium! We've got hot dogs, turkey dogs, chips, and ice cold cola. "
           "Are you hungry? The game starts at seven, and it's going to be a great one.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", required=True, type=Path)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    js = "console.log(JSON.stringify([...new Set(Object.values(require('./js/voice-lines.js').LINES).map(l => l.voice))]))"
    voices = json.loads(subprocess.run(["node", "-e", js], cwd=ROOT, check=True, capture_output=True, text=True).stdout)

    # Homebrew's espeak-ng: the copy bundled with kokoro-onnx looks for its data at a hard-coded build path.
    brew = subprocess.run(["brew", "--prefix", "espeak-ng"], check=True, capture_output=True, text=True).stdout.strip()
    espeak = EspeakConfig(lib_path=f"{brew}/lib/libespeak-ng.dylib", data_path=f"{brew}/share/espeak-ng-data")
    kokoro = Kokoro(str(args.models / "kokoro-v1.0.onnx"), str(args.models / "voices-v1.0.bin"), espeak_config=espeak)

    REFS.mkdir(exist_ok=True)
    for voice in voices:
        out = REFS / f"{voice}.wav"
        if out.exists() and not args.force:
            continue
        samples, rate = kokoro.create(PASSAGE, voice=voice, speed=1.0, lang="en-us")
        sf.write(out, samples, rate)
        print(f"{voice}: {len(samples) / rate:.1f}s")


if __name__ == "__main__":
    main()
