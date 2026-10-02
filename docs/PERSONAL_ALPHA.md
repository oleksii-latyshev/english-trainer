# Personal Alpha: Install and Start

This build targets Apple Silicon Macs running macOS 14 or newer. Conversation,
Coach, and Learning Memory are the personal-alpha practice surfaces. Interview,
Drills, and Progress prototypes are unavailable in this build; their sample scores
are not learner data.

## Install a local build

From the repository, run `bun install --frozen-lockfile`, then
`bun run build:desktop`. The build uses Command Line Tools when installed and
`DEVELOPER_DIR` is unset, without changing your system Xcode selection.

The output is:

- `src-tauri/target/release/bundle/macos/English Trainer.app`;
- the installer under `src-tauri/target/release/bundle/dmg/`.

Open the DMG and drag English Trainer to Applications. You can also copy the app
bundle directly to Applications. Quit an older running copy before replacing it.
The application identifier remains `com.user.english-trainer`, so existing local
sessions and Learning Memory stay in the same app-data directory.

The alpha uses ad-hoc signing, not Apple Developer ID notarization. A build
downloaded from GitHub may require approval in macOS System Settings → Privacy &
Security → Open Anyway. Do not disable Gatekeeper globally. See
[Tauri's macOS signing guidance](https://v2.tauri.app/distribute/sign/macos/).

## Download a CI build

After these changes are pushed to `main`, the CI workflow runs tests and then
builds the macOS installer. You can also select Actions → CI → Run workflow.
Download the `English-Trainer-macos-arm64-<commit>` artifact from the successful
run. Extract the artifact, open its DMG, and install the app. The `.app.zip`
alternative preserves executable permissions and bundle metadata.

These are private-use build artifacts, not automatic updates or public releases.
No Apple signing secrets are required. Artifacts expire after 14 days.

## Prepare speech and AI

The installer contains the app, but not Whisper, its model, or Antigravity CLI.
Open Settings & Audio to check the files actually detected by the installed app.
An available CLI is not proof of authentication, successful transcription, GPU
acceleration, or usable microphone permission.

1. Install Whisper using `brew install whisper.cpp` if it is missing.
2. Place the English model at the path shown in Settings. The default is
   `~/Library/Application Support/com.user.english-trainer/models/ggml-base.en.bin`.
   The exact download and checksum instructions are in [README](../README.md#local-transcription-setup).
3. Install Antigravity CLI and sign in using its own setup. The app searches PATH,
   Homebrew locations, and `~/.local/bin/agy`. Use Test AI response in Settings to
   send only a synthetic setup sentence; this does not create a practice session.
4. Select an available system voice and optionally test playback in Settings.
5. Start Conversation or Coach. macOS requests microphone permission when you
   begin recording. Settings never records automatically.

Shell environment overrides (`ENG_TRAINER_WHISPER_BIN`,
`ENG_TRAINER_WHISPER_MODEL`, `ENG_TRAINER_AGY_BIN`) apply when the app inherits
that environment. A Finder launch does not inherit your terminal's shell setup;
use the default locations for this alpha. Missing dependencies stay recoverable
and can be checked again after installation.

## First practice sessions

Try a short Conversation, a Coach answer with Try Again, and a Memory voice
review once you have saved learning items. Check that closing and reopening the
app restores the current session. Note any unreliable transcription, overlapping
voice playback, long waits, unhelpful corrections, or confusing controls.

No real microphone acceptance is implied by a successful build or unit tests.
The suggested 10–15 minute Daily Practice has an eight-answer goal, not a timer.
Usage review is optional and limited to the first two Conversation answers.

Transcription is local. Raw audio is discarded after successful transcription;
failed transient attempts can stay in memory for retry until reset/close.
Transcripts and the necessary prompt context go to the configured AI provider.
Sessions, mistakes, phrases, and evidence are stored in local SQLite. There is
no raw-audio retention toggle, export, notification scheduler, or certified CEFR
assessment in this alpha.

## Setup acceptance scenarios

```gherkin
Scenario: Missing or unreadable local dependency
  Given a configured Whisper command is missing or cannot be executed
  When I recheck files in Settings
  Then I see the detected path and a missing or unreadable status
  And no command or microphone capture starts

Scenario: Model file cannot be used
  Given the Whisper model is empty or unreadable
  When I recheck files in Settings
  Then the model is reported as unreadable

Scenario: Files are available
  Given the CLI is readable and executable and the model is readable and non-empty
  When I open Settings
  Then the files are reported as found
  And authentication and transcription are still explicitly unverified

Scenario: Explicit provider test
  Given I am on Settings
  When I choose Test AI response
  Then only a synthetic setup sentence is sent
  And the result or recoverable error is shown without saving a learning session
```
