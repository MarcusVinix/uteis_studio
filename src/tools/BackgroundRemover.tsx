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
} from 'lucide-react';
import { DropZone } from '../components/DropZone';
import {
  downloadBlob,
  stripExtension,
  getExtensionFromMime,
  loadImage,
  canvasToBlob,
} from '../utils/imageHelpers';

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

  const [viewMode, setViewMode] = useState<'result' | 'compare' | 'original'>('result');
  const [sliderPos, setSliderPos] = useState(50);
  const [bgOption, setBgOption] = useState<BgOption>({
    type: 'transparent',
    label: 'Transparente',
  });
  const [customColor, setCustomColor] = useState('#6366f1');
  const [exportFormat, setExportFormat] = useState<'image/png' | 'image/jpeg' | 'image/webp'>(
    'image/png'
  );

  const compareRef = useRef<HTMLDivElement>(null);
  const isDraggingSlider = useRef(false);

  const processFile = useCallback(async (file: File) => {
    setSourceFile(file);
    setError(null);
    setResultUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setOriginalUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });

    setIsProcessing(true);
    setProgress(5);
    setStatusText('Carregando IA no navegador...');

    try {
      const { removeBackground } = await import('@imgly/background-removal');
      const blob = await removeBackground(file, {
        progress: (key: string, current: number, total: number) => {
          if (total > 0) {
            const pct = Math.min(99, Math.round((current / total) * 100));
            setProgress(pct);
          }
          if (key.toLowerCase().includes('fetch')) {
            setStatusText('Baixando modelo de IA (apenas na 1ª vez)...');
          } else {
            setStatusText('Removendo o fundo da imagem...');
          }
        },
        output: {
          format: 'image/png',
        },
      });
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setViewMode('compare');
      setSliderPos(50);
    } catch (err) {
      console.error(err);
      setError(
        'Não foi possível remover o fundo desta imagem. Verifique sua conexão (necessária na 1ª vez para baixar o modelo de IA) ou tente outra imagem.'
      );
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  }, []);

  useEffect(() => {
    if (initialFile) {
      processFile(initialFile);
      onClearInitialFile?.();
    }
  }, [initialFile, onClearInitialFile, processFile]);

  const handleReset = () => {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setSourceFile(null);
    setOriginalUrl(null);
    setResultUrl(null);
    setError(null);
    setIsProcessing(false);
    setBgOption({ type: 'transparent', label: 'Transparente' });
  };

  const composeFinalBlob = async (format: string): Promise<Blob | null> => {
    if (!resultUrl) return null;
    const img = await loadImage(resultUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
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

    ctx.drawImage(img, 0, 0);
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
          subtitle="PNG, JPG ou WebP • 100% gratuito e privado (roda direto no seu navegador)"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              title: 'Privacidade total',
              desc: 'Suas imagens nunca são enviadas para servidores externos.',
            },
            {
              title: 'Fundo personalizável',
              desc: 'Exporte com fundo transparente, cor sólida ou gradiente.',
            },
            {
              title: 'Pronto para editar',
              desc: 'Envie o resultado direto para recortar ou comprimir em 1 clique.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs"
            >
              <p className="text-sm font-semibold text-slate-800">{item.title}</p>
              <p className="mt-1 text-xs text-slate-500">{item.desc}</p>
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
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            {[
              { id: 'compare', label: 'Comparar', icon: SlidersHorizontal },
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
                      ? 'bg-white text-violet-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 disabled:opacity-40'
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
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Nova imagem
          </button>
        </div>

        <div className="relative flex min-h-[380px] sm:min-h-[460px] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-4 shadow-xs">
          {isProcessing && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-xs text-white p-6 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-violet-300 mb-3" />
              <p className="text-base font-semibold">{statusText}</p>
              <div className="mt-4 h-2 w-64 max-w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400 transition-all duration-300"
                  style={{ width: `${Math.max(8, progress)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-200">{progress}%</p>
            </div>
          )}

          {error && (
            <div className="z-20 max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-lg">
              <AlertCircle className="mx-auto h-10 w-10 text-rose-500 mb-2" />
              <p className="text-sm font-semibold text-slate-800">Ops, algo deu errado</p>
              <p className="mt-1 text-xs text-slate-600">{error}</p>
              <button
                onClick={() => processFile(sourceFile)}
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
              className="max-h-[440px] max-w-full rounded-xl object-contain shadow-sm"
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
                className="max-h-[440px] max-w-full object-contain block"
              />
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
              {/* Result image (full underneath) */}
              <img
                src={resultUrl}
                alt="Resultado"
                draggable={false}
                className="max-h-[440px] max-w-full object-contain block pointer-events-none"
              />
              {/* Original image (clipped on the left) */}
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

              {/* Divider line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)] pointer-events-none"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-violet-600 text-white shadow-md">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
              </div>

              <span className="pointer-events-none absolute top-3 left-3 rounded-lg bg-slate-900/70 px-2.5 py-1 text-[11px] font-semibold text-white">
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
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-violet-600" />
              Plano de Fundo
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Escolha transparente ou substitua por uma cor ou gradiente.
            </p>
          </div>

          {/* Transparent + Solid colors */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Cores sólidas
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                title="Transparente"
                onClick={() => setBgOption({ type: 'transparent', label: 'Transparente' })}
                className={`h-8 w-8 rounded-lg border checkerboard-sm transition ${
                  bgOption.type === 'transparent'
                    ? 'ring-2 ring-violet-600 ring-offset-2 border-violet-600'
                    : 'border-slate-300 hover:scale-105'
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
                        ? 'ring-2 ring-violet-600 ring-offset-2 border-violet-600'
                        : 'border-slate-300 hover:scale-105'
                    }`}
                  />
                );
              })}
              <label
                title="Cor personalizada"
                className="relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-slate-300 bg-gradient-to-tr from-rose-500 via-amber-400 to-cyan-500 hover:scale-105 transition"
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

          {/* Gradients */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
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
                        ? 'ring-2 ring-violet-600 ring-offset-2 border-violet-600'
                        : 'border-slate-200 hover:scale-105'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Export format */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
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
                      ? 'border-violet-600 bg-violet-50 text-violet-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {fmt.label}
                </button>
              ))}
            </div>
            {exportFormat === 'image/jpeg' && bgOption.type === 'transparent' && (
              <p className="mt-1.5 text-[11px] text-amber-600">
                JPG não suporta transparência — o fundo será exportado em branco.
              </p>
            )}
          </div>

          <button
            disabled={!resultUrl || isProcessing}
            onClick={handleDownload}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-violet-200 transition hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            Baixar Imagem
          </button>

          {resultUrl && (
            <div className="pt-1 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Continuar editando
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleForwardTo('crop')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                >
                  <Crop className="h-3.5 w-3.5" />
                  Recortar
                </button>
                <button
                  onClick={() => handleForwardTo('compress')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                  Comprimir
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
