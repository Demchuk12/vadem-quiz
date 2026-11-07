import { DOCUMENT, Injectable, inject } from '@angular/core';

/** Absolute addresses of a room, for sharing outside the app. */
@Injectable({ providedIn: 'root' })
export class RoomLinks {
  private readonly origin = inject(DOCUMENT).location.origin;

  join(code: string): string {
    return `${this.origin}/join/${code}`;
  }

  stream(code: string): string {
    return `${this.origin}/stream/${code}`;
  }
}
