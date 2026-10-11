import { $ } from 'bun';

type Label = { name: string; color: string; description: string };
type Milestone = { title: string; description: string };

const REPO = 'oleksii-latyshev/english-trainer';
const AREA_COLOR = 'BFD4F2';

const LABELS: Label[] = [
  { name: 'type:feat', color: '1D76DB', description: 'New capability' },
  { name: 'type:fix', color: 'D73A4A', description: 'Bug fix' },
  { name: 'type:perf', color: 'F59E0B', description: 'Performance work' },
  { name: 'type:refactor', color: '7C8794', description: 'No behaviour change' },
  { name: 'type:chore', color: '586069', description: 'Tooling, deps, config' },
  { name: 'type:docs', color: '0E8A16', description: 'Docs only' },
  { name: 'type:test', color: '5319E7', description: 'Tests only' },
  { name: 'area:talk', color: AREA_COLOR, description: 'Talk screen, practice session, dialogue' },
  { name: 'area:speech', color: AREA_COLOR, description: 'Microphone, Whisper STT, voice output' },
  {
    name: 'area:coaching',
    color: AREA_COLOR,
    description: 'Coaching notes, help, rescue, wrap-up',
  },
  { name: 'area:memory', color: AREA_COLOR, description: 'Learning Memory, review, scheduling' },
  { name: 'area:translation', color: AREA_COLOR, description: 'On-device word translation' },
  { name: 'area:settings', color: AREA_COLOR, description: 'Settings and first run' },
  { name: 'area:ui', color: AREA_COLOR, description: 'UI kit, design tokens, layout' },
  { name: 'area:core', color: AREA_COLOR, description: 'IPC, runtime, shared frontend core' },
  { name: 'area:rust', color: AREA_COLOR, description: 'Rust contexts, providers, persistence' },
  { name: 'area:ci', color: AREA_COLOR, description: 'CI, release, repository tooling' },
  { name: 'area:docs', color: AREA_COLOR, description: 'Documentation' },
  {
    name: 'priority:p0',
    color: 'B60205',
    description: 'Breaks a promise the product already makes',
  },
  { name: 'priority:p1', color: 'D93F0B', description: 'Next' },
  { name: 'priority:p2', color: 'FBCA04', description: 'Wanted' },
  { name: 'priority:p3', color: 'C2E0C6', description: 'Nice to have' },
  { name: 'size:xs', color: 'EDEDED', description: 'Under an hour' },
  { name: 'size:s', color: 'EDEDED', description: 'One session' },
  { name: 'size:m', color: 'EDEDED', description: 'Two or three sessions' },
  { name: 'size:l', color: 'EDEDED', description: 'Four or more sessions' },
  { name: 'size:xl', color: 'EDEDED', description: 'Epic: split into child issues first' },
  { name: 'blocked', color: '000000', description: 'Waiting on something outside this issue' },
  { name: 'needs-decision', color: 'D876E3', description: 'Needs the owner to decide' },
];

const MILESTONES: Milestone[] = [
  {
    title: 'MVP',
    description: 'Built features waiting for the physical-Mac check, and fixes found in it',
  },
  { title: 'Architecture migration', description: 'docs/engineering/MIGRATION.md steps' },
  { title: 'After MVP', description: 'ROADMAP: After the MVP' },
];

async function upsertLabel(label: Label): Promise<void> {
  await $`gh label create ${label.name} --repo ${REPO} --color ${label.color} --description ${label.description} --force`.quiet();
}

async function existingMilestones(): Promise<string[]> {
  return (await $`gh api repos/${REPO}/milestones?state=all --jq .[].title`.text()).split('\n');
}

async function createMissingMilestone(milestone: Milestone, existing: string[]): Promise<void> {
  if (existing.includes(milestone.title)) return;
  await $`gh api repos/${REPO}/milestones -f title=${milestone.title} -f description=${milestone.description}`.quiet();
}

for (const label of LABELS) await upsertLabel(label);
const existing = await existingMilestones();
for (const milestone of MILESTONES) await createMissingMilestone(milestone, existing);
process.stdout.write(`${LABELS.length} labels and ${MILESTONES.length} milestones are in place\n`);
