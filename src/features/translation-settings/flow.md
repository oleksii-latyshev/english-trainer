# Translation settings (UI)

The Settings group "Translation": the native-language select and the language-availability row with
"Prepare languages". State, IPC and the sequence diagrams for reading, changing and preparing live in
`core/translation-settings` (see its `flow.md`); this feature only renders them.

```mermaid
sequenceDiagram
    actor Learner
    participant Group as TranslationSettings
    participant Core as core/translation-settings atoms

    Learner->>Group: opens Settings
    Group->>Core: nativeLanguageAtom
    alt still loading
        Group-->>Learner: "Loading translation settings…"
    else failed
        Group-->>Learner: "Translation settings could not be loaded" + Retry (refreshes the atom)
    else loaded
        Group->>Core: translationAvailabilityAtom
        Group-->>Learner: select with the language, availability row
    end
    Learner->>Group: picks another language
    Group->>Core: setNativeLanguageAtom(code)
    Core-->>Group: waiting, select and Prepare disabled
    Core-->>Group: failure shown as an alert, or the new language
    Learner->>Group: clicks Prepare languages
    Group->>Core: prepareTranslationLanguagesAtom
    Core-->>Group: "Preparing…", then the refreshed availability or an alert
```

Availability is shown for the selected language only: a status reported for another language reads
"Checking language availability…" until the refreshed one arrives (`availabilityCopy`).
