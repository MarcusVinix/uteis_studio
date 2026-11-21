import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Download,
  RotateCcw,
  Crop,
  Minimize2,
  Loader2,
  AlertCircle,
  SlidersHorizontal,
  Eye,
  Image as ImageIcon,
  Eraser,
  Paintbrush,
  Undo2,
  RefreshCw,
} from 'lucide-react';
import { DropZone } from '../components/DropZone';
import {
  downloadBlob,
  stripExtension,
  getExtensionFromMime,
  loadImage,
  canvasToBlob,
} from '../utils/imageHelpers';
import { removeImageBackground, type BgEngine } from '../utils/aiBackgroundRemover';

interface BackgroundRemoverProps {
  initialFile?: File | null;
  onClearInitialFile?: () => void;
  onSendToTool: (tool: 'crop' | 'compress', file: File) => void;
}

type BgOption =
  | { type: 'transparent'; label: string }
  | { type: 'color'; label: string; value: string }
  | { type: 'gradient'; label: string; from: string; to: string; css: string };

const SOLID_COLORS: BgOption[] = [
  { type: 'color', label: 'Branco', value: '#ffffff' },
  { type: 'color', label: 'Preto', value: '#0f172a' },
  { type: 'color', label: 'Cinza Claro', value: '#f1f5f9' },
  { type: 'color', label: 'Roxo', value: '#7c3aed' },
  { type: 'color', label: 'Azul', value: '#2563eb' },
  { type: 'color', label: 'Verde', value: '#10b981' },
  { type: 'color', label: 'Rosa', value: '#f43f5e' },
  { type: 'color', label: 'Amarelo', value: '#facc15' },
];

const GRADIENTS: BgOption[] = [
  {
    type: 'gradient',
    label: 'Canva',
    from: '#00c4cc',
    to: '#7d2ae8',
    css: 'linear-gradient(135deg, #00c4cc, #7d2ae8)',
  },
  {
    type: 'gradient',
    label: 'Pôr do Sol',
    from: '#f97316',
    to: '#ec4899',
    css: 'linear-gradient(135deg, #f97316, #ec4899)',
  },
  {
    type: 'gradient',
    label: 'Oceano',
    from: '#06b6d4',
    to: '#3b82f6',
    css: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
  },
  {
    type: 'gradient',
    label: 'Menta',
    from: '#34d399',
    to: '#0ea5e9',
    css: 'linear-gradient(135deg, #34d399, #0ea5e9)',
  },
  {
    type: 'gradient',
    label: 'Noturno',
    from: '#1e1b4b',
    to: '#4c1d95',
    css: 'linear-gradient(135deg, #1e1b4b, #4c1d95)',
  },
];

const MODEL_OPTIONS: { id: BgEngine; label: string; hint: string }[] = [
  { id: 'bria', label: 'Ultra (RMBG)', hint: 'Estilo Canva — pessoas e objetos (BRIA RMBG-1.4)' },
  { id: 'portrait', label: 'Pessoas', hint: 'Especialista em retratos — ignora objetos atrás (MODNet)' },
  { id: 'isnet', label: 'Rápido', hint: 'Leve e rápido (IS-Net)' },
];

