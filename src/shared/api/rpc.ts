import { Injectable, inject } from '@angular/core';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { ApiError } from './api-error';
import { SUPABASE } from './supabase';

/** Calls the backend. Every change to the game state goes through database functions. */
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

  /** Calls an Edge Function, which reports failures as `{ code }`. */
  async invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.supabase.functions.invoke(name, { body });
    if (!error) return data as T;
    if (error instanceof FunctionsHttpError) {
      const failure = await (error.context as Response).json().catch(() => null);
      throw new ApiError(failure?.code ?? 'network');
    }
    throw new ApiError('network');
  }
}
