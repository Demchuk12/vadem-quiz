import type { Routes } from '@angular/router';
import { confirmUnsavedChanges } from '@shared/lib';

const TITLE = 'Квіз із друзями';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layouts/site-layout/site-layout').then((m) => m.SiteLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'join' },
      {
        path: 'join',
        title: TITLE,
        loadComponent: () => import('@pages/join').then((m) => m.JoinPage),
      },
      {
        path: 'join/:code',
        title: TITLE,
        loadComponent: () => import('@pages/join').then((m) => m.JoinPage),
      },
      {
        path: 'quizzes',
        title: `Мої квізи · ${TITLE}`,
        loadComponent: () => import('@pages/quizzes').then((m) => m.QuizzesPage),
      },
      {
        path: 'quizzes/:quizId',
        title: `Редактор · ${TITLE}`,
        canDeactivate: [confirmUnsavedChanges],
        loadComponent: () => import('@pages/quiz-editor').then((m) => m.QuizEditorPage),
      },
    ],
  },
  {
    path: '',
    loadComponent: () => import('./layouts/game-layout/game-layout').then((m) => m.GameLayout),
    children: [
      {
        path: 'host/:room',
        title: `Ведучий · ${TITLE}`,
        loadComponent: () => import('@pages/host').then((m) => m.HostPage),
      },
      {
        path: 'play/:room',
        title: `Гра · ${TITLE}`,
        loadComponent: () => import('@pages/play').then((m) => m.PlayPage),
      },
      {
        path: 'stream/:room',
        title: `Трансляція · ${TITLE}`,
        loadComponent: () => import('@pages/stream').then((m) => m.StreamPage),
      },
    ],
  },
  { path: '**', redirectTo: 'join' },
];
