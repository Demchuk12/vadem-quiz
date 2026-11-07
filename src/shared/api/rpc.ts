import { Injectable, inject } from '@angular/core';
import { ApiError } from './api-error';
import { SUPABASE } from './supabase';

/** Calls a database function. Every change to the game state goes through these. */
@Injectable({ providedIn: 'root' })
export class Rpc {
  private readonly supabase = inject(SUPABASE);

  async call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.supabase.rpc(fn, args);
    if (error) {
      // Functions raise their code as the message (SQLSTATE P0001); anything else is transport.
      throw new ApiError(error.code === 'P0001' ? error.message : 'network');
    }
    return data as T;
  }

  /** For functions that return a table of one row. */
  async callRow<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const rows = await this.call<T[]>(fn, args);
    const row = rows[0];
    if (!row) throw new ApiError('network');
    return row;
  }
}
