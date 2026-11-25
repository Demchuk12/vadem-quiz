import { ChangeDetectionStrategy, Component } from '@angular/core';
import { injectMessages } from '@shared/i18n';
import { CreateQuiz } from '@features/create-quiz';
import { TileBanner } from '@shared/ui';
import { QuizList } from '@widgets/quiz-list';
import { MESSAGES } from '../i18n/messages';

@Component({
  selector: 'vq-quizzes-page',
  imports: [CreateQuiz, QuizList, TileBanner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './quizzes-page.scss',
  templateUrl: './quizzes-page.html',
})
export class QuizzesPage {
  protected readonly t = injectMessages(MESSAGES);
}
