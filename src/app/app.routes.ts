import type { Routes } from '@angular/router';
import { confirmUnsavedChanges } from '@shared/lib';

/** A title is a key of the app's texts: see AppTitle. */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layouts/site-layout/site-layout').then((m) => m.SiteLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'join' },
      {
        path: 'join',
        loadComponent: () => import('@pages/join').then((m) => m.JoinPage),
      },
      {
        path: 'join/:code',
        loadComponent: () => import('@pages/join').then((m) => m.JoinPage),
      },
      {
        path: 'quizzes',
        title: 'quizzes',
        loadComponent: () => import('@pages/quizzes').then((m) => m.QuizzesPage),
      },
      {
        path: 'quizzes/:quizId',
        title: 'editor',
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
        title: 'host',
        loadComponent: () => import('@pages/host').then((m) => m.HostPage),
      },
      {
        path: 'play/:room',
        title: 'play',
        loadComponent: () => import('@pages/play').then((m) => m.PlayPage),
      },
      {
        path: 'stream/:room',
        title: 'stream',
        loadComponent: () => import('@pages/stream').then((m) => m.StreamPage),
      },
    ],
  },
  { path: '**', redirectTo: 'join' },
];
