export const FIRST_PHRASE_MAX_CHARS = 40;
export const MIN_PHRASE_CHARS = 24;
export const MIN_TRAILING_CHARS = 16;
export const LATER_PHRASE_MAX_CHARS = 120;
export const CLAUSE_OVERRUN_CHARS = 24;
export const PHRASE_BUDGET_FLOOR_CHARS = 32;

export const FIRST_PHRASE_GUARD_MS = 800;
export const LATER_PHRASE_GUARD_MARGIN_MS = 400;
export const RENDER_AHEAD_TARGET_MS = 6000;
export const LEAD_SHARE_FOR_SYNTHESIS = 0.5;

export const FIRST_AUDIO_START_TIMEOUT_MS = 1500;
export const SENTENCE_PAUSE_MS = 150;
export const BUSY_RETRY_MS = 40;
export const CLOCK_POLL_MS = 20;

export const INITIAL_SYNTHESIS_ESTIMATE = { fixedMs: 250, perCharMs: 11 } as const;
export const ESTIMATE_SMOOTHING = 0.4;
export const MIN_PER_CHAR_MS = 4;
export const MAX_PER_CHAR_MS = 40;
