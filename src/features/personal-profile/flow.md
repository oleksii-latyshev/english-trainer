# About you

The Settings row "About you": a name (40 characters), role, stack, interests and goals (150 characters each, all optional).
Rust feeds the saved profile, without the name, into Eva's prompts and into the speech glossary; the
UI only reads and edits it. The Start greeting reads the trimmed name through `learnerNameAtom`.

## Read the profile

```mermaid
sequenceDiagram
    actor Learner
    participant Component as AboutYou
    participant Atoms as personalProfileAtom
    participant Service as PersonalProfileService
    participant Ipc
    participant Command as get_personal_profile
    participant Rust as PersonalProfileService (Rust)
    participant Store as SessionProfileStore

    Learner->>Component: opens Settings
    Component->>Atoms: useAtomValue
    Atoms->>Service: get
    Service->>Ipc: invoke("get_personal_profile")
    Ipc->>Command: IPC
    Command->>Rust: get() on a blocking thread
    Rust->>Store: load()
    alt database unreadable
        Store-->>Rust: PersonalProfileError::Storage
        Command-->>Ipc: IpcError database_error
        Atoms-->>Component: "Your profile could not be loaded" + Retry
    else
        Store-->>Rust: PersonalProfile (empty when nothing is saved)
        Atoms-->>Component: the summary "Backend engineer · Rust · ..."
    end
```

## Edit and save

```mermaid
sequenceDiagram
    actor Learner
    participant Component as AboutYou / ProfileForm
    participant Atoms as profileDraftAtom / savePersonalProfileAtom
    participant Service as PersonalProfileService
    participant Ipc
    participant Command as save_personal_profile
    participant Rust as PersonalProfileService (Rust)
    participant Store as SessionProfileStore

    Learner->>Component: clicks Edit
    Component->>Atoms: draft = saved profile
    Learner->>Component: types, clicks Save profile
    Component->>Atoms: save(draft)
    alt a field is over its limit (name 40, others 150)
        Atoms-->>Component: ProfileTooLong, "Name must be 40 characters or fewer." (Rust is not called)
    else
        Atoms->>Service: save(draft)
        Service->>Ipc: invoke("save_personal_profile", { profile })
        Ipc->>Command: IPC
        Command->>Rust: save(profile) on a blocking thread
        Rust->>Rust: trim every field, check the limit
        alt over the limit or database error
            Command-->>Ipc: IpcError invalid_request / database_error
            Atoms-->>Component: alert, the draft stays open
        else saved
            Rust->>Store: save(profile)
            Command-->>Atoms: trimmed PersonalProfile
            Atoms->>Atoms: draft = none, reactivity key refreshes personalProfileAtom
            Atoms-->>Component: the form closes, the summary shows the saved profile
        end
    end
    Learner->>Component: clicks Cancel
    Component->>Atoms: draft = none
```
