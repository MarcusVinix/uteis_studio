import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Crop,
  Download,
  RotateCcw,
  RotateCw,
  FlipHorizontal2,
  FlipVertical2,
  Lock,
  Unlock,
  Sparkles,
  Minimize2,
} from 'lucide-react';
import { DropZone } from '../components/DropZone';
import {
  downloadBlob,
  stripExtension,
  getExtensionFromMime,
  loadImage,
  canvasToBlob,
} from '../utils/imageHelpers';

interface ImageCropResizeProps {
  initialFile?: File | null;
  onClearInitialFile?: () => void;
  onSendToTool: (tool: 'bg' | 'compress', file: File) => void;
}

interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ASPECT_PRESETS = [
  { label: 'Livre', value: null },
  { label: '1:1', value: 1 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
  { label: '4:3', value: 4 / 3 },
  { label: '4:5', value: 4 / 5 },
];

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | null;

export const ImageCropResize: React.FC<ImageCropResizeProps> = ({
  initialFile,
  onClearInitialFile,
  onSendToTool,
}) => {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });

  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  const [aspect, setAspect] = useState<number | null>(null);
  const [crop, setCrop] = useState<CropBox>({ x: 0, y: 0, w: 1, h: 1 });

  const [outWidth, setOutWidth] = useState(0);
  const [outHeight, setOutHeight] = useState(0);
  const [lockRatio, setLockRatio] = useState(true);
  const [exportFormat, setExportFormat] = useState<'image/png' | 'image/jpeg' | 'image/webp'>(
    'image/png'
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    startCrop: CropBox;
  } | null>(null);

  const effW = rotation % 180 === 0 ? naturalSize.w : naturalSize.h;
  const effH = rotation % 180 === 0 ? naturalSize.h : naturalSize.w;

  const handleLoadFile = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      setImageUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setSourceFile(file);
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      setRotation(0);
      setFlipH(false);
      setFlipV(false);
      setAspect(null);
      setCrop({ x: 0, y: 0, w: 1, h: 1 });
      setOutWidth(img.naturalWidth);
      setOutHeight(img.naturalHeight);
    } catch {
      URL.revokeObjectURL(url);
    }
  }, []);

  useEffect(() => {
    if (initialFile) {
      handleLoadFile(initialFile);
      onClearInitialFile?.();
    }
  }, [initialFile, onClearInitialFile, handleLoadFile]);

  useEffect(() => {
    if (effW > 0 && effH > 0) {
      setOutWidth(Math.max(1, Math.round(crop.w * effW)));
      setOutHeight(Math.max(1, Math.round(crop.h * effH)));
    }
  }, [crop.w, crop.h, effW, effH]);

  const applyAspectPreset = (ratio: number | null) => {
    setAspect(ratio);
    if (!ratio || effW === 0 || effH === 0) return;

    const imgRatio = effW / effH;
    let w = 1;
    let h = 1;
    if (ratio > imgRatio) {
      w = 1;
      h = imgRatio / ratio;
    } else {
      h = 1;
      w = ratio / imgRatio;
    }
    setCrop({
      x: (1 - w) / 2,
      y: (1 - h) / 2,
      w,
      h,
    });
  };

  const handlePointerDown = (e: React.PointerEvent, mode: DragMode) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...crop },
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dx = (e.clientX - dragState.current.startX) / rect.width;
    const dy = (e.clientY - dragState.current.startY) / rect.height;
    const { mode, startCrop } = dragState.current;
    const minSize = 0.08;

    let { x, y, w, h } = startCrop;

    if (mode === 'move') {
      x = Math.max(0, Math.min(1 - w, startCrop.x + dx));
      y = Math.max(0, Math.min(1 - h, startCrop.y + dy));
      setCrop({ x, y, w, h });
      return;
    }

    if (mode === 'se') {
      w = Math.max(minSize, Math.min(1 - x, startCrop.w + dx));
      h = Math.max(minSize, Math.min(1 - y, startCrop.h + dy));
    } else if (mode === 'sw') {
      const nextX = Math.max(0, Math.min(startCrop.x + startCrop.w - minSize, startCrop.x + dx));
      w = startCrop.x + startCrop.w - nextX;
      x = nextX;
      h = Math.max(minSize, Math.min(1 - y, startCrop.h + dy));
    } else if (mode === 'ne') {
      w = Math.max(minSize, Math.min(1 - x, startCrop.w + dx));
      const nextY = Math.max(0, Math.min(startCrop.y + startCrop.h - minSize, startCrop.y + dy));
      h = startCrop.y + startCrop.h - nextY;
      y = nextY;
    } else if (mode === 'nw') {
      const nextX = Math.max(0, Math.min(startCrop.x + startCrop.w - minSize, startCrop.x + dx));
      w = startCrop.x + startCrop.w - nextX;
      x = nextX;
      const nextY = Math.max(0, Math.min(startCrop.y + startCrop.h - minSize, startCrop.y + dy));
      h = startCrop.y + startCrop.h - nextY;
      y = nextY;
    }

    if (aspect && effW > 0 && effH > 0) {
      const imgRatio = effW / effH;
      const targetH = (w * imgRatio) / aspect;
      if (y + targetH <= 1) {
        h = Math.max(minSize, targetH);
      } else {
        h = 1 - y;
        w = (h * aspect) / imgRatio;
      }
    }

    setCrop({ x, y, w, h });
  };

  const handlePointerUp = () => {
    dragState.current = null;
  };

  const renderFinalBlob = async (format: string): Promise<Blob | null> => {
    if (!imageUrl || effW === 0 || effH === 0) return null;
    const img = await loadImage(imageUrl);

    const transCanvas = document.createElement('canvas');
    transCanvas.width = effW;
    transCanvas.height = effH;
    const tCtx = transCanvas.getContext('2d');
    if (!tCtx) return null;

    tCtx.translate(effW / 2, effH / 2);
    tCtx.rotate((rotation * Math.PI) / 180);
    tCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    tCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

    const sx = Math.round(crop.x * effW);
    const sy = Math.round(crop.y * effH);
    const sw = Math.max(1, Math.round(crop.w * effW));
    const sh = Math.max(1, Math.round(crop.h * effH));

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = Math.max(1, outWidth);
    finalCanvas.height = Math.max(1, outHeight);
    const fCtx = finalCanvas.getContext('2d');
    if (!fCtx) return null;

    if (format === 'image/jpeg') {
      fCtx.fillStyle = '#ffffff';
      fCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
    }

    fCtx.imageSmoothingEnabled = true;
    fCtx.imageSmoothingQuality = 'high';
    fCtx.drawImage(transCanvas, sx, sy, sw, sh, 0, 0, finalCanvas.width, finalCanvas.height);

    return canvasToBlob(finalCanvas, format, 0.94);
  };

  const handleDownload = async () => {
    const blob = await renderFinalBlob(exportFormat);
    if (!blob || !sourceFile) return;
    const ext = getExtensionFromMime(exportFormat);
    downloadBlob(blob, `${stripExtension(sourceFile.name)}-editada.${ext}`);
  };

  const handleForward = async (tool: 'bg' | 'compress') => {
    const blob = await renderFinalBlob('image/png');
    if (!blob || !sourceFile) return;
    const nextFile = new File([blob], `${stripExtension(sourceFile.name)}-editada.png`, {
      type: 'image/png',
    });
    onSendToTool(tool, nextFile);
  };

  const handleWidthChange = (val: number) => {
    const w = Math.max(1, val);
    setOutWidth(w);
    if (lockRatio && crop.w * effW > 0 && crop.h * effH > 0) {
      const ratio = (crop.w * effW) / (crop.h * effH);
      setOutHeight(Math.max(1, Math.round(w / ratio)));
    }
  };

  const handleHeightChange = (val: number) => {
    const h = Math.max(1, val);
    setOutHeight(h);
    if (lockRatio && crop.w * effW > 0 && crop.h * effH > 0) {
      const ratio = (crop.w * effW) / (crop.h * effH);
      setOutWidth(Math.max(1, Math.round(h * ratio)));
    }
  };

  const applyScalePreset = (pct: number) => {
    const baseW = Math.round(crop.w * effW);
    const baseH = Math.round(crop.h * effH);
    setOutWidth(Math.max(1, Math.round((baseW * pct) / 100)));
    setOutHeight(Math.max(1, Math.round((baseH * pct) / 100)));
  };

  const handleReset = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setSourceFile(null);
    setImageUrl(null);
    setNaturalSize({ w: 0, h: 0 });
  };

  if (!sourceFile || !imageUrl) {
    return (
      <DropZone
        onFilesSelected={(files) => handleLoadFile(files[0])}
        title="Solte uma imagem para recortar ou redimensionar"
        subtitle="Proporções prontas para Instagram, YouTube, Stories e redimensionamento em pixels"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Interactive Cropper */}
      <div className="lg:col-span-8 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setRotation((r) => (r + 270) % 360)}
              title="Girar 90° à esquerda"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              -90°
            </button>
            <button
              onClick={() => setRotation((r) => (r + 90) % 360)}
              title="Girar 90° à direita"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <RotateCw className="h-3.5 w-3.5" />
              +90°
            </button>
            <button
              onClick={() => setFlipH((f) => !f)}
              title="Espelhar horizontalmente"
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                flipH
                  ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <FlipHorizontal2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setFlipV((f) => !f)}
              title="Espelhar verticalmente"
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                flipV
                  ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <FlipVertical2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Nova imagem
          </button>
        </div>

        <div className="flex min-h-[380px] sm:min-h-[460px] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900/95 p-6 shadow-xs">
          <div
            ref={containerRef}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="relative inline-block select-none touch-none"
          >
            <img
              src={imageUrl}
              alt="Recorte"
              draggable={false}
              style={{
                transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${
                  flipV ? -1 : 1
                })`,
              }}
              className="max-h-[420px] max-w-full block pointer-events-none transition-transform duration-150"
            />

            <div
              onPointerDown={(e) => handlePointerDown(e, 'move')}
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.w * 100}%`,
                height: `${crop.h * 100}%`,
                boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.65)',
              }}
              className="absolute cursor-move border-2 border-white"
            >
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }).map((_, idx) => (
                  <div key={idx} className="border border-white/25" />
                ))}
              </div>

              {(
                [
                  { id: 'nw', cls: '-top-2 -left-2 cursor-nwse-resize' },
                  { id: 'ne', cls: '-top-2 -right-2 cursor-nesw-resize' },
                  { id: 'sw', cls: '-bottom-2 -left-2 cursor-nesw-resize' },
                  { id: 'se', cls: '-bottom-2 -right-2 cursor-nwse-resize' },
                ] as const
              ).map((h) => (
                <div
                  key={h.id}
                  onPointerDown={(e) => handlePointerDown(e, h.id)}
                  className={`absolute h-4 w-4 rounded-full border-2 border-white bg-violet-600 shadow ${h.cls}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Controls Sidebar */}
      <div className="lg:col-span-4 space-y-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Crop className="h-4 w-4 text-violet-500" />
              Proporção do recorte
            </h3>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {ASPECT_PRESETS.map((p) => {
                const active = aspect === p.value;
                return (
                  <button
                    key={p.label}
                    onClick={() => applyAspectPreset(p.value)}
                    className={`rounded-xl border py-2 text-xs font-semibold transition ${
                      active
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-800" />

          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Tamanho final (px)
              </p>
              <button
                onClick={() => setLockRatio((l) => !l)}
                className={`inline-flex items-center gap-1 text-xs font-medium ${
                  lockRatio ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400'
                }`}
              >
                {lockRatio ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                Proporção
              </button>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Largura
                </label>
                <input
                  type="number"
                  min={1}
                  max={8000}
                  value={outWidth}
                  onChange={(e) => handleWidthChange(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-800 dark:text-white focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Altura
                </label>
                <input
                  type="number"
                  min={1}
                  max={8000}
                  value={outHeight}
                  onChange={(e) => handleHeightChange(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-800 dark:text-white focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-1.5">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => applyScalePreset(pct)}
                  className="flex-1 rounded-lg bg-slate-100 dark:bg-slate-800 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-violet-100 dark:hover:bg-violet-500/20 hover:text-violet-700 dark:hover:text-violet-300 transition"
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-800" />

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Formato
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'image/png', label: 'PNG' },
                  { id: 'image/webp', label: 'WebP' },
                  { id: 'image/jpeg', label: 'JPG' },
                ] as const
              ).map((fmt) => (
                <button
                  key={fmt.id}
                  onClick={() => setExportFormat(fmt.id)}
                  className={`rounded-xl border py-2 text-xs font-semibold transition ${
                    exportFormat === fmt.id
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {fmt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleDownload}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-violet-200 dark:shadow-violet-950/60 transition hover:from-violet-700 hover:to-indigo-700"
          >
            <Download className="h-4 w-4" />
            Baixar ({outWidth} × {outHeight})
          </button>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => handleForward('bg')}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-300"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Remover fundo
            </button>
            <button
              onClick={() => handleForward('compress')}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-300"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              Comprimir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
