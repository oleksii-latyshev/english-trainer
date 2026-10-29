import type { Page } from '@playwright/test';
import { type AiSettingsOptions, installAiSettings } from './ai-settings';
import { installBase } from './base';
import { CoachingBackend } from './coaching';
import { EvaGrowthBackend } from './eva-growth';
import type { IpcCall } from './harness';
import { LiveReviewBackend } from './live-review';
import { MemoryBackend } from './memory';
import { MistakesBackend } from './mistakes';
import { NaturalVoiceBackend } from './natural-voice';
import { PersonalProfileBackend } from './personal-profile';
import { PlannerBackend } from './planner';
import { RescueBackend } from './rescue';
import { ReviewBackend } from './review-backend';
import { SessionBackend } from './session';
import { SpeakingActivityBackend } from './speaking-activity';
import { SpeechBackend } from './speech';
import { installSpeechSettings, type SpeechSettingsOptions } from './speech-settings';
import { SpokenRecallBackend } from './spoken-recall';
import { StreamingBackend } from './streaming';
import { TranslationBackend } from './translation';
import { UsageReviewBackend } from './usage-review';
import { WrapupBackend } from './wrapup';

export class FakeBackend {
  readonly session: SessionBackend;
  readonly memory: MemoryBackend;
  readonly mistakes: MistakesBackend;
  readonly activity: SpeakingActivityBackend;
  readonly growth: EvaGrowthBackend;
  readonly profile: PersonalProfileBackend;
  readonly speech: SpeechBackend;
  readonly translation: TranslationBackend;
  readonly planner: PlannerBackend;
  readonly review: ReviewBackend;
  readonly liveReview: LiveReviewBackend;
  readonly wrapup: WrapupBackend;
  readonly coaching: CoachingBackend;
  readonly usageReview: UsageReviewBackend;
  readonly spokenRecall: SpokenRecallBackend;
  readonly streaming: StreamingBackend;
  readonly rescue: RescueBackend;
  readonly naturalVoice: NaturalVoiceBackend;
  aiSettingsSeed: AiSettingsOptions = {};
  speechSettingsSeed: SpeechSettingsOptions | null = null;
  private installed = false;
  private tolerateUnhandledCommands = false;

  constructor(private readonly page: Page) {
    this.session = new SessionBackend(page);
    this.memory = new MemoryBackend(page);
    this.mistakes = new MistakesBackend(page);
    this.activity = new SpeakingActivityBackend(page);
    this.growth = new EvaGrowthBackend(page);
    this.profile = new PersonalProfileBackend(page);
    this.speech = new SpeechBackend(page);
    this.translation = new TranslationBackend(page);
    this.planner = new PlannerBackend(page);
    this.review = new ReviewBackend(page);
    this.liveReview = new LiveReviewBackend(page);
    this.wrapup = new WrapupBackend(page);
    this.coaching = new CoachingBackend(page);
    this.usageReview = new UsageReviewBackend(page);
    this.spokenRecall = new SpokenRecallBackend(page);
    this.streaming = new StreamingBackend(page);
    this.rescue = new RescueBackend(page);
    this.naturalVoice = new NaturalVoiceBackend(page);
  }

  async install(): Promise<void> {
    if (this.installed) return;
    this.installed = true;
    if (this.liveReview.enabled) {
      this.review.withDuePhrase();
      if (this.liveReview.silentAudio) this.review.withSilentAudio();
    }
    if (this.review.enabled) this.memory.with(this.review.memory);
    await installBase(this.page, {
      activeSession: this.session.open,
      dialogue: this.session.openDialogue,
      failNextStart: this.session.failsNextStart,
      failNextSend: this.session.failsNextSend,
      failNextTransition: this.session.failsNextTransition,
      failNextMistakePractice: this.memory.failsNextMistakePractice,
      mistakePreparationDelayMs: this.memory.mistakePreparationDelayMs,
      learningMemory: this.memory.view,
      translation: this.translation.seed,
      planner: this.planner.seed,
    });
    await this.memory.install();
    await this.mistakes.install();
    await this.activity.install();
    await this.growth.install();
    await this.profile.install();
    await this.review.install();
    await this.liveReview.install();
    await this.wrapup.install();
    await this.coaching.install();
    await this.usageReview.install();
    await this.spokenRecall.install();
    await this.streaming.install();
    await this.rescue.install();
    await this.naturalVoice.install();
    await this.speech.install();
    await installAiSettings(this.page, this.aiSettingsSeed);
    if (this.speechSettingsSeed) await installSpeechSettings(this.page, this.speechSettingsSeed);
  }

  async calls(command?: string): Promise<IpcCall[]> {
    const calls = await this.page.evaluate(() => window.__ET_HARNESS__.calls);
    return command ? calls.filter((call) => call.command === command) : calls;
  }

  async unhandledCommandErrors(): Promise<string[]> {
    if (!this.installed) return [];
    return this.page.evaluate(() => window.__ET_HARNESS__.errors);
  }

  expectUnhandledCommands(): void {
    this.tolerateUnhandledCommands = true;
  }

  get toleratesUnhandledCommands(): boolean {
    return this.tolerateUnhandledCommands;
  }

  invokeUnknownCommand(command: string): Promise<string> {
    return this.page.evaluate(async (name) => {
      try {
        await window.__TAURI_INTERNALS__.invoke(name, {});
        return 'resolved';
      } catch (cause) {
        return cause instanceof Error ? cause.message : String(cause);
      }
    }, command);
  }
}
