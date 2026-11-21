import React, { useState, useEffect, useCallback } from 'react';
import { Download, Trash2, ArrowRight, CheckCircle2, Sliders } from 'lucide-react';
import { DropZone } from '../components/DropZone';
import {
  formatFileSize,
  stripExtension,
  getExtensionFromMime,
  downloadBlob,
  loadImage,
  canvasToBlob,
} from '../utils/imageHelpers';

interface ImageCompressorProps {
  initialFile?: File | null;
  onClearInitialFile?: () => void;
}

interface CompressedItem {
  id: string;
  file: File;
  previewUrl: string;
  origW: number;
  origH: number;
  outW: number;
  outH: number;
  outputBlob: Blob | null;
  isProcessing: boolean;
}

export const ImageCompressor: React.FC<ImageCompressorProps> = ({
  initialFile,
  onClearInitialFile,
}) => {
  const [items, setItems] = useState<CompressedItem[]>([]);
  const [format, setFormat] = useState<'image/webp' | 'image/jpeg' | 'image/png'>('image/webp');
  const [quality, setQuality] = useState(80);
  const [maxDimension, setMaxDimension] = useState<number>(0);

  const compressSingle = useCallback(
    async (
      item: CompressedItem,
      targetFormat: string,
      targetQuality: number,
      maxDim: number
    ): Promise<CompressedItem> => {
      try {
        const img = await loadImage(item.previewUrl);
        let w = img.naturalWidth;
        let h = img.naturalHeight;

        if (maxDim > 0 && (w > maxDim || h > maxDim)) {
          if (w >= h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return item;

        if (targetFormat === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);

        const blob = await canvasToBlob(canvas, targetFormat, targetQuality / 100);
        return {
          ...item,
          origW: img.naturalWidth,
          origH: img.naturalHeight,
          outW: w,
          outH: h,
          outputBlob: blob,
          isProcessing: false,
        };
      } catch {
        return { ...item, isProcessing: false };
      }
    },
    []
  );

  const addFiles = useCallback(
    async (files: File[]) => {
      const newItems: CompressedItem[] = files.map((file) => ({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        origW: 0,
        origH: 0,
        outW: 0,
        outH: 0,
        outputBlob: null,
        isProcessing: true,
      }));

      setItems((prev) => [...newItems, ...prev]);

      const processed = await Promise.all(
        newItems.map((it) => compressSingle(it, format, quality, maxDimension))
      );

      setItems((prev) =>
        prev.map((existing) => processed.find((p) => p.id === existing.id) ?? existing)
      );
    },
    [compressSingle, format, quality, maxDimension]
  );

  useEffect(() => {
    if (initialFile) {
      addFiles([initialFile]);
      onClearInitialFile?.();
    }
  }, [initialFile, onClearInitialFile, addFiles]);

  useEffect(() => {
    if (items.length === 0) return;
    const timer = setTimeout(async () => {
      const updated = await Promise.all(
        items.map((it) => compressSingle(it, format, quality, maxDimension))
      );
      setItems(updated);
    }, 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, quality, maxDimension]);

  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const clearAll = () => {
    items.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    setItems([]);
  };

  const downloadItem = (item: CompressedItem) => {
    if (!item.outputBlob) return;
    const ext = getExtensionFromMime(format);
    downloadBlob(item.outputBlob, `${stripExtension(item.file.name)}-otimizada.${ext}`);
  };

  const downloadAll = () => {
    items.forEach((item, idx) => {
      if (item.outputBlob) {
        setTimeout(() => downloadItem(item), idx * 200);
      }
    });
  };

  const totalOrig = items.reduce((acc, i) => acc + i.file.size, 0);
  const totalOut = items.reduce((acc, i) => acc + (i.outputBlob?.size ?? i.file.size), 0);
  const totalSavedPct = totalOrig > 0 ? Math.round(((totalOrig - totalOut) / totalOrig) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Controls bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="h-4 w-4 text-violet-500" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">
            Configurações de compressão e conversão
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Formato de saída
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'image/webp', label: 'WebP' },
                  { id: 'image/jpeg', label: 'JPG' },
                  { id: 'image/png', label: 'PNG' },
                ] as const
              ).map((fmt) => (
                <button
                  key={fmt.id}
                  onClick={() => setFormat(fmt.id)}
                  className={`rounded-xl border py-2 text-xs font-semibold transition ${
                    format === fmt.id
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {fmt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Qualidade
              </p>
              <span className="rounded-md bg-violet-50 dark:bg-violet-500/15 px-2 py-0.5 text-xs font-bold text-violet-700 dark:text-violet-300">
                {format === 'image/png' ? 'Sem perda' : `${quality}%`}
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              disabled={format === 'image/png'}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full accent-violet-600 disabled:opacity-40 cursor-pointer"
            />
            <div className="mt-1 flex justify-between text-[11px] text-slate-400 dark:text-slate-500">
              <span>Menor arquivo</span>
              <span>Maior qualidade</span>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Dimensão máxima
            </p>
            <select
              value={maxDimension}
              onChange={(e) => setMaxDimension(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:border-violet-500 focus:outline-none"
            >
              <option value={0}>Manter tamanho original</option>
              <option value={1920}>Máx. 1920px (Full HD)</option>
              <option value={1280}>Máx. 1280px (Web)</option>
              <option value={800}>Máx. 800px (Leve)</option>
            </select>
          </div>
        </div>
      </div>

      <DropZone
        multiple
        compact={items.length > 0}
        onFilesSelected={addFiles}
        title={
          items.length > 0
            ? 'Adicionar mais imagens para comprimir'
            : 'Solte uma ou várias imagens para comprimir e converter'
        }
        subtitle="Suporta envio em lote • Converta entre WebP, JPG e PNG instantaneamente"
      />

      {items.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shadow-xs">
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <span className="font-semibold text-slate-800 dark:text-white">
                {items.length} {items.length === 1 ? 'imagem pronta' : 'imagens prontas'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {formatFileSize(totalOrig)} → {formatFileSize(totalOut)}
              </span>
              {totalSavedPct > 0 && (
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  -{totalSavedPct}%
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={clearAll}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Limpar lista
              </button>
              <button
                onClick={downloadAll}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-violet-700"
              >
                <Download className="h-3.5 w-3.5" />
                Baixar {items.length > 1 ? 'todas' : ''}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {items.map((item) => {
              const outSize = item.outputBlob?.size ?? item.file.size;
              const diffPct = Math.round(((item.file.size - outSize) / item.file.size) * 100);
              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 object-cover checkerboard-sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-white max-w-[220px] sm:max-w-xs">
                        {item.file.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>{formatFileSize(item.file.size)}</span>
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          {formatFileSize(outSize)}
                        </span>
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                            diffPct > 0
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {diffPct > 0 ? `-${diffPct}%` : `+${Math.abs(diffPct)}%`}
                        </span>
                        {item.outW > 0 && (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            • {item.outW}×{item.outH}px
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      disabled={!item.outputBlob}
                      onClick={() => downloadItem(item)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-violet-600 dark:hover:bg-violet-500 disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Baixar {getExtensionFromMime(format).toUpperCase()}
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      title="Remover"
                      className="rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-slate-400 transition hover:border-rose-200 dark:hover:border-rose-500/40 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
