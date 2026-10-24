# Text translation flow

On-demand translation of a selected word or short phrase (up to 8 words and 120 characters) into
the learner's native language, plus a short English explanation. It is the approved exception to
English-only practice (PRODUCT_SPEC §4.2). Everything runs on this Mac through the bundled Swift
helper (macOS Translation and Apple Intelligence); nothing goes to Gemini or the conversation queue.

`TranslationLayer` is mounted by the app shell on Talk, Memory, review and the summary
(`isTranslatablePath`) and keyed by the path, so leaving a screen resets everything. Selectable text
carries `data-word-lookup`; a selection must start and end inside the same element.

## Select text and translate

```mermaid
sequenceDiagram
    actor Learner
    participant Session as translationSessionAtom
    participant Trigger as TranslateTrigger
    participant Commands as translateSelection
    participant Command as lookupCommandAtom
    participant Service as TextTranslationService
    participant Rust as translate_text / explain_text
    participant Translator as warm translate helper
    participant Explainer as warm explain helper
    participant Panel as TranslationPanel

    Learner->>Session: selects text (selectionchange, mouseup, keyup)
    Session->>Session: readTextSelection, normalizePhrase
    alt not marked, editable, longer than 8 words or 120 characters
        Session-->>Trigger: no selection, no trigger
    else valid
        Session-->>Trigger: selection with anchor
        Trigger-->>Learner: accent "Translate" button next to the selection
    end
    Learner->>Trigger: clicks Translate
    Trigger->>Commands: translateSelection
    Commands->>Panel: panel opens, draft is the selected text
    Commands->>Command: stage translation
    Command->>Service: translate(request)
    Service->>Rust: invoke("translate_text")
    Rust->>Translator: one JSON line
    Translator-->>Rust: translation
    Rust-->>Service: TextTranslation
    Service-->>Command: translation
    Command-->>Panel: translated, explanation pending
    Command->>Service: explain(request)
    Service->>Rust: invoke("explain_text")
    Rust->>Explainer: one JSON line
    Explainer-->>Rust: English explanation
    Rust-->>Command: TextExplanation
    Command-->>Panel: explanation ready
```

The translation is shown as soon as it arrives; the explanation never blocks it. The translator and
the explainer are separate warm helper processes, so a slow explanation cannot delay a later
translation.

## Type a phrase

```mermaid
sequenceDiagram
    actor Learner
    participant Panel as TranslationPanel
    participant Commands as submitDraft
    participant Command as lookupCommandAtom

    Learner->>Panel: opens "Translate a phrase", types, presses Enter
    Panel->>Commands: submitDraft
    alt empty, non-English or over the bound
        Commands-->>Panel: invalid_request, "Enter an English word or a short phrase (up to 8 words)."
    else valid
        Commands->>Command: stage translation (context only when it matches the selection)
        Command-->>Panel: translating, then translated
    end
    Learner->>Panel: Escape or Close
    Panel->>Commands: closePanel
    Commands->>Command: Atom.Interrupt, state reset
```

## Stale results

`lookupCommandAtom` is a `runtime.fn`: starting a lookup interrupts the previous one, and so does
`Atom.Interrupt` from closing the panel, editing the text, or preparing languages. An interrupted
lookup cannot write its result, so a slow older translation or explanation never replaces a newer
selection. The behaviour tests cover both stages.

## Failures

```mermaid
sequenceDiagram
    participant Command as lookupCommandAtom
    participant Rust as translate_text / explain_text
    participant Panel as TranslationPanel
    actor Learner

    Command->>Rust: translate
    alt download_required
        Rust-->>Panel: error with recovery copy
        Panel-->>Learner: "Prepare languages" button
        Learner->>Panel: Prepare languages
        Panel->>Panel: prepare_translation_languages, then notice, then Translate again
    else invalid_request
        Rust-->>Panel: error, no retry offered
    else other IpcError or undecodable answer
        Rust-->>Panel: error with recovery copy
        Panel-->>Learner: Retry
    end
    Command->>Rust: explain
    alt explanation fails
        Rust-->>Panel: translation stays, "Retry English explanation"
        Learner->>Command: retryExplanation (explain stage only)
    end
```

## Rust side

`translate_text` validates the text (the same rules as `normalizePhrase`), reads the native
language, records a cue exposure for the open session and sends one line to the warm translate
helper. `explain_text` does the same without the cue exposure and uses the explain helper. Both
helpers start lazily, are warmed at app start (`TranslationService::warm_up`), and are replaced after
a crash or a timeout. Status checks and language preparation still use a one-shot helper process.
