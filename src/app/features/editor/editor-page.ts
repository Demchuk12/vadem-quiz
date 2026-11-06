import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { VD_ACCORDION } from '@vadem/ui/accordion';
import { VD_ALERT } from '@vadem/ui/alert';
import { VdButton } from '@vadem/ui/button';
import { VD_CARD } from '@vadem/ui/card';
import { VdField } from '@vadem/ui/field';
import { VdIcon } from '@vadem/ui/icon';
import { VdInput } from '@vadem/ui/input';
import { VD_NUMBER_INPUT } from '@vadem/ui/number-input';
import { VdSkeleton } from '@vadem/ui/skeleton';
import { VD_TABS } from '@vadem/ui/tabs';
import { VdToaster } from '@vadem/ui/toast';
import { errorMessage } from '../../core/api-error';
import { GameApi } from '../../core/game-api';
import { LocalStore, type SavedQuiz } from '../../core/local-store';
import {
  QuizImportError,
  addCategory,
  isQuestionComplete,
  parseQuizDocument,
  pointsOf,
  quizProgress,
  removeCategory,
  updateCategory,
  updateQuestion,
  type QuizDocument,
  type QuizQuestion,
} from '../../game/quiz-document';
import { QuestionImage } from './question-image';

type LoadState = 'loading' | 'ready' | 'forbidden' | 'error';

