"""Record every line in js/voice-lines.js to audio/<id>.m4a with Chatterbox (Resemble AI, MIT license).

Each line is spoken in its character's voice, cloned from tools/voice-refs/<voice>.wav (see make_voice_refs.py), with
the line's `emotion` as Chatterbox's exaggeration setting. Every take gets two automatic checks, since cloning can
garble words and drift accents: Whisper transcribes it and compares it with the script, and SpeechBrain's accent
classifier (CommonAccent) checks that it sounds like the character's reference sample (Bunsley must not turn
Australian). Failing takes are re-recorded, and the best one is kept.

Setup (one time):
    uv venv -p 3.11 .voice-venv
    uv pip install -p .voice-venv/bin/python chatterbox-tts mlx-whisper speechbrain "setuptools<81"

Run:
    .voice-venv/bin/python tools/record_voice.py [--force] [--only id1,id2]

Clips are skipped when their text, voice, emotion and reference sample are unchanged (tracked in audio/manifest.json)
and they passed both checks. Existing clips that were never accent-checked are checked and re-recorded only if they fail.
Chatterbox adds Resemble AI's inaudible "Perth" watermark to everything it generates.
"""
import argparse
import difflib
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "audio"
REFS = Path(__file__).resolve().parent / "voice-refs"
WHISPER = "mlx-community/whisper-small.en-mlx"
MAX_TAKES = 6
GOOD_ENOUGH = 0.9   # transcript/script word match that ends the retries
WARN_BELOW = 0.8    # best take still this far off: report it for a listen
ACCENT_MODEL = "Jzuluaga/accent-id-commonaccent_ecapa"
CACHE = Path.home() / ".cache" / "stadium-dogs-voice"


class AccentCheck:
    """A take passes if its most likely accent is one of the top two for its voice's reference sample."""

    def __init__(self):
        import torchaudio
        from speechbrain.inference.classifiers import EncoderClassifier
        self.torchaudio = torchaudio
        self.clf = EncoderClassifier.from_hparams(source=ACCENT_MODEL, savedir=str(CACHE / "accent-model"))
        self.allowed = {}

    def ranked(self, path):
        wav, sr = self.torchaudio.load(str(path))
        wav = self.torchaudio.functional.resample(wav.mean(0, keepdim=True), sr, 16000)
        probs = self.clf.classify_batch(wav)[0][0]
        return [self.clf.hparams.label_encoder.decode_ndim(int(i)) for i in probs.argsort(descending=True)]

    def label(self, path):
        return self.ranked(path)[0]

    def ok(self, voice, label):
        if voice not in self.allowed:
            self.allowed[voice] = set(self.ranked(REFS / f"{voice}.wav")[:2])
        return label in self.allowed[voice]

