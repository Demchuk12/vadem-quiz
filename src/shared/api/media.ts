import { Injectable, inject } from '@angular/core';
import { ApiError } from './api-error';
import { SUPABASE } from './supabase';

const MAX_SIDE = 1280;
const QUALITY = 0.8;

const BUCKET = 'quiz-media';

/** Longest side after scaling down; images are never scaled up. */
export function scaledSize(
  width: number,
  height: number,
  maxSide = MAX_SIDE,
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

@Injectable({ providedIn: 'root' })
export class Media {
  private readonly supabase = inject(SUPABASE);

  publicUrl(path: string): string {
    return this.supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  /** Compresses in the browser, which saves far more storage and traffic than any server limit. */
  async compress(file: File): Promise<Blob> {
    const bitmap = await createImageBitmap(file);
    const size = scaledSize(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new ApiError('network');
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();

    // Browsers that cannot encode WebP silently return PNG, which is large and not accepted.
    const webp = await encode(canvas, 'image/webp');
    if (webp?.type === 'image/webp') return webp;
    const jpeg = await encode(canvas, 'image/jpeg');
    if (!jpeg) throw new ApiError('network');
    return jpeg;
  }

  /** Returns the storage path. The random name is what keeps an unopened question's image secret. */
  async upload(quizId: string, file: File): Promise<string> {
    const blob = await this.compress(file);
    const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${quizId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await this.supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
    if (error) throw new ApiError('network');
    return path;
  }
}
