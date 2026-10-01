import { describe, expect, it } from 'bun:test';
import {
  isMemoryUsageEvidence,
  isTurnUsageAssessment,
  isUsageAssessmentFinding,
  isUsageEventRecord,
  isUsageOutcome,
} from './usageTypes';

const validFinding = {
  item_type: 'mistake',
  item_id: 10,
  target: 'work there',
  outcome: 'correct',
  confidence: 0.95,
  exact_excerpt: 'work there now',
  credited: true,
  status_after: 'learning',
};

const validAssessment = {
  session_id: 5,
  sequence: 1,
  assessed_at: 1727784000000,
  findings: [validFinding],
};

const validEvent = {
  id: 1,
  item_type: 'phrase',
  item_id: 20,
  session_id: 5,
  sequence: 2,
  origin: 'assessment',
  original_turn_time: 1727784000000,
  outcome: 'correct',
  exact_excerpt: 'the main trade off',
  confidence: 0.92,
  created_at: 1727784000000,
};

const validEvidence = {
  item_type: 'phrase',
  item_id: 20,
  distinct_session_count: 2,
  streak: 2,
  events: [validEvent],
};

describe('usage review IPC unknown payload guards', () => {
  it('validates outcomes strictly', () => {
    expect(isUsageOutcome('correct')).toBe(true);
    expect(isUsageOutcome('incorrect')).toBe(true);
    expect(isUsageOutcome('uncertain')).toBe(true);
    expect(isUsageOutcome('partial')).toBe(false);
    expect(isUsageOutcome('')).toBe(false);
    expect(isUsageOutcome(null)).toBe(false);
  });

  it('validates usage assessment finding', () => {
    expect(isUsageAssessmentFinding(validFinding)).toBe(true);
    expect(isUsageAssessmentFinding({ ...validFinding, item_id: 0 })).toBe(false);
    expect(
      isUsageAssessmentFinding({ ...validFinding, item_id: Number.MAX_SAFE_INTEGER + 1 }),
    ).toBe(false);
    expect(isUsageAssessmentFinding({ ...validFinding, confidence: 1.5 })).toBe(false);
    expect(isUsageAssessmentFinding({ ...validFinding, confidence: Number.NaN })).toBe(false);
    expect(isUsageAssessmentFinding({ ...validFinding, status_after: 'unknown' })).toBe(false);
    expect(
      isUsageAssessmentFinding({ ...validFinding, outcome: 'uncertain', credited: true }),
    ).toBe(false);
    expect(isUsageAssessmentFinding({ ...validFinding, confidence: 0.89 })).toBe(false);
    expect(isUsageAssessmentFinding({ ...validFinding, target: '😀'.repeat(301) })).toBe(false);
    expect(isUsageAssessmentFinding({ ...validFinding, exact_excerpt: '😀'.repeat(501) })).toBe(
      false,
    );
  });

  it('validates turn usage assessment and sequence constraint <= 2', () => {
    expect(isTurnUsageAssessment(validAssessment)).toBe(true);
    expect(isTurnUsageAssessment({ ...validAssessment, sequence: 2 })).toBe(true);
    expect(isTurnUsageAssessment({ ...validAssessment, sequence: 3 })).toBe(false);
    expect(isTurnUsageAssessment({ ...validAssessment, session_id: 0 })).toBe(false);
    expect(isTurnUsageAssessment({ ...validAssessment, findings: 'invalid' })).toBe(false);
    expect(
      isTurnUsageAssessment({
        ...validAssessment,
        findings: [validFinding, { ...validFinding }],
      }),
    ).toBe(false);
    expect(
      isTurnUsageAssessment({
        ...validAssessment,
        findings: [
          validFinding,
          { ...validFinding, item_type: 'phrase', item_id: 11 },
          { ...validFinding, item_id: 12 },
          { ...validFinding, item_id: 13 },
        ],
      }),
    ).toBe(false);
  });

  it('validates usage event record', () => {
    expect(isUsageEventRecord(validEvent)).toBe(true);
    expect(isUsageEventRecord({ ...validEvent, id: 0 })).toBe(false);
    expect(isUsageEventRecord({ ...validEvent, exact_excerpt: 'a'.repeat(501) })).toBe(false);
    expect(isUsageEventRecord({ ...validEvent, confidence: -0.1 })).toBe(false);
    expect(
      isUsageEventRecord({
        ...validEvent,
        item_type: 'mistake',
        origin: 'feedback',
        outcome: 'incorrect',
        sequence: 8,
      }),
    ).toBe(true);
    expect(isUsageEventRecord({ ...validEvent, origin: 'assessment', sequence: 8 })).toBe(false);
    expect(isUsageEventRecord({ ...validEvent, origin: 'unknown' })).toBe(false);
    expect(
      isUsageEventRecord({ ...validEvent, origin: 'feedback', item_type: 'phrase', sequence: 8 }),
    ).toBe(false);
    expect(
      isUsageEventRecord({
        ...validEvent,
        origin: 'feedback',
        item_type: 'mistake',
        outcome: 'correct',
        sequence: 8,
      }),
    ).toBe(false);
    expect(isUsageEventRecord({ ...validEvent, id: Number.MAX_SAFE_INTEGER + 1 })).toBe(false);
    expect(isUsageEventRecord({ ...validEvent, exact_excerpt: '😀'.repeat(501) })).toBe(false);
  });

  it('checks saved review identity against the requested turn', () => {
    expect(isTurnUsageAssessment(validAssessment, { sessionId: 5, sequence: 1 })).toBe(true);
    expect(isTurnUsageAssessment(validAssessment, { sessionId: 6, sequence: 1 })).toBe(false);
    expect(isTurnUsageAssessment(validAssessment, { sessionId: 5, sequence: 2 })).toBe(false);
  });

  it('validates memory usage evidence and event cap <= 5', () => {
    expect(isMemoryUsageEvidence(validEvidence)).toBe(true);
    expect(isMemoryUsageEvidence({ ...validEvidence, distinct_session_count: -1 })).toBe(false);
    expect(isMemoryUsageEvidence({ ...validEvidence, streak: -1 })).toBe(false);
    expect(isMemoryUsageEvidence(validEvidence, { itemType: 'phrase', itemId: 21 })).toBe(false);
    expect(
      isMemoryUsageEvidence({ ...validEvidence, events: [{ ...validEvent, item_id: 21 }] }),
    ).toBe(false);
    expect(
      isMemoryUsageEvidence({
        ...validEvidence,
        events: [validEvent, { ...validEvent, sequence: 1 }],
      }),
    ).toBe(false);
    const sixEvents = [validEvent, validEvent, validEvent, validEvent, validEvent, validEvent];
    expect(isMemoryUsageEvidence({ ...validEvidence, events: sixEvents })).toBe(false);
  });
});
