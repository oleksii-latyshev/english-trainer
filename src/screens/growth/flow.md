# Growth screen flow

`/growth` explains and shows how far Eva has grown. The sidebar growth card opens it; there is no
navigation entry of its own. The screen only composes the `eva-growth` feature; the numbers come from
`core/eva-growth`.

```
GrowthScreen
  StageStrip    six stages, "You are here"
  HowItGrows    drops, sunshine, days off
  TodayCard     Eva at her stage (asleep while napping), progress and today's gains
```

```mermaid
sequenceDiagram
    actor Learner
    participant Card as Sidebar GrowthCard
    participant Shell as AppShell
    participant Router
    participant Screen as GrowthScreen

    Learner->>Card: click
    Card->>Shell: onOpenGrowth
    alt navigation locked (recording or reply running)
        Shell-->>Learner: nothing happens, the card is disabled
    else free
        Shell->>Router: navigate("/growth")
        Router->>Screen: render StageStrip, HowItGrows, TodayCard
    end
    Learner->>Shell: picks Talk, Memory or Settings
    Shell->>Router: navigate away
```
