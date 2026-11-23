export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : val < 10 ? 2 : 1)} ${units[i]}`;
}

export function stripExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.slice(0, lastDot) : filename;
}

export function getExtensionFromMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/png':
    default:
      return 'png';
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Falha ao gerar a imagem.'));
      },
      mimeType,
      quality
    );
  });
}

export type WhatsAppShareResult = 'shared' | 'copied-and-opened' | 'downloaded-and-opened' | 'cancelled';

/**
 * Shares an image + caption to WhatsApp:
 * - On mobile / browsers supporting Web Share with files: opens native share sheet with image attached.
 * - On desktop: copies PNG to clipboard (or downloads as fallback) and opens WhatsApp Web with the caption.
 */
export async function shareImageToWhatsApp(
  blob: Blob,
  filename: string,
  caption: string
): Promise<WhatsAppShareResult> {
  const file = new File([blob], filename, { type: blob.type || 'image/png' });

  // 1. Mobile / native Web Share API with file attachment
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: filename,
        text: caption,
      });
      return 'shared';
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return 'cancelled';
      // Fall through to desktop flow if native share fails
    }
  }

  // 2. Desktop flow: try copying PNG to clipboard so user can just Ctrl+V in WhatsApp Web
  let copied = false;
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof ClipboardItem !== 'undefined'
    ) {
      // ClipboardItem requires image/png in most browsers
      const pngBlob = blob.type === 'image/png' ? blob : await convertBlobToPng(blob);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
      copied = true;
    }
  } catch {
    copied = false;
  }

  if (!copied) {
    downloadBlob(blob, filename);
  }

  const waUrl = `https://wa.me/?text=${encodeURIComponent(caption)}`;
  window.open(waUrl, '_blank', 'noopener,noreferrer');

  return copied ? 'copied-and-opened' : 'downloaded-and-opened';
}

async function convertBlobToPng(blob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx?.drawImage(img, 0, 0);
    return await canvasToBlob(c, 'image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