ONES = ("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen "
        "seventeen eighteen nineteen").split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def number_words(n):
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + ("" if n % 10 == 0 else " " + ONES[n % 10])
    if n < 1000:
        return ONES[n // 100] + " hundred" + ("" if n % 100 == 0 else " " + number_words(n % 100))
    return number_words(n // 1000) + " thousand" + ("" if n % 1000 == 0 else " " + number_words(n % 1000))


def ordinal_words(n):
    w = number_words(n).split()
    irregular = {"one": "first", "two": "second", "three": "third", "five": "fifth", "eight": "eighth",
                 "nine": "ninth", "twelve": "twelfth"}
    last = w[-1]
    w[-1] = irregular.get(last) or (last[:-1] + "ieth" if last.endswith("y") else last + "th")
    return " ".join(w)


def words(text):
    """Normalize text for comparison: '$40' and 'forty dollars', '13th' and 'thirteenth' come out the same."""
    t = text.lower()
    t = re.sub(r"(\d),(\d{3})", r"\1\2", t)
    t = re.sub(r"\$(\d+)(?:\.(\d\d))?", lambda m: f"{m[1]} dollars" + (f" {int(m[2])} cents" if m[2] and m[2] != "00" else ""), t)
    t = re.sub(r"(\d+)(st|nd|rd|th)\b", lambda m: ordinal_words(int(m[1])), t)
    t = re.sub(r"\d+", lambda m: number_words(int(m[0])), t)
    t = t.replace("-", " ").replace("dollars", "dollar")
    return re.findall(r"[a-z']+", t)


def match(expected, heard):
    return difflib.SequenceMatcher(None, words(expected), words(heard)).ratio()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--only", default="")
    args = ap.parse_args()

    js = "console.log(JSON.stringify(require('./js/voice-lines.js').LINES))"
    lines = json.loads(subprocess.run(["node", "-e", js], cwd=ROOT, check=True, capture_output=True, text=True).stdout)
    only = {s for s in args.only.split(",") if s}
    AUDIO.mkdir(exist_ok=True)
    manifest_path = AUDIO / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    ref_hash = {p.stem: hashlib.sha1(p.read_bytes()).hexdigest()[:12] for p in REFS.glob("*.wav")}

    todo, unchecked = [], []
    for line_id, line in lines.items():
        if only and line_id not in only:
            continue
        key = {"engine": "chatterbox", "spoken": line.get("spoken", line["text"]), "voice": line["voice"],
               "emotion": line["emotion"], "ref": ref_hash.get(line["voice"])}
        if key["ref"] is None:
            sys.exit(f"No reference sample for voice {line['voice']}; run tools/make_voice_refs.py first.")
        old = manifest.get(line_id, {})
        if args.force or not (AUDIO / f"{line_id}.m4a").exists() or {k: old.get(k) for k in key} != key:
            todo.append((line_id, key))
        elif "accent" not in old:
            unchecked.append((line_id, key))

    accent = AccentCheck() if todo or unchecked else None
    for line_id, key in unchecked:
        with tempfile.TemporaryDirectory() as tmp:
            wav = Path(tmp) / "clip.wav"
            subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16@24000", str(AUDIO / f"{line_id}.m4a"), str(wav)], check=True)
            label = accent.label(wav)
        if accent.ok(key["voice"], label):
            manifest[line_id]["accent"] = label
        else:
            print(f"{line_id}: accent drifted to {label}; re-recording", file=sys.stderr, flush=True)
            todo.append((line_id, key))
    manifest_path.write_text(json.dumps(manifest, indent=1, sort_keys=True))
    print(f"{len(todo)} of {len(lines)} lines to record.", file=sys.stderr, flush=True)
    if not todo:
        return

    # Heavy imports only when there is work to do.
    import mlx_whisper
    import torch
    import torchaudio as ta
    from chatterbox.tts import ChatterboxTTS

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    model = ChatterboxTTS.from_pretrained(device=device)
    warnings = []
    for n, (line_id, key) in enumerate(todo, 1):
        spoken, emotion = key["spoken"], key["emotion"]
        cfg = 0.3 if emotion >= 0.8 else 0.5   # looser pacing for the most animated lines
        seed = int(hashlib.sha1(line_id.encode()).hexdigest()[:8], 16)
        best = None
        with tempfile.TemporaryDirectory() as tmp:
            for take in range(MAX_TAKES):
                torch.manual_seed(seed + take)
                # Accent drift comes with the most animated delivery, so later takes calm down a little.
                exag = emotion if take < 3 else max(0.35, emotion - 0.2)
                wav = model.generate(spoken, audio_prompt_path=str(REFS / f"{key['voice']}.wav"),
                                     exaggeration=exag, cfg_weight=max(cfg, 0.5) if take >= 3 else cfg)
                path = Path(tmp) / f"take{take}.wav"
                ta.save(str(path), wav, model.sr)
                heard = mlx_whisper.transcribe(str(path), path_or_hf_repo=WHISPER)["text"].strip()
                score = match(spoken, heard)
                label = accent.label(path)
                rank = (accent.ok(key["voice"], label), score)
                if best is None or rank > best[0]:
                    best = (rank, path, heard, label)
                if rank[0] and score >= GOOD_ENOUGH:
                    break
            (accent_ok, score), path, heard, label = best
            # AAC in an .m4a container plays in every current browser, including from file:// pages.
            subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "64000", str(path), str(AUDIO / f"{line_id}.m4a")], check=True)
        manifest[line_id] = {**key, "match": round(score, 3)}
        if accent_ok:
            manifest[line_id]["accent"] = label
        manifest_path.write_text(json.dumps(manifest, indent=1, sort_keys=True))  # save as we go, so a stop can resume
        flag = "  <-- listen to this one" if score < WARN_BELOW or not accent_ok else ""
        print(f"[{n}/{len(todo)}] {line_id} match {score:.2f}, accent {label} ({take + 1} take{'s' if take else ''}){flag}",
              file=sys.stderr, flush=True)
        if flag:
            warnings.append(f"{line_id}: accent {label}; expected {spoken!r}, heard {heard!r}")

    for stale in set(manifest) - set(lines):
        (AUDIO / f"{stale}.m4a").unlink(missing_ok=True)
        del manifest[stale]
    manifest_path.write_text(json.dumps(manifest, indent=1, sort_keys=True))
    print("\n".join(["", "Lines to check by ear:", *warnings] if warnings else ["", "Every line matched its script."]), file=sys.stderr)


if __name__ == "__main__":
    main()
