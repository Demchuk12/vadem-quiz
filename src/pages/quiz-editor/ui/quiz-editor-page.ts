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
import {
  QuizApi,
  SavedQuizzes,
  quizProgress,
  type QuizDocument,
  type SavedQuiz,
} from '@entities/quiz';
import { QuizTransfer } from '@features/transfer-quiz';
import { apiAction } from '@shared/api';
import { VD_ALERT } from '@vadem/ui/alert';
import { VdButton } from '@vadem/ui/button';
import { VdIcon } from '@vadem/ui/icon';
import { VdSkeleton } from '@vadem/ui/skeleton';
import { VdToaster } from '@vadem/ui/toast';
import { QuizEditor } from '@widgets/quiz-editor';

type LoadState = 'loading' | 'ready' | 'forbidden' | 'error';

@Component({
  selector: 'vq-quiz-editor-page',
  imports: [RouterLink, VD_ALERT, VdButton, VdIcon, VdSkeleton, QuizEditor, QuizTransfer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './quiz-editor-page.scss',
  templateUrl: './quiz-editor-page.html',
})
export class QuizEditorPage implements OnInit {
  readonly quizId = input.required<string>();

  private readonly api = inject(QuizApi);
  private readonly savedQuizzes = inject(SavedQuizzes);
  private readonly toaster = inject(VdToaster);

  protected readonly load = signal<LoadState>('loading');
  protected readonly quiz = signal<QuizDocument | null>(null);
  protected readonly dirty = signal(false);
  private readonly saveAction = apiAction();
  protected readonly saving = this.saveAction.busy;
  protected readonly progress = computed(() => {
    const quiz = this.quiz();
    return quiz ? quizProgress(quiz) : { complete: 0, total: 0, missingTitles: 0 };
  });

  private saved: SavedQuiz | undefined;

  async ngOnInit(): Promise<void> {
    this.saved = this.savedQuizzes.find(this.quizId());
    if (!this.saved) {
      this.load.set('forbidden');
      return;
    }
    try {
      this.quiz.set(await this.api.get(this.saved.id, this.saved.token));
      this.load.set('ready');
    } catch {
      this.load.set('error');
    }
  }

  protected change(quiz: QuizDocument): void {
    this.quiz.set(quiz);
    this.dirty.set(true);
  }

  protected async save(): Promise<void> {
    const quiz = this.quiz();
    const saved = this.saved;
    if (!quiz || !saved) return;

    const done = await this.saveAction.run(() => this.api.save(saved.id, saved.token, quiz), {
      errorTitle: 'Не вдалося зберегти',
    });
    if (done) {
      this.saved = { ...saved, title: quiz.title };
      this.savedQuizzes.save(this.saved);
      this.dirty.set(false);
      this.toaster.success('Квіз збережено');
    }
  }
}
