# Eva growth flow

The sidebar growth card and the three parts of the Growth screen: the stage strip, "How Eva grows"
and "Today". The numbers come from Rust (`get_eva_growth`) through `core/eva-growth`; the feature only
words them. Nothing wilts, there are no streaks and no guilt copy: a nap is a mood, not a penalty.

## Read the card

```mermaid
sequenceDiagram
    actor Learner
    participant Sidebar as app shell Sidebar
    participant Card as GrowthCard
    participant Pref as growthPreferenceAtom
    participant Known as knownGrowthAtom
    participant Copy as stageProgress
    participant Route as /growth

    Sidebar->>Card: render under the navigation
    Card->>Pref: showGrowth?
    alt Show growth is off
        Pref-->>Card: false
        Card-->>Sidebar: nothing (progress is still kept in Rust)
    else on, growth not read yet
        Known-->>Card: null
        Card-->>Sidebar: nothing
    else on
        Known-->>Card: EvaGrowthSnapshot
        Card->>Copy: numbers within the stage
        Copy-->>Card: "Bud", "5 / 40 drops", "35 drops to Bloom" (full bloom: "In full bloom")
        Card-->>Sidebar: stage, bar and line
    end
    Learner->>Card: click
    Card->>Route: shell navigates to /growth
```

## Show the Growth screen

```mermaid
sequenceDiagram
    actor Learner
    participant Screen as GrowthScreen
    participant Strip as StageStrip
    participant Today as TodayCard
    participant Known as knownGrowthAtom
    participant Result as evaGrowthAtom

    Learner->>Screen: opens /growth
    Screen->>Strip: six stages, "You are here" on the current one
    Screen->>Today: Eva at her stage (asleep while napping), progress, today's gains
    Today->>Known: last snapshot
    alt never loaded and the read failed
        Result-->>Today: failure
        Today-->>Learner: "could not be loaded" + Retry
        Learner->>Today: Retry
        Today->>Result: refresh
    else snapshot
        Known-->>Today: drops, floor, next threshold, napping, today's gains
        Today-->>Learner: "+12 12 min about <topic>", "+5 Said “<phrase>” on your own" or the empty line
    end
```
