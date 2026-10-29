# Mistakes screen

Layout for `/mistakes` and `/mistakes/:mistakeId`. Logic lives in `features/mistake-library`; the
route (`src/app/routes/mistakes`) passes navigation and the F12 start.

```text
MistakesScreen      header (title, OverviewLine, PracticeActions) + MistakeGroups
MistakeCardScreen   MistakeCard (back to the list, archive returns to the list)
```

```mermaid
sequenceDiagram
    actor Learner
    participant Shell as Sidebar
    participant Route as MistakesRoute
    participant Screen as MistakesScreen
    participant Feature as mistake-library

    Learner->>Shell: Mistakes (badge shows the due count)
    Shell->>Route: /mistakes
    Route->>Screen: Talk it through state, onOpenMistake
    Screen->>Feature: composes overview, actions, groups
    Learner->>Feature: opens a mistake
    Feature->>Route: onOpenMistake(id), navigate /mistakes/:id
```