@Component({
  selector: 'vq-editor-page',
  imports: [
    RouterLink,
    VD_ACCORDION,
    VD_ALERT,
    VdButton,
    VD_CARD,
    VdField,
    VdIcon,
    VdInput,
    VD_NUMBER_INPUT,
    VdSkeleton,
    VD_TABS,
    QuestionImage,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: grid;
      gap: var(--vd-space-6);
      max-inline-size: 60rem;
      margin-inline: auto;
      padding: var(--vd-space-6) var(--vd-space-4) var(--vd-space-16);
    }
    .bar {
      position: sticky;
      inset-block-start: 0;
      z-index: 1;
      display: flex;
      flex-wrap: wrap;
      gap: var(--vd-space-2);
      align-items: center;
      padding-block: var(--vd-space-3);
      background-color: var(--vd-color-bg);
    }
    .bar .progress {
      margin-inline-end: auto;
      color: var(--vd-color-text-muted);
      font-size: var(--vd-text-sm);
    }
    .round {
      display: grid;
      gap: var(--vd-space-4);
      padding-block-start: var(--vd-space-4);
    }
    .category {
      display: grid;
      gap: var(--vd-space-3);
    }
    .category-head {
      display: flex;
      gap: var(--vd-space-2);
      align-items: end;
    }
    .category-head vd-field {
      flex: 1;
    }
    .question {
      display: grid;
      gap: var(--vd-space-3);
      padding-block: var(--vd-space-3);
    }
    summary {
      overflow-wrap: anywhere;
    }
    .pair {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
      gap: var(--vd-space-3);
    }
    .multiplier {
      max-inline-size: 14rem;
    }
    .file-input {
      display: none;
    }
  `,
  template: `
    @switch (load()) {
      @case ('loading') {
        <div role="status" aria-label="Завантаження квізу"><div vdSkeleton></div></div>
      }
      @case ('forbidden') {
        <div vdAlert variant="danger" role="alert">
          <p vdAlertTitle>Цей квіз недоступний на цьому пристрої</p>
          <p>Доступ зберігається в браузері, де квіз створили.</p>
        </div>
        <a vdButton routerLink="/quizzes">До моїх квізів</a>
      }
      @case ('error') {
        <div vdAlert variant="danger" role="alert">Не вдалося завантажити квіз.</div>
      }
      @case ('ready') {
        @if (document(); as doc) {
          <div class="bar">
            <a vdButton variant="ghost" size="sm" routerLink="/quizzes">
              <vd-icon slot="start" name="arrow-left" />
              Квізи
            </a>
            <span class="progress" aria-live="polite">
              Заповнено {{ progress().complete }} з {{ progress().total }}
              @if (dirty()) {
                · є незбережені зміни
              }
            </span>
            <button vdButton size="sm" (click)="fileInput.click()">
              <vd-icon slot="start" name="upload" />
              Імпорт
            </button>
            <input
              #fileInput
              class="file-input"
              type="file"
              accept="application/json,.json"
              aria-label="Імпорт квізу з JSON"
              (change)="importFile($event)"
            />
            <button vdButton size="sm" (click)="exportFile()">
              <vd-icon slot="start" name="download" />
              Експорт
            </button>
            <button
              vdButton
              size="sm"
              variant="primary"
              [loading]="saving()"
              [disabled]="!dirty()"
              (click)="save()"
            >
              Зберегти
            </button>
          </div>

          <vd-field label="Назва квізу">
            <input
              vdInput
              maxlength="120"
              [value]="doc.title"
              (input)="patch({ title: valueOf($event) })"
            />
          </vd-field>

          <vd-tabs [value]="activeRound()" (valueChange)="activeRound.set($any($event))">
            <div vdTabList aria-label="Раунди">
              @for (round of doc.rounds; track $index) {
                <button vdTab [value]="$index + ''">Раунд {{ $index + 1 }}</button>
              }
            </div>
            @for (round of doc.rounds; track $index; let r = $index) {
              <div vdTabPanel [value]="r + ''">
                <div class="round">
                  <vd-field class="multiplier" label="Множник очок">
                    <vd-number-input decreaseLabel="Зменшити" increaseLabel="Збільшити">
                      <input
                        vdNumberInput
                        type="number"
                        min="1"
                        max="10"
                        [value]="doc.roundMultipliers[r]"
                        (change)="setMultiplier(r, $event)"
                      />
                    </vd-number-input>
                  </vd-field>

                  @for (category of round.categories; track $index; let c = $index) {
                    <section vdCard class="category">
                      <div class="category-head">
                        <vd-field [label]="'Категорія ' + (c + 1)">
                          <input
                            vdInput
                            maxlength="80"
                            [value]="category.title"
                            (input)="setCategoryTitle(r, c, $event)"
                          />
                        </vd-field>
                        <button
                          vdButton
                          variant="ghost"
                          iconOnly
                          [attr.aria-label]="'Видалити категорію ' + (c + 1)"
                          (click)="change(removeCategoryAt(doc, r, c))"
                        >
                          <vd-icon name="trash" />
                        </button>
                      </div>

                      <div vdAccordion>
                        @for (question of category.questions; track $index; let q = $index) {
                          <details vdAccordionItem>
                            <summary>
                              {{ points(question, r) }} ·
                              {{
                                isComplete(question) ? question.text || 'Картинка' : 'не заповнено'
                              }}
                            </summary>
                            <div class="question">
                              <div class="pair">
                                <vd-field label="Питання">
                                  <textarea
                                    vdInput
                                    rows="3"
                                    maxlength="2000"
                                    [value]="question.text"
                                    (input)="setQuestion(r, c, q, { text: valueOf($event) })"
                                  ></textarea>
                                </vd-field>
                                <vd-field label="Правильна відповідь">
                                  <textarea
                                    vdInput
                                    rows="3"
                                    maxlength="2000"
                                    [value]="question.answerText"
                                    (input)="setQuestion(r, c, q, { answerText: valueOf($event) })"
                                  ></textarea>
                                </vd-field>
                              </div>
                              <div class="pair">
                                <vq-question-image
                                  [quizId]="quizId()"
                                  [path]="question.imagePath"
                                  label="Картинка до питання"
                                  (pathChange)="setQuestion(r, c, q, { imagePath: $event })"
                                />
                                <vq-question-image
                                  [quizId]="quizId()"
                                  [path]="question.answerImagePath"
                                  label="Картинка до відповіді"
                                  (pathChange)="setQuestion(r, c, q, { answerImagePath: $event })"
                                />
                              </div>
                            </div>
                          </details>
                        }
                      </div>
                    </section>
                  }

                  <button vdButton (click)="change(addCategoryTo(doc, r))">
                    <vd-icon slot="start" name="plus" />
                    Додати категорію
                  </button>
                </div>
              </div>
            }
          </vd-tabs>
        }
      }
    }
  `,
})
export class EditorPage implements OnInit {
  readonly quizId = input.required<string>();

  private readonly api = inject(GameApi);
  private readonly local = inject(LocalStore);
  private readonly toaster = inject(VdToaster);

  protected readonly load = signal<LoadState>('loading');
  protected readonly document = signal<QuizDocument | null>(null);
  protected readonly dirty = signal(false);
  protected readonly saving = signal(false);
  protected readonly activeRound = signal('0');
  protected readonly progress = computed(() => {
    const doc = this.document();
    return doc ? quizProgress(doc) : { complete: 0, total: 0, missingTitles: 0 };
  });

  protected readonly isComplete = isQuestionComplete;
  protected readonly addCategoryTo = addCategory;
  protected readonly removeCategoryAt = removeCategory;

  private saved: SavedQuiz | undefined;

  async ngOnInit(): Promise<void> {
    this.saved = this.local.quiz(this.quizId());
    if (!this.saved) {
      this.load.set('forbidden');
      return;
    }
    try {
      this.document.set(await this.api.getQuiz(this.saved.id, this.saved.token));
      this.load.set('ready');
    } catch {
      this.load.set('error');
    }
  }

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected change(doc: QuizDocument): void {
    this.document.set(doc);
    this.dirty.set(true);
  }

  protected patch(patch: Partial<QuizDocument>): void {
    const doc = this.document();
    if (doc) this.change({ ...doc, ...patch });
  }

  protected points(question: QuizQuestion, round: number): number {
    const doc = this.document();
    return doc ? pointsOf(question.basePoints, round, doc) : question.basePoints;
  }

  protected setCategoryTitle(round: number, category: number, event: Event): void {
    const doc = this.document();
    const title = this.valueOf(event);
    if (doc) this.change(updateCategory(doc, round, category, (c) => ({ ...c, title })));
  }

  protected setQuestion(
    round: number,
    category: number,
    question: number,
    patch: Partial<QuizQuestion>,
  ): void {
    const doc = this.document();
    if (doc) this.change(updateQuestion(doc, { round, category, question }, patch));
  }

  protected setMultiplier(round: number, event: Event): void {
    const doc = this.document();
    const value = Number(this.valueOf(event));
    if (!doc || !Number.isInteger(value) || value < 1) return;
    this.patch({ roundMultipliers: doc.roundMultipliers.map((m, i) => (i === round ? value : m)) });
  }

  protected async save(): Promise<void> {
    const doc = this.document();
    if (!doc || !this.saved || this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.saveQuiz(this.saved.id, this.saved.token, doc);
      this.saved = { ...this.saved, title: doc.title };
      this.local.saveQuiz(this.saved);
      this.dirty.set(false);
      this.toaster.success('Квіз збережено');
    } catch (error) {
      this.toaster.error('Не вдалося зберегти', errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected exportFile(): void {
    const doc = this.document();
    if (!doc) return;
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `${doc.title || 'quiz'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  protected async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const { document, droppedImages } = parseQuizDocument(await file.text(), this.quizId());
      this.change(document);
      this.activeRound.set('0');
      this.toaster.success(
        'Квіз імпортовано, збережіть його',
        droppedImages > 0
          ? `Картинок з іншого квізу прибрано: ${droppedImages}. Їх треба завантажити знову.`
          : undefined,
      );
    } catch (error) {
      const message =
        error instanceof QuizImportError ? error.message : 'Не вдалося прочитати файл';
      this.toaster.error('Імпорт не вдався', message);
    }
  }
}
