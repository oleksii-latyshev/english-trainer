# Rust backend architecture

How `src-tauri/src/` is organised. Rust owns sessions, providers, persistence, metrics and learning
decisions ([`ARCHITECTURE.md`](../ARCHITECTURE.md)); this document is about *how* that code is
shaped. There is no Effect for Rust and we do not need one: the language already gives typed
errors (`Result`), explicit dependencies (traits + constructors) and guaranteed cleanup (`Drop`).
The same ideas as the frontend apply — vertical slices, one-way dependencies, errors as data.

## 1. Vertical slices, layered inside

Each bounded context is a module folder. Inside it, code is split by **layer**, the same way a
frontend feature is split into `helpers / services / model / components`:

```text
src-tauri/src/
  lib.rs                 builder only: plugins, managed state, the invoke_handler list
  core/                  cross-cutting infrastructure used by every context
    ipc_error.rs         IpcError { code, message } — the only error type that crosses invoke()
    db.rs                SQLite connection, migrations entry point
    process.rs           bounded child-process runner (timeouts, private temp dirs)
    clock.rs             Clock trait (real + fake) so time-dependent rules are testable
  <context>/             conversation, learning, speech, translation, gemini_key, setup, …
    mod.rs               public surface: re-exports only what other contexts and commands use
    domain.rs | domain/  types and rules; pure — no I/O, no tauri, no rusqlite, no reqwest
    ports.rs             traits the service needs (repositories, engines, clocks)
    service.rs           use cases: orchestrates domain rules through ports
    infra/               adapters implementing the ports (sqlite.rs, gemini.rs, apple.rs, …)
    commands.rs          #[tauri::command] functions — thin: args → service → IpcError
    error.rs             this context's error enum (thiserror)
    tests/ or *_tests.rs tests beside the code they cover
```

Dependency direction inside a context: `commands → service → domain`, `service → ports`,
`infra → ports + domain`. `domain` depends on nothing but `std`, `serde` and other contexts'
`domain`. Contexts talk to each other through the other context's `mod.rs` surface, never its
internals. A context that grows past ~10 files splits into sub-contexts, not into `utils.rs`.

Why: today `conversation::SessionStore` is one ~700-line `impl` holding the database, five
`Arc<Mutex|AtomicBool>` flags, provider calls and validation, and `ProviderError` is used for
database failures and the Dock icon. Slicing by context and layering inside makes each rule testable
without SQLite or a provider, and keeps commands from reaching into state.

## 2. Commands

```rust
#[tauri::command]
pub async fn save_gemini_api_key(
    service: tauri::State<'_, GeminiKeyService>,
    key: String,
) -> Result<(), IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.save(&key))
        .await
        .map_err(IpcError::task_failed("Could not save the Gemini API key."))?
        .map_err(IpcError::from)
}
```

- A command parses arguments, calls **one** service method, and maps the error. No SQL, no
  provider calls, no business rules.
- Commands live in their context's `commands.rs`; `lib.rs` only lists them in `generate_handler!`.
- Blocking work (SQLite, child processes, blocking HTTP) runs in `spawn_blocking`; a lock is never
  held across a provider call or a process wait.
- Managed state is a service struct that is cheap to clone (`Arc` inside), registered with
  `app.manage(...)` in `lib.rs`.

## 3. Errors

- Each context defines its own error enum with `thiserror`. Variants carry the data needed to
  recover; `#[from]` wraps lower-level errors; no `String`-only "other" variant.
- Exactly one error type crosses `invoke()`: `core::IpcError { code: IpcErrorCode, message: String }`.
  Every context error implements `From<ContextError> for IpcError`, choosing a code and a learner-
  facing message that says what failed and how to recover. Internal details (paths, SQL) go to the
  log, not the message.
- `IpcErrorCode` is a closed `snake_case` enum exported to TypeScript; the UI branches on it.
- No `unwrap()` / `expect()` / `panic!` outside tests. Invalid provider output is a recoverable
  error, never a panic or a partially accepted learning result.
- No `let _ = …` on a `Result`: call a named helper that states why the failure is harmless
  (`ignore_closed_ui_channel(result)`).
- No comments, including `///` and `//!` doc comments; names, types and tests document the code
  (CODE_REQUIREMENTS › Principles).

## 4. IPC types: ts-rs

Every type that crosses `invoke()` or a `Channel` derives `ts_rs::TS` and is exported:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum KeySource { Settings, Environment }
```

- `.cargo/config.toml` at the repository root sets `TS_RS_EXPORT_DIR` to `src/core/ipc/bindings` and
  `TS_RS_LARGE_INT = "number"` (JSON numbers, not `bigint`; IDs stay below 2^53, enforced by
  `MAX_SAFE_SESSION_ID`). Cargo reads this file from the working directory upwards, which is why it
  is at the root and not in `src-tauri/`: `cargo ... --manifest-path src-tauri/Cargo.toml` run from
  the root would not see `src-tauri/.cargo`.
- `cargo test` regenerates the bindings. `scripts/check-rust.sh` (local `verify`, Lefthook and CI)
  fails if `src/core/ipc/bindings` has unstaged changes or untracked files afterwards, so a Rust
  change without its TypeScript counterpart cannot merge.
- A binding is a plain struct or enum, so the paired Schema is one too. `GeminiKeyStatus` is
  `{ configured: boolean, source: KeySource | null }`, not a union of two shapes; a Rust enum with
  `#[serde(tag = "...")]` is how a discriminated union crosses IPC.
- Serde attributes (`rename_all`, `tag`, `skip_serializing_if`) are honoured by ts-rs; keep fields
  `snake_case` on both sides.
- The TypeScript side pairs each binding with an Effect Schema (`EFFECT.md` §4).

## 5. Concurrency and state

- Providers run on plain threads without a Tauri handle. A context they depend on exposes free
  functions in its `mod.rs` (`gemini_key::resolve_key`, `gemini_key::forget_cached_key`) backed by
  the service that `lib.rs` installs once at startup and also manages as Tauri state for commands.

- Shared mutable state lives in one place per context, behind `Mutex` inside the service; flags
  that guard "one at a time" work are typed guards (`InFlight` with an RAII release), not bare
  `AtomicBool`s scattered across a struct.
- Background queues (coaching, wrap-up, review material) are owned by their context's service and
  expose `start`, `enqueue` and `shutdown`; they emit Tauri events through a port so tests can
  observe them.
- Time comes from `core::Clock`; tests use the fake clock instead of sleeping.

## 6. Lints and formatting

- `rustfmt` defaults.
- `Cargo.toml [lints.clippy]` denies `unwrap_used`, `expect_used` and `panic` for the whole crate;
  `clippy.toml` exempts `#[test]` functions and `#[cfg(test)]` modules. Return an error instead (a
  poisoned mutex becomes an error value). A scoped `#[allow(clippy::expect_used, reason = "...")]`
  is only for failure that cannot be handled, such as the Tauri builder in `run()`; the reason is
  mandatory. Integration tests in `tests/` and `build.rs` carry a file-level `#![allow]` with its reason.
- CI runs `cargo clippy --all-targets -- -D warnings`.

## 7. Tests

| What | Where |
| :--- | :--- |
| Domain rules | `#[cfg(test)] mod tests` in the domain file — no I/O |
| Services | tests with fake ports (in-memory repository, fake engine, fake clock) |
| SQLite adapters | tests against a temporary database |
| Pipeline | `src-tauri/tests/pipeline.rs` |

No mocks of code we own: fakes implement our ports. Provider CLIs are faked at the process edge
(`ENG_TRAINER_AGY_BIN`).
