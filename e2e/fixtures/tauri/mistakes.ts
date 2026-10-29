import type { Page } from '@playwright/test';
import type { MistakeDetail } from '@/core/ipc/bindings/MistakeDetail';
import type { MistakeGroups } from '@/core/ipc/bindings/MistakeGroups';
import type { RuleCardView } from '@/core/ipc/bindings/RuleCardView';
import {
  agreementMistake,
  emptyMistakeGroups,
  mistakeDetail,
  mistakeGroups,
  perfectMistake,
  ruleCard,
  unsortedMistake,
} from '../../data/mistakes';

type MistakesSeed = {
  groups: MistakeGroups;
  details: MistakeDetail[];
  rule: RuleCardView;
};

declare global {
  interface Window {
    __ET_MISTAKES__: { land(id: number): void };
  }
}

export class MistakesBackend {
  private groups: MistakeGroups = emptyMistakeGroups;
  private extraDetails: MistakeDetail[] = [];

  constructor(private readonly page: Page) {}

  withGroups(): this {
    this.groups = mistakeGroups;
    return this;
  }

  withUniversityQuestion(): this {
    const mistake = {
      ...perfectMistake,
      id: 5,
      said: 'in the university',
      corrected: 'at university',
    };
    this.groups = {
      groups: [{ ...mistakeGroups.groups[0], mistakes: [mistake] }],
      ungrouped: [],
      due_count: 1,
    };
    this.extraDetails = [
      {
        ...mistakeDetail(mistake),
        question: 'What did you enjoy about studying at university?',
      },
    ];
    return this;
  }

  async land(id: number): Promise<void> {
    await this.page.evaluate((mistakeId) => window.__ET_MISTAKES__.land(mistakeId), id);
  }

  async install(): Promise<void> {
    const seed: MistakesSeed = {
      groups: this.groups,
      details: [
        ...[perfectMistake, agreementMistake, unsortedMistake].map(mistakeDetail),
        ...this.extraDetails,
      ],
      rule: ruleCard,
    };
    await this.page.addInitScript((state: MistakesSeed) => {
      const harness = window.__ET_HARNESS__;
      const internals = window.__TAURI_INTERNALS__;
      const originalInvoke = internals.invoke;
      const originalTransform = internals.transformCallback;
      const listeners = new Map<number, (payload: unknown) => void>();
      internals.transformCallback = (callback, once) => {
        const id = originalTransform(callback, once);
        listeners.set(id, callback);
        return id;
      };
      const groups = structuredClone(state.groups);
      const details = structuredClone(state.details);

      function recount(): void {
        groups.due_count = [
          ...groups.groups.flatMap((group) => group.mistakes),
          ...groups.ungrouped,
        ].filter((mistake) => mistake.is_due).length;
      }
      function setLesson(id: number, lessonState: 'pending' | 'ready' | 'failed'): void {
        const detail = details.find((item) => item.id === id);
        if (detail) {
          detail.lesson_state = lessonState;
          if (lessonState === 'ready') {
            detail.lesson = {
              explanation: 'Present Perfect links the past to now.',
              contrast: [{ label: 'Up to now', sentence: 'I have worked there since 2020.' }],
              examples: ['We have been fixing this bug since Monday.'],
              word: null,
            };
          }
        }
        for (const mistake of [
          ...groups.groups.flatMap((group) => group.mistakes),
          ...groups.ungrouped,
        ]) {
          if (mistake.id === id) mistake.lesson_state = lessonState;
        }
      }
      function archive(id: number): void {
        for (const group of groups.groups) {
          const before = group.mistakes.length;
          group.mistakes = group.mistakes.filter((mistake) => mistake.id !== id);
          if (group.mistakes.length < before) group.mistake_count -= 1;
        }
        groups.groups = groups.groups.filter((group) => group.mistake_count > 0);
        groups.ungrouped = groups.ungrouped.filter((mistake) => mistake.id !== id);
        recount();
      }
      window.__ET_MISTAKES__ = {
        land: (id) => {
          setLesson(id, 'ready');
          for (const callback of listeners.values()) {
            callback({ event: 'mistakes-updated', id: 1, payload: { lessons_ready: 1 } });
          }
        },
      };
      internals.invoke = async (command, args = {}) => {
        switch (command) {
          case 'list_mistake_groups':
            harness.calls.push({ command, args });
            return groups;
          case 'get_mistake': {
            harness.calls.push({ command, args });
            const found = details.find((item) => item.id === args.id);
            if (!found) throw { code: 'not_found', message: 'Could not read that mistake.' };
            return found;
          }
          case 'get_rule_card':
            harness.calls.push({ command, args });
            return state.rule;
          case 'archive_mistake':
            harness.calls.push({ command, args });
            archive(Number(args.id));
            return null;
          case 'retry_mistake_lesson':
            harness.calls.push({ command, args });
            setLesson(Number(args.id), 'pending');
            return null;
          default:
            return originalInvoke(command, args);
        }
      };
    }, seed);
  }
}
