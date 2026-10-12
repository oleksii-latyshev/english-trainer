# Setup

## Requirements

- Apple Silicon Mac, macOS 14+ (Apple on-device AI and word translation need macOS 26+ with Apple
  Intelligence enabled).
- [Bun](https://bun.com) (version pinned in `package.json`), Rust (pinned by `rust-toolchain.toml`),
  Xcode Command Line Tools.
- Whisper: `brew install whisper.cpp` (provides `whisper-cli` and `whisper-server`).

## Develop

```bash
bun install                      # also installs the Lefthook git hooks
bunx playwright install chromium # once per machine, for e2e
bun run dev                      # desktop app with hot reload
```

`bun run dev:web` serves only the frontend in a browser; Tauri commands are unavailable there.

| Command | Runs |
| :--- | :--- |
| `bun run verify` | everything CI runs: typecheck, Biome, unit tests, Rust fmt/Clippy/tests, e2e |
| `bun run check:fix` | Biome format and safe fixes |
| `bun run test` · `bun run test:rust` · `bun run test:e2e` | one suite |
| `bunx playwright show-report` | the last e2e report with traces and screenshots |

The pre-commit hook runs the same checks as CI and never edits or stages files.

`bun run check:conventions` fails on comments and missing `flow.md` files in migrated code
(CODE_REQUIREMENTS › Principles). In Claude Code, `.claude/hooks/format-edited.sh` runs Biome with
safe fixes on every file Claude edits; it is silent and never blocks the edit.

Supply chain: `cargo deny --manifest-path src-tauri/Cargo.toml check` verifies advisories, licence
compatibility with AGPL-3.0 and crate sources. Unmaintained-crate findings are enforced for our own
crates only (`unmaintained = "workspace"`); those deep in the Tauri tree are Tauri's to replace.

## Speech recognition model

Models live in the app data folder; `small.en` is used when installed, `base.en` otherwise.

```bash
MODELS="$HOME/Library/Application Support/com.user.english-trainer/models"
mkdir -p "$MODELS"
curl -fL https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin -o "$MODELS/ggml-small.en.bin"
```

Settings › Speech recognition measures every installed model on your own recordings.

## Natural voice

The Supertonic 3 helper, model and runtime are pinned build assets (`scripts/prepare-voice.sh`) and
ship with their licences. Measure real latency before changing phrase length or the helper:

```bash
python3 scripts/check-voice.py
cargo test --manifest-path src-tauri/Cargo.toml voice::infra::supertonic::tests::real_bundled_voice_latency -- --ignored --nocapture
bun scripts/measure-voice-gaps.ts --replies replies.json --rounds 3
```

The first fails when warm p95 generation exceeds 750 ms; the second exercises the persistent engine.
The third replays real replies (`replies.json`: an array of strings, two to four sentences each)
through the previous pipeline and the current one with the real helper and prints time to first
audio, per-phrase synthesis time, fallbacks and the silence between phrases of one sentence. Run it
on an idle Mac; every number in a pull request that changes phrase length, deadlines or padding
trimming comes from it.

## AI providers

- **Gemini API** (default): create a key in [Google AI Studio](https://aistudio.google.com/apikey)
  and paste it into Settings › Conversation AI. It is stored encrypted and bound to this Mac. On the
  free tier Google may use prompts to improve its models; only practice transcripts are sent.
- **Apple on-device**: fallback when Gemini is unavailable; bundled helper, nothing to install.
- **Antigravity CLI (`agy`)**: background coaching, wrap-up and review material. Install and sign in
  with its own setup; the app finds it in `PATH`, Homebrew or `~/.local/bin`.

Development overrides (only when the app inherits the shell environment, not from Finder):
`ENG_TRAINER_GEMINI_API_KEY`, `ENG_TRAINER_WHISPER_BIN`, `ENG_TRAINER_WHISPER_SERVER_BIN`,
`ENG_TRAINER_WHISPER_MODEL`, `ENG_TRAINER_AGY_BIN`.

## Build and install

```bash
bun run build:desktop
```

Produces `src-tauri/target/release/bundle/macos/English Trainer.app` and a DMG. Builds are ad-hoc
signed, not notarised: a downloaded build may need System Settings › Privacy & Security › Open Anyway.
The bundle identifier stays `com.user.english-trainer`, so data survives updates.

## Release

CI checks every push and pull request but builds no installer. A release tag does:

1. Set the same version in `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`
   and commit it.
2. `git tag v0.2.0 && git push origin v0.2.0`

The `Release` workflow reruns all checks on the tagged commit, refuses a tag that does not match the
version, builds the DMG and app zip, and publishes them as a GitHub release with generated notes.
