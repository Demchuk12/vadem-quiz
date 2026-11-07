import { Injectable } from '@angular/core';
import { readJson, removeKey, writeJson } from '@shared/lib';

export interface PlayerSession {
  roomId: string;
  playerId: string;
  token: string;
}

const hostKey = (code: string) => `vq.host.${code}`;
const playerKey = (code: string) => `vq.player.${code}`;

/** Who this browser is in a room: the secrets that let it act as the host or as a player. */
@Injectable({ providedIn: 'root' })
export class RoomSessions {
  hostToken(code: string): string | null {
    return readJson<string>(hostKey(code));
  }

  saveHostToken(code: string, token: string): void {
    writeJson(hostKey(code), token);
  }

  player(code: string): PlayerSession | null {
    return readJson<PlayerSession>(playerKey(code));
  }

  savePlayer(code: string, session: PlayerSession): void {
    writeJson(playerKey(code), session);
  }

  forgetPlayer(code: string): void {
    removeKey(playerKey(code));
  }
}
