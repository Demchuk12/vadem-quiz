import type { Routes } from '@angular/router';

const TITLE = 'Квіз із друзями';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'join' },
  {
    path: 'join',
    title: TITLE,
    loadComponent: () => import('./features/join/join-page').then((m) => m.JoinPage),
  },
  {
    path: 'join/:code',
    title: TITLE,
    loadComponent: () => import('./features/join/join-page').then((m) => m.JoinPage),
  },
  {
    path: 'quizzes',
    title: `Мої квізи · ${TITLE}`,
    loadComponent: () => import('./features/editor/quizzes-page').then((m) => m.QuizzesPage),
  },
  {
    path: 'quizzes/:quizId',
    title: `Редактор · ${TITLE}`,
    loadComponent: () => import('./features/editor/editor-page').then((m) => m.EditorPage),
  },
  {
    path: 'host/:room',
    title: `Ведучий · ${TITLE}`,
    loadComponent: () => import('./features/host/host-page').then((m) => m.HostPage),
  },
  {
    path: 'play/:room',
    title: `Гра · ${TITLE}`,
    loadComponent: () => import('./features/play/play-page').then((m) => m.PlayPage),
  },
  {
    path: 'stream/:room',
    title: `Трансляція · ${TITLE}`,
    loadComponent: () => import('./features/stream/stream-page').then((m) => m.StreamPage),
  },
  { path: '**', redirectTo: 'join' },
];