export const BackgroundRemover: React.FC<BackgroundRemoverProps> = ({
  initialFile,
  onClearInitialFile,
  onSendToTool,
}) => {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Precision & AI settings
  const [aiModel, setAiModel] = useState<BgEngine>('bria');
  const [edgeCleanup, setEdgeCleanup] = useState(15); // 0..85 removes semi-transparent haze

  // View & refine brush state
  const [viewMode, setViewMode] = useState<'compare' | 'refine' | 'result' | 'original'>('compare');
  const [sliderPos, setSliderPos] = useState(50);
  const [brushMode, setBrushMode] = useState<'erase' | 'restore'>('erase');
  const [brushSize, setBrushSize] = useState(44); // in image pixels (relative)
  const [brushSoftness, setBrushSoftness] = useState(40); // 0..100
  const [historyCount, setHistoryCount] = useState(0);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  // Background & export
  const [bgOption, setBgOption] = useState<BgOption>({
    type: 'transparent',
    label: 'Transparente',
  });
  const [customColor, setCustomColor] = useState('#6366f1');
  const [exportFormat, setExportFormat] = useState<'image/png' | 'image/jpeg' | 'image/webp'>(
    'image/png'
  );

  // Internal offscreen canvases for non-destructive edge cleanup & brush editing
  const origCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rawAiDataRef = useRef<ImageData | null>(null);
  const editCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const undoStackRef = useRef<ImageData[]>([]);
  const isPaintingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const compareRef = useRef<HTMLDivElement>(null);
  const isDraggingSlider = useRef(false);

  // Sync display canvas & resultUrl from editCanvas
  const syncPreviewFromEditCanvas = useCallback(async () => {
    const editCanvas = editCanvasRef.current;
    if (!editCanvas) return;

    if (displayCanvasRef.current) {
      const disp = displayCanvasRef.current;
      if (disp.width !== editCanvas.width || disp.height !== editCanvas.height) {
        disp.width = editCanvas.width;
        disp.height = editCanvas.height;
      }
      const dCtx = disp.getContext('2d');
      if (dCtx) {
        dCtx.clearRect(0, 0, disp.width, disp.height);
        dCtx.drawImage(editCanvas, 0, 0);
      }
    }

    const blob = await canvasToBlob(editCanvas, 'image/png');
    const url = URL.createObjectURL(blob);
    setResultUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, []);

  // Apply alpha cleanup threshold to raw AI ImageData and write into editCanvas
  const applyEdgeCleanupToCanvas = useCallback(
    async (cleanupValue: number) => {
      const raw = rawAiDataRef.current;
      const editCanvas = editCanvasRef.current;
      if (!raw || !editCanvas) return;

      const out = new ImageData(new Uint8ClampedArray(raw.data), raw.width, raw.height);
      const data = out.data;

      if (cleanupValue > 0) {
        // Low-alpha cutoff removes faint background haze/ghosts while keeping smooth edges
        const lowCut = Math.round((cleanupValue / 100) * 140);
        const highCut = Math.min(255, lowCut + 75);
        const range = Math.max(1, highCut - lowCut);

        for (let i = 3; i < data.length; i += 4) {
          const a = data[i];
          if (a <= lowCut) {
            data[i] = 0;
          } else if (a < highCut) {
            data[i] = Math.round(((a - lowCut) / range) * 255);
          }
        }
      }

      const ctx = editCanvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, editCanvas.width, editCanvas.height);
      ctx.putImageData(out, 0, 0);

      undoStackRef.current = [];
      setHistoryCount(0);
      await syncPreviewFromEditCanvas();
    },
    [syncPreviewFromEditCanvas]
  );

  const processFile = useCallback(
    async (file: File, modelToUse: BgEngine = aiModel, cleanupVal: number = edgeCleanup) => {
      setSourceFile(file);
      setError(null);
      setResultUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      const origObjectUrl = URL.createObjectURL(file);
      setOriginalUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return origObjectUrl;
      });

      setIsProcessing(true);
      setProgress(5);
      setStatusText('Preparando IA de alta precisão...');

      try {
        const origImg = await loadImage(origObjectUrl);

        // Store original image in offscreen canvas for the Restore brush
        const origCanvas = document.createElement('canvas');
        origCanvas.width = origImg.naturalWidth;
        origCanvas.height = origImg.naturalHeight;
        const origCtx = origCanvas.getContext('2d');
        origCtx?.drawImage(origImg, 0, 0);
        origCanvasRef.current = origCanvas;

        const aiImgData = await removeImageBackground(file, origObjectUrl, modelToUse, (p) => {
          setProgress(p.percent);
          setStatusText(p.message);
        });

        const editCanvas = document.createElement('canvas');
        editCanvas.width = aiImgData.width;
        editCanvas.height = aiImgData.height;
        rawAiDataRef.current = aiImgData;
        editCanvasRef.current = editCanvas;

        await applyEdgeCleanupToCanvas(cleanupVal);
        setViewMode('compare');
        setSliderPos(50);
      } catch (err) {
        console.error(err);
        setError(
          'Não foi possível processar com este modelo. Verifique sua conexão (necessária na 1ª vez para baixar o modelo de IA) ou tente alternar para Pessoas / Rápido.'
        );
      } finally {
        setIsProcessing(false);
        setProgress(100);
      }
    },
    [aiModel, edgeCleanup, applyEdgeCleanupToCanvas]
  );

  useEffect(() => {
    if (initialFile) {
      processFile(initialFile);
      onClearInitialFile?.();
    }
  }, [initialFile, onClearInitialFile, processFile]);

  // Draw editCanvas onto displayCanvas whenever switching to 'refine'
  useEffect(() => {
    if (viewMode === 'refine' && editCanvasRef.current && displayCanvasRef.current) {
      const src = editCanvasRef.current;
      const disp = displayCanvasRef.current;
      disp.width = src.width;
      disp.height = src.height;
      const ctx = disp.getContext('2d');
      ctx?.clearRect(0, 0, disp.width, disp.height);
      ctx?.drawImage(src, 0, 0);
    }
  }, [viewMode, resultUrl]);

  const handleUndo = useCallback(async () => {
    const editCanvas = editCanvasRef.current;
    if (!editCanvas || undoStackRef.current.length === 0) return;
    const prevState = undoStackRef.current.pop()!;
    const ctx = editCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, editCanvas.width, editCanvas.height);
      ctx.putImageData(prevState, 0, 0);
    }
    setHistoryCount(undoStackRef.current.length);
    await syncPreviewFromEditCanvas();
  }, [syncPreviewFromEditCanvas]);

  // Ctrl+Z shortcut for brush refine
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && viewMode === 'refine') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewMode, handleUndo]);

  // Paint brush dab at image coordinates (x, y)
  const paintDab = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) => {
    const innerRatio = Math.max(0.05, 1 - brushSoftness / 100);

    if (brushMode === 'erase') {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      const grad = ctx.createRadialGradient(x, y, radius * innerRatio, x, y, radius);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (origCanvasRef.current) {
      // Restore pixels from origCanvas with soft radial brush
      const d = Math.ceil(radius * 2);
      const stamp = document.createElement('canvas');
      stamp.width = d;
      stamp.height = d;
      const sCtx = stamp.getContext('2d');
      if (!sCtx) return;

      sCtx.drawImage(
        origCanvasRef.current,
        x - radius,
        y - radius,
        d,
        d,
        0,
        0,
        d,
        d
      );
      sCtx.globalCompositeOperation = 'destination-in';
      const grad = sCtx.createRadialGradient(
        radius,
        radius,
        radius * innerRatio,
        radius,
        radius,
        radius
      );
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, d, d);

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(stamp, x - radius, y - radius);
      ctx.restore();
    }
  };

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const disp = displayCanvasRef.current;
    if (!disp) return null;
    const rect = disp.getBoundingClientRect();
    const scaleX = disp.width / rect.width;
    const scaleY = disp.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      displayX: e.clientX - rect.left,
      displayY: e.clientY - rect.top,
      scale: scaleX,
    };
  };

  const paintLine = (from: { x: number; y: number }, to: { x: number; y: number }, scale: number) => {
    const editCanvas = editCanvasRef.current;
    const disp = displayCanvasRef.current;
    if (!editCanvas || !disp) return;
    const eCtx = editCanvas.getContext('2d');
    const dCtx = disp.getContext('2d');
    if (!eCtx || !dCtx) return;

    // brushSize is in screen-relative px; convert to image px so visual cursor matches exact stroke
    const radius = Math.max(2, (brushSize / 2) * scale);
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const step = Math.max(1, radius * 0.25);
    const steps = Math.max(1, Math.ceil(dist / step));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = from.x + (to.x - from.x) * t;
      const py = from.y + (to.y - from.y) * t;
      paintDab(eCtx, px, py, radius);
    }

    dCtx.clearRect(0, 0, disp.width, disp.height);
    dCtx.drawImage(editCanvas, 0, 0);
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getCanvasPoint(e);
    const editCanvas = editCanvasRef.current;
    if (!pt || !editCanvas) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    const eCtx = editCanvas.getContext('2d', { willReadFrequently: true });
    if (eCtx) {
      const snapshot = eCtx.getImageData(0, 0, editCanvas.width, editCanvas.height);
      undoStackRef.current.push(snapshot);
      if (undoStackRef.current.length > 25) undoStackRef.current.shift();
      setHistoryCount(undoStackRef.current.length);
    }

    isPaintingRef.current = true;
    lastPointRef.current = { x: pt.x, y: pt.y };
    paintLine({ x: pt.x, y: pt.y }, { x: pt.x, y: pt.y }, pt.scale);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getCanvasPoint(e);
    if (!pt) return;
    setCursorPos({ x: pt.displayX, y: pt.displayY, visible: true });

    if (isPaintingRef.current && lastPointRef.current) {
      paintLine(lastPointRef.current, { x: pt.x, y: pt.y }, pt.scale);
      lastPointRef.current = { x: pt.x, y: pt.y };
    }
  };

  const handleCanvasPointerUp = async () => {
    if (!isPaintingRef.current) return;
    isPaintingRef.current = false;
    lastPointRef.current = null;
    await syncPreviewFromEditCanvas();
  };

  const handleReset = () => {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setSourceFile(null);
    setOriginalUrl(null);
    setResultUrl(null);
    setError(null);
    setIsProcessing(false);
    undoStackRef.current = [];
    setHistoryCount(0);
    setBgOption({ type: 'transparent', label: 'Transparente' });
  };

  const composeFinalBlob = async (format: string): Promise<Blob | null> => {
    const editCanvas = editCanvasRef.current;
    if (!editCanvas) return null;

    const canvas = document.createElement('canvas');
    canvas.width = editCanvas.width;
    canvas.height = editCanvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (bgOption.type === 'color') {
      ctx.fillStyle = bgOption.value;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (bgOption.type === 'gradient') {
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, bgOption.from);
      grad.addColorStop(1, bgOption.to);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (format === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(editCanvas, 0, 0);
    return canvasToBlob(canvas, format, 0.95);
  };

  const handleDownload = async () => {
    const blob = await composeFinalBlob(exportFormat);
    if (!blob || !sourceFile) return;
    const ext = getExtensionFromMime(exportFormat);
    downloadBlob(blob, `${stripExtension(sourceFile.name)}-sem-fundo.${ext}`);
  };

  const handleForwardTo = async (tool: 'crop' | 'compress') => {
    const blob = await composeFinalBlob('image/png');
    if (!blob || !sourceFile) return;
    const nextFile = new File([blob], `${stripExtension(sourceFile.name)}-sem-fundo.png`, {
      type: 'image/png',
    });
    onSendToTool(tool, nextFile);
  };

  const updateSliderFromClientX = (clientX: number) => {
    if (!compareRef.current) return;
    const rect = compareRef.current.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, pct)));
  };

  const getBgStyle = (): React.CSSProperties => {
    if (bgOption.type === 'color') return { backgroundColor: bgOption.value };
    if (bgOption.type === 'gradient') return { backgroundImage: bgOption.css };
    return {};
  };

  if (!sourceFile) {
    return (
      <div className="space-y-6">
        <DropZone
          onFilesSelected={(files) => processFile(files[0])}
          title="Solte uma imagem para remover o fundo com IA"
          subtitle="PNG, JPG ou WebP • Modelo de Alta Precisão + Pincel Apagar/Restaurar"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              title: 'IA de Alta Precisão',
              desc: 'Usa o modelo completo (FP32) e limpeza automática de resíduos semi-transparentes.',
            },
            {
              title: 'Pincel Apagar / Restaurar',
              desc: 'Remova objetos extras do fundo ou restaure detalhes com 1 clique, igual ao Canva.',
            },
            {
              title: 'Privacidade total',
              desc: 'Suas imagens são processadas 100% no navegador, sem envio para servidores.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4 shadow-xs"
            >
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {item.title}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Canvas / Preview area */}
      <div className="lg:col-span-8 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            {[
              { id: 'compare', label: 'Comparar', icon: SlidersHorizontal },
              { id: 'refine', label: 'Refinar (Pincel)', icon: Eraser },
              { id: 'result', label: 'Resultado', icon: Sparkles },
              { id: 'original', label: 'Original', icon: Eye },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = viewMode === tab.id;
              return (
                <button
                  key={tab.id}
                  disabled={!resultUrl}
                  onClick={() => setViewMode(tab.id as typeof viewMode)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-40'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Nova imagem
          </button>
        </div>

        {/* Refine Brush Toolbar (visible in refine mode) */}
        {viewMode === 'refine' && resultUrl && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200 dark:border-violet-500/30 bg-violet-50/70 dark:bg-violet-950/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBrushMode('erase')}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  brushMode === 'erase'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <Eraser className="h-3.5 w-3.5" />
                Apagar fundo
              </button>
              <button
                onClick={() => setBrushMode('restore')}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  brushMode === 'restore'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <Paintbrush className="h-3.5 w-3.5" />
                Restaurar
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                <span>Tamanho</span>
                <input
                  type="range"
                  min={10}
                  max={140}
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-24 accent-violet-600 cursor-pointer"
                />
                <span className="w-8 text-[11px] font-bold text-violet-700 dark:text-violet-300">
                  {brushSize}px
                </span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                <span>Suavidade</span>
                <input
                  type="range"
                  min={0}
                  max={90}
                  value={brushSoftness}
                  onChange={(e) => setBrushSoftness(Number(e.target.value))}
                  className="w-20 accent-violet-600 cursor-pointer"
                />
              </label>

              <button
                disabled={historyCount === 0}
                onClick={handleUndo}
                title="Desfazer (Ctrl+Z)"
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Desfazer
              </button>
            </div>
          </div>
        )}

        <div className="relative flex min-h-[400px] sm:min-h-[480px] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/90 p-4 shadow-xs">
          {isProcessing && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/75 backdrop-blur-xs text-white p-6 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-violet-400 mb-3" />
              <p className="text-base font-semibold">{statusText}</p>
              <div className="mt-4 h-2 w-64 max-w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all duration-300"
                  style={{ width: `${Math.max(8, progress)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-300">{progress}%</p>
            </div>
          )}

          {error && (
            <div className="z-20 max-w-md rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-white dark:bg-slate-900 p-6 text-center shadow-lg">
              <AlertCircle className="mx-auto h-10 w-10 text-rose-500 mb-2" />
              <p className="text-sm font-semibold text-slate-800 dark:text-white">
                Ops, algo deu errado
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{error}</p>
              <button
                onClick={() => processFile(sourceFile, aiModel, edgeCleanup)}
                className="mt-4 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!error && originalUrl && (!resultUrl || viewMode === 'original') && (
            <img
              src={originalUrl}
              alt="Original"
              className="max-h-[460px] max-w-full rounded-xl object-contain shadow-sm"
            />
          )}

          {!error && resultUrl && viewMode === 'result' && (
            <div
              className={`relative overflow-hidden rounded-xl shadow-sm ${
                bgOption.type === 'transparent' ? 'checkerboard' : ''
              }`}
              style={getBgStyle()}
            >
              <img
                src={resultUrl}
                alt="Sem fundo"
                className="max-h-[460px] max-w-full object-contain block"
              />
            </div>
          )}

          {!error && resultUrl && viewMode === 'refine' && (
            <div
              className={`relative overflow-hidden rounded-xl shadow-sm ${
                bgOption.type === 'transparent' ? 'checkerboard' : ''
              }`}
              style={getBgStyle()}
            >
              <canvas
                ref={displayCanvasRef}
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onPointerLeave={() => {
                  setCursorPos((c) => ({ ...c, visible: false }));
                  if (isPaintingRef.current) handleCanvasPointerUp();
                }}
                className="max-h-[460px] max-w-full block touch-none cursor-none"
                style={{ width: 'auto', height: 'auto' }}
              />
              {cursorPos.visible && (
                <div
                  className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-sm ${
                    brushMode === 'erase'
                      ? 'border-rose-500 bg-rose-500/20'
                      : 'border-emerald-400 bg-emerald-400/20'
                  }`}
                  style={{
                    left: cursorPos.x,
                    top: cursorPos.y,
                    width: brushSize,
                    height: brushSize,
                  }}
                />
              )}
            </div>
          )}

          {!error && resultUrl && originalUrl && viewMode === 'compare' && (
            <div
              ref={compareRef}
              onPointerDown={(e) => {
                isDraggingSlider.current = true;
                (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                updateSliderFromClientX(e.clientX);
              }}
              onPointerMove={(e) => {
                if (isDraggingSlider.current) updateSliderFromClientX(e.clientX);
              }}
              onPointerUp={() => {
                isDraggingSlider.current = false;
              }}
              className={`relative select-none overflow-hidden rounded-xl shadow-sm cursor-ew-resize ${
                bgOption.type === 'transparent' ? 'checkerboard' : ''
              }`}
              style={getBgStyle()}
            >
              <img
                src={resultUrl}
                alt="Resultado"
                draggable={false}
                className="max-h-[460px] max-w-full object-contain block pointer-events-none"
              />
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
              >
                <img
                  src={originalUrl}
                  alt="Original"
                  draggable={false}
                  className="h-full w-full object-contain block"
                />
              </div>

              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)] pointer-events-none"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-violet-600 text-white shadow-md">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
              </div>

              <span className="pointer-events-none absolute top-3 left-3 rounded-lg bg-slate-900/75 px-2.5 py-1 text-[11px] font-semibold text-white">
                Antes
              </span>
              <span className="pointer-events-none absolute top-3 right-3 rounded-lg bg-violet-600/90 px-2.5 py-1 text-[11px] font-semibold text-white">
                Depois
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Controls Sidebar */}
      <div className="lg:col-span-4 space-y-4">
        {/* Precision & Edge Cleanup Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              Precisão da IA
            </h3>
            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
              {MODEL_OPTIONS.map((m) => (
                <button
                  key={m.id}
                  disabled={isProcessing}
                  onClick={() => {
                    setAiModel(m.id);
                    if (sourceFile) processFile(sourceFile, m.id, edgeCleanup);
                  }}
                  title={m.hint}
                  className={`rounded-xl border px-2 py-2 text-[11px] font-semibold transition ${
                    aiModel === m.id
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
              {MODEL_OPTIONS.find((m) => m.id === aiModel)?.hint}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Limpeza de resíduos / bordas
              </span>
              <span className="rounded-md bg-violet-50 dark:bg-violet-500/15 px-2 py-0.5 text-[11px] font-bold text-violet-700 dark:text-violet-300">
                {edgeCleanup}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={85}
              step={5}
              disabled={!resultUrl || isProcessing}
              value={edgeCleanup}
              onChange={(e) => {
                const val = Number(e.target.value);
                setEdgeCleanup(val);
                applyEdgeCleanupToCanvas(val);
              }}
              className="mt-1.5 w-full accent-violet-600 cursor-pointer disabled:opacity-40"
            />
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              Remove névoas e halos semi-transparentes ao redor do recorte.
            </p>
          </div>

          {resultUrl && (
            <button
              onClick={() => setViewMode(viewMode === 'refine' ? 'compare' : 'refine')}
              className={`flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                viewMode === 'refine'
                  ? 'border-violet-500 bg-violet-600 text-white'
                  : 'border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-500/20'
              }`}
            >
              <Eraser className="h-3.5 w-3.5" />
              {viewMode === 'refine' ? 'Concluir retoque com pincel' : 'Retocar com Pincel (Apagar / Restaurar)'}
            </button>
          )}
        </div>

        {/* Background & Export Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-violet-500" />
              Plano de Fundo
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Escolha transparente ou substitua por uma cor ou gradiente.
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Cores sólidas
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                title="Transparente"
                onClick={() => setBgOption({ type: 'transparent', label: 'Transparente' })}
                className={`h-8 w-8 rounded-lg border checkerboard-sm transition ${
                  bgOption.type === 'transparent'
                    ? 'ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-slate-900 border-violet-500'
                    : 'border-slate-300 dark:border-slate-700 hover:scale-105'
                }`}
              />
              {SOLID_COLORS.map((c) => {
                if (c.type !== 'color') return null;
                const active = bgOption.type === 'color' && bgOption.value === c.value;
                return (
                  <button
                    key={c.value}
                    title={c.label}
                    onClick={() => setBgOption(c)}
                    style={{ backgroundColor: c.value }}
                    className={`h-8 w-8 rounded-lg border transition ${
                      active
                        ? 'ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-slate-900 border-violet-500'
                        : 'border-slate-300 dark:border-slate-700 hover:scale-105'
                    }`}
                  />
                );
              })}
              <label
                title="Cor personalizada"
                className="relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700 bg-gradient-to-tr from-rose-500 via-amber-400 to-cyan-500 hover:scale-105 transition"
              >
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => {
                    setCustomColor(e.target.value);
                    setBgOption({
                      type: 'color',
                      label: 'Personalizada',
                      value: e.target.value,
                    });
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <span className="text-[10px] font-bold text-white drop-shadow">+</span>
              </label>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Gradientes
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {GRADIENTS.map((g) => {
                if (g.type !== 'gradient') return null;
                const active = bgOption.type === 'gradient' && bgOption.label === g.label;
                return (
                  <button
                    key={g.label}
                    title={g.label}
                    onClick={() => setBgOption(g)}
                    style={{ backgroundImage: g.css }}
                    className={`h-8 w-11 rounded-lg border transition ${
                      active
                        ? 'ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-slate-900 border-violet-500'
                        : 'border-slate-200 dark:border-slate-700 hover:scale-105'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-800" />

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Formato de download
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
            {exportFormat === 'image/jpeg' && bgOption.type === 'transparent' && (
              <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                JPG não suporta transparência — o fundo será exportado em branco.
              </p>
            )}
          </div>

          <button
            disabled={!resultUrl || isProcessing}
            onClick={handleDownload}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-violet-200 dark:shadow-violet-950/60 transition hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            Baixar Imagem
          </button>

          {resultUrl && (
            <div className="pt-1 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Continuar editando
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleForwardTo('crop')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-300"
                >
                  <Crop className="h-3.5 w-3.5" />
                  Recortar
                </button>
                <button
                  onClick={() => handleForwardTo('compress')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-300"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                  Comprimir
                </button>
              </div>
              {historyCount > 0 && (
                <button
                  onClick={() => applyEdgeCleanupToCanvas(edgeCleanup)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  <RefreshCw className="h-3 w-3" />
                  Resetar retoques do pincel
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
