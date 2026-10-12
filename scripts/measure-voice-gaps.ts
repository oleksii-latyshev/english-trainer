import { readFileSync } from 'node:fs';
import { loadavg } from 'node:os';
import { runAheadModel } from './voice-gaps/after-model';
import { openHelper, type TrimSettings } from './voice-gaps/helper-client';
import { runPreviousPipelineModel } from './voice-gaps/previous-pipeline-model';
import { type ReplyRun, summarize } from './voice-gaps/report';

const DEFAULT_DIRECTORY = `${import.meta.dir}/../src-tauri/binaries/natural-voice`;
const WARMUP_LINES = ['Hi!', 'That sounds like a useful approach.', 'What would you try first?'];
const PREVIOUS_TRIM: TrimSettings = { threshold: 0.0002, beforeMs: 50, afterMs: 120 };
const CURRENT_TRIM: TrimSettings = { threshold: 0.003, beforeMs: 40, afterMs: 50 };

function flag(name: string, fallback: string): string {
  const index = Bun.argv.indexOf(name);
  return index >= 0 ? (Bun.argv[index + 1] ?? fallback) : fallback;
}

async function main() {
  const replies: string[] = JSON.parse(readFileSync(flag('--replies', ''), 'utf8'));
  const rounds = Number(flag('--rounds', '1'));
  const helper = await openHelper(flag('--directory', DEFAULT_DIRECTORY));
  for (const line of WARMUP_LINES) await helper.synthesize(line, 0, 1);
  const startLoad = loadavg()[0];
  const previous: ReplyRun[] = [];
  const ahead: ReplyRun[] = [];
  for (let round = 0; round < rounds; round += 1) {
    for (const reply of replies) {
      previous.push(await runPreviousPipelineModel(helper, reply, 0, 1, PREVIOUS_TRIM));
      ahead.push(await runAheadModel(helper, reply, 0, 1, CURRENT_TRIM));
    }
  }
  helper.close();
  process.stdout.write(
    `${JSON.stringify(
      {
        loadAverage: [startLoad, loadavg()[0]],
        previous: summarize(previous),
        ahead: summarize(ahead),
      },
      null,
      2,
    )}\n`,
  );
}

await main();
