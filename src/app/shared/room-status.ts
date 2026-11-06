import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VD_ALERT } from '@vadem/ui/alert';
import { VdButton } from '@vadem/ui/button';
import { VdSkeleton } from '@vadem/ui/skeleton';
import type { RoomLoadStatus } from '../game/room-store';

/** Loading and failure states shared by the three game pages. */
@Component({
  selector: 'vq-room-status',
  imports: [RouterLink, VD_ALERT, VdButton, VdSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: grid;
      gap: var(--vd-space-4);
    }
    [vdSkeleton] {
      block-size: var(--vd-space-16);
    }
  `,
  template: `
    @switch (status()) {
      @case ('loading') {
        <div role="status" aria-label="Завантаження гри">
          <div vdSkeleton></div>
        </div>
      }
      @case ('not_found') {
        <div vdAlert variant="danger" role="alert">
          <p vdAlertTitle>Кімнату не знайдено</p>
          <p>Перевірте код або попросіть ведучого надіслати нове посилання.</p>
        </div>
        <a vdButton routerLink="/join">До входу</a>
      }
      @case ('error') {
        <div vdAlert variant="danger" role="alert">
          <p vdAlertTitle>Не вдалося завантажити гру</p>
          <p>Перевірте зʼєднання й оновіть сторінку.</p>
        </div>
      }
    }
  `,
})
export class RoomStatus {
  readonly status = input.required<RoomLoadStatus>();
}
