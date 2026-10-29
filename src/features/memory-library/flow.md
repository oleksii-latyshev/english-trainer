# Memory library flow

The list and details under the cards on the Memory screen: saved phrases, what conversations
showed about each one, and archive and delete. Mistakes live in the Mistakes section (`core/mistakes`).

```text
MemorySearch            search field in the screen header (searchQueryAtom)
StatusSummary           "Where they are": counts of New, Learning, Improving, Stable
LibraryList             "Show archived", the phrase list
  MemoryRow             wording, source, status, next review, "On your own" count
    EntryDetail         next review, gap, kind, explanation, EvidenceList, Say it now, Archive, Delete
DeleteMemoryDialog      asks before a delete
```

Rust sorts the list by next review. Archived items are hidden unless "Show archived" is on.

## Show and search

```mermaid
sequenceDiagram
    actor Learner
    participant List as LibraryList
    participant Core as openedLearningMemoryAtom (core/learning-memory)
    participant Atoms as libraryAtom / shownEntriesAtom
    participant Rust as view_learning_memory

    Learner->>List: opens Memory
    List->>Core: useAtomValue
    Core->>Rust: view_learning_memory
    alt unreadable
        Rust-->>List: failure
        List-->>Learner: "Could not load Memory" + Try again
    else read
        Rust-->>Atoms: phrases
        Atoms-->>List: entries (archived hidden), filtered by the search text
    end
    Learner->>List: types in the search field
    List->>Atoms: searchQueryAtom
    Atoms-->>List: matching entries, or "Nothing matches"
```

## Open a row

Opening a row shows the details and loads the evidence for that one item from Rust
(`memoryUsageEvidenceAtom`, see `core/learning-memory/flow.md`). Selecting text in a row does not
toggle it, so a word can be translated (`data-word-lookup`).

The kind comes from Rust: a phrase card carries `kind` (computed on read, never stored). Each evidence event is tagged by its outcome: `correct` is "On your own",
`with_help` is "With help" (the answer used help, or the item was cued first), `incorrect` is
"Slipped back". `uncertain` events are not listed. Only "On your own" feeds the count in the row.

## Say it now

```mermaid
sequenceDiagram
    actor Learner
    participant Detail as EntryDetail
    participant Screen as MemoryScreen (sayNow prop)
    participant Route as MemoryRoute
    participant Review as spoken-review (beginItem)

    Learner->>Detail: Say it now (not shown for archived items, disabled while the microphone is busy)
    Detail->>Screen: onSay(item type, id)
    Screen->>Route: onSayNow
    Route->>Review: beginItem(item), navigate /memory/review
    Review-->>Learner: a one-item spoken review, then "Back to Memory"
```

The feature never imports the review: the route composes the two.

## Archive and delete

```mermaid
sequenceDiagram
    actor Learner
    participant Detail as EntryDetail
    participant Atom as archiveEntryAtom / confirmDeleteAtom
    participant Service as LearningMemoryService
    participant Rust as archive_learning_item / delete_phrase_card
    participant Toast

    Learner->>Detail: Archive
    Detail->>Atom: archive(entry)
    Atom->>Service: archive(item type, id)
    Service->>Rust: invoke
    alt failed
        Atom->>Toast: "Could not archive that. Please try again."
    else archived
        Atom->>Toast: "Archived. Saving it again brings it back."
        Atom-->>Detail: LEARNING_MEMORY invalidated, the list reloads
    end
    Learner->>Detail: Delete
    Detail->>Atom: pendingDeleteAtom = entry
    Learner->>DeleteMemoryDialog: Delete (or Cancel)
    DeleteMemoryDialog->>Atom: confirmDeleteAtom
    Atom->>Rust: delete (its evidence goes with it)
    Atom->>Toast: "Removed from Memory", dialog closes
```
