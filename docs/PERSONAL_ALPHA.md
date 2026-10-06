# Personal Alpha: Install and Set Up

For Apple Silicon Macs on macOS 14 or newer. Practice surfaces: Conversation, Coach and Learning
Memory. Interview, Drills and Progress are prototypes and shown as unavailable; their sample scores
are not learner data.

## Install a local build

1. `bun install --frozen-lockfile`
2. `bun run build:desktop` (uses Command Line Tools when installed and `DEVELOPER_DIR` is unset,
   without changing the system Xcode selection).
3. Install `src-tauri/target/release/bundle/macos/English Trainer.app` or open the DMG from
   `src-tauri/target/release/bundle/dmg/` and drag the app to Applications. Quit an older running
   copy first.

The identifier stays `com.user.english-trainer`, so sessions and Learning Memory are kept across
updates. The build is ad-hoc signed, not notarised: a downloaded build may need System Settings →
Privacy & Security → Open Anyway. Do not disable Gatekeeper globally.

## CI builds

Pushes to `main` (or Actions → CI → Run workflow) run the checks and build an installer. Download
the `English-Trainer-macos-arm64-<commit>` artifact; it contains the DMG and an `.app.zip`.
Artifacts expire after 14 days. They are private builds, not releases or automatic updates.

## Prepare speech and AI

The app bundle does not contain Whisper, its model, or provider sign-ins. Settings shows what the
installed app actually detects; detection does not prove authentication, transcription quality or
microphone permission.

1. **Whisper:** `brew install whisper.cpp`, then place the English model at the path shown in
   Settings (default `~/Library/Application Support/com.user.english-trainer/models/ggml-base.en.bin`;
   download and checksum in the [README](../README.md#local-transcription-setup)).
2. **Conversation AI** (Settings → Conversation AI, then Save):
   - **Apple (on-device):** needs macOS 26+, Apple Intelligence enabled, matching Mac and Siri
     languages, and the downloaded model. Free and private. The helper is bundled with the app;
     builds made with an older SDK contain an "unavailable" stub.
   - **Antigravity CLI (`agy`):** install and sign in with its own setup; the app looks in `PATH`,
     Homebrew locations and `~/.local/bin/agy`. "Use Antigravity setting" follows the model in the
     CLI's settings file; Flash Low / Flash High override it. Slow for live conversation (6–30 s
     measured).
   - **Gemini API (recommended, default):** create a key in
     [Google AI Studio](https://aistudio.google.com/apikey) and paste it into Settings → Conversation
     AI → Save key. It is saved encrypted in the app data folder
     (`~/Library/Application Support/com.user.english-trainer/gemini-api-key.enc`) and only decrypts on this
     computer; `ENG_TRAINER_GEMINI_API_KEY` overrides it for development. No system permission
     prompt is involved. When Gemini stalls or is overloaded, the on-device Apple model answers
     instead if it is available. The free tier may use prompts to improve Google products and let human reviewers read
     them; only practice transcripts are sent.
   - Coaching, guided examples and the usage review still always use `agy`. Apple failures are
     never silently retried through another provider.
3. **Voice:** choose a system voice and rate in Settings. The standard English voice is
   recommended.
4. **Microphone:** choose the input in Settings and run the ten-second record/playback check. Wait
   for **Recording** before speaking (the app waits three seconds for the input to warm up). The
   check is local: it is not transcribed, sent or saved.
5. Use **Test AI response** to send a synthetic sentence and see the time to first words and the
   full reply.

Shell overrides (`ENG_TRAINER_WHISPER_BIN`, `ENG_TRAINER_WHISPER_MODEL`, `ENG_TRAINER_AGY_BIN`) apply
only when the app inherits that environment; a Finder launch does not.

## Using the alpha

- **Conversation:** eight-answer goal, voice or text composer, editable transcript before sending,
  optional voice auto-send. Check names and technical terms in the recognised text before sending.
- **Coach:** four answers; each answer is saved for review, Try Again records a second attempt, and
  Continue asks the next question.
- **Answer help → Full Help → Show complete example:** a short fictional model answer for the
  current question with replaceable details. Requesting it marks later answers in this session as
  cued for Learning Memory.
- **Learning Memory:** saved phrases and mistakes, self-reported review, and a voice review of up
  to three due items.
- Closing and reopening the app restores the current session. A failed AI reply keeps your answer
  ready to resend.

## Data

Transcription is local; raw audio is discarded after successful transcription (failed attempts stay
in memory for retry until reset or close). Transcripts and necessary context go to the selected AI
provider. Sessions, mistakes, phrases and evidence are stored in local SQLite. There is no audio
retention option, export, notifications or CEFR assessment.

## Setup acceptance scenarios

```gherkin
Scenario: Missing or unreadable local dependency
  Given a configured Whisper command is missing or cannot be executed
  When I recheck files in Settings
  Then I see the detected path and a missing or unreadable status
  And no command or microphone capture starts

Scenario: Explicit provider test
  Given I am on Settings
  When I choose Test AI response
  Then only a synthetic setup sentence is sent
  And the result or a recoverable error is shown without saving a learning session
```
