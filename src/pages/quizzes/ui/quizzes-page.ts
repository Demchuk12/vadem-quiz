import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CreateQuizForm } from '@features/create-quiz';
import { TileBanner, VademLogo } from '@shared/ui';
import { QuizList } from '@widgets/quiz-list';

@Component({
  selector: 'vq-quizzes-page',
  imports: [CreateQuizForm, QuizList, TileBanner, VademLogo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './quizzes-page.scss',
  templateUrl: './quizzes-page.html',
})
export class QuizzesPage {}
