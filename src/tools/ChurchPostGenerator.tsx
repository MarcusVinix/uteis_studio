import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Download,
  Sparkles,
  Image as ImageIcon,
  Settings2,
  Upload,
  Trash2,
  Loader2,
  Check,
  Palette,
  LayoutTemplate,
  UserCircle2,
} from 'lucide-react';
import {
  CHURCH_TEMPLATES,
  CHURCH_BACKGROUNDS,
  CATEGORY_LABELS,
  POST_FORMATS,
  DEFAULT_CHURCH_PROFILE,
  type ChurchCategory,
  type ChurchProfile,
  type ChurchTemplate,
  type PostFormatId,
  type TextureStyle,
  type FrameStyle,
} from '../utils/churchAssets';
import { renderChurchPost } from '../utils/churchPostRenderer';
import { removeImageBackground } from '../utils/aiBackgroundRemover';
import { canvasToBlob, downloadBlob } from '../utils/imageHelpers';

interface ChurchPostGeneratorProps {
  initialPreacherFile?: File | null;
  onClearInitialFile?: () => void;
}

const PROFILE_STORAGE_KEY = 'uteis-church-profile-v1';

function fileToDataUrl(file: File, maxDim = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxDim || h > maxDim) {
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
        ctx?.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function removeBgFromFileToDataUrl(file: File): Promise<string> {
  const objUrl = URL.createObjectURL(file);
  try {
    const imgData = await removeImageBackground(file, objUrl, 'portrait');
    const canvas = document.createElement('canvas');
    canvas.width = imgData.width;
    canvas.height = imgData.height;
    const ctx = canvas.getContext('2d');
    ctx?.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}

export const ChurchPostGenerator: React.FC<ChurchPostGeneratorProps> = ({
  initialPreacherFile,
  onClearInitialFile,
}) => {
  const [activeTab, setActiveTab] = useState<'dados' | 'acervo' | 'perfil'>('dados');
  const [selectedCategory, setSelectedCategory] = useState<ChurchCategory>('jovens');
  const [template, setTemplate] = useState<ChurchTemplate>(CHURCH_TEMPLATES[0]);
  const [formatId, setFormatId] = useState<PostFormatId>('feed45');

  // Saved Church Profile (persisted in localStorage)
  const [profile, setProfile] = useState<ChurchProfile>(() => {
    try {
      const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (saved) return { ...DEFAULT_CHURCH_PROFILE, ...JSON.parse(saved) };
    } catch {
      // ignore
    }
    return DEFAULT_CHURCH_PROFILE;
  });

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // storage quota full — ignore silently
    }
  }, [profile]);

  // Dynamic Post Fields
  const [eyebrow, setEyebrow] = useState(template.defaultEyebrow);
  const [title, setTitle] = useState(template.defaultTitle);
  const [subtitle, setSubtitle] = useState(template.defaultSubtitle);
  const [dateText, setDateText] = useState(template.defaultDateText);
  const [verse, setVerse] = useState(template.defaultVerse);
  const [preacherRole, setPreacherRole] = useState('PREGADOR');
  const [preacherName, setPreacherName] = useState('Pr. Edson');
  const [preacherPhotoUrl, setPreacherPhotoUrl] = useState<string | null>(null);
  const [preacherFile, setPreacherFile] = useState<File | null>(null);
  const [preacherZoom, setPreacherZoom] = useState(100);
  const [preacherOffsetY, setPreacherOffsetY] = useState(0);

  const [showLocalPastors, setShowLocalPastors] = useState(true);
  const [showPresidentPastors, setShowPresidentPastors] = useState(true);
  const [showCircleLeader, setShowCircleLeader] = useState(template.defaultShowCircleLeader);
  const [showFoodBadge, setShowFoodBadge] = useState(template.defaultShowFoodBadge);
  const [foodBadgeText, setFoodBadgeText] = useState('Trazer 1kg\nde Alimento');

  // Visual / Asset overrides
  const [backgroundId, setBackgroundId] = useState(template.backgroundId);
  const [customBgUrl, setCustomBgUrl] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState(template.accentColor);
  const [bgDim, setBgDim] = useState(template.defaultDim);
  const [texture, setTexture] = useState<TextureStyle>(template.defaultTexture);
  const [frame, setFrame] = useState<FrameStyle>(template.defaultFrame);

  // Busy states for built-in AI bg removal
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<'image/png' | 'image/jpeg'>('image/png');
  const [savedNotice, setSavedNotice] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const currentFormat = POST_FORMATS.find((f) => f.id === formatId) ?? POST_FORMATS[0];
  const currentBg =
    CHURCH_BACKGROUNDS.find((b) => b.id === backgroundId) ?? CHURCH_BACKGROUNDS[0];

  // Apply template preset cleanly
  const applyTemplate = (tpl: ChurchTemplate) => {
    setTemplate(tpl);
    setSelectedCategory(tpl.category);
    setBackgroundId(tpl.backgroundId);
    setCustomBgUrl(null);
    setAccentColor(tpl.accentColor);
    setBgDim(tpl.defaultDim);
    setTexture(tpl.defaultTexture);
    setFrame(tpl.defaultFrame);
    setEyebrow(tpl.defaultEyebrow);
    setTitle(tpl.defaultTitle);
    setSubtitle(tpl.defaultSubtitle);
    setDateText(tpl.defaultDateText);
    setVerse(tpl.defaultVerse);
    setShowFoodBadge(tpl.defaultShowFoodBadge);
    setShowCircleLeader(tpl.defaultShowCircleLeader);
  };

  // Accept forwarded cutout image from BackgroundRemover
  useEffect(() => {
    if (initialPreacherFile) {
      const url = URL.createObjectURL(initialPreacherFile);
      setPreacherPhotoUrl((prev) => {
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
        return url;
      });
      setPreacherFile(initialPreacherFile);
      onClearInitialFile?.();
    }
  }, [initialPreacherFile, onClearInitialFile]);

  // Live Canvas Render
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderChurchPost(
      canvas,
      {
        template,
        background: currentBg,
        customBgUrl,
        width: currentFormat.width,
        height: currentFormat.height,
        eyebrow,
        title,
        subtitle,
        dateText,
        verse,
        preacherRole,
        preacherName,
        preacherPhotoUrl,
        preacherZoom,
        preacherOffsetY,
        showLocalPastors,
        showPresidentPastors,
        showCircleLeader,
        showFoodBadge,
        foodBadgeText,
        accentColor,
        bgDim,
        texture,
        frame,
      },
      profile
    );
  }, [
    template,
    currentBg,
    customBgUrl,
    currentFormat,
    eyebrow,
    title,
    subtitle,
    dateText,
    verse,
    preacherRole,
    preacherName,
    preacherPhotoUrl,
    preacherZoom,
    preacherOffsetY,
    showLocalPastors,
    showPresidentPastors,
    showCircleLeader,
    showFoodBadge,
    foodBadgeText,
    accentColor,
    bgDim,
    texture,
    frame,
    profile,
  ]);

  useEffect(() => {
    const id = requestAnimationFrame(() => redraw());
    return () => cancelAnimationFrame(id);
  }, [redraw]);

  const handleDownload = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await canvasToBlob(canvas, exportFormat, 0.95);
    const ext = exportFormat === 'image/jpeg' ? 'jpg' : 'png';
    const slug = (title || 'post-igreja')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-');
    downloadBlob(blob, `${slug}-${formatId}.${ext}`);
  };

  const handlePreacherUpload = (file: File) => {
    setPreacherFile(file);
    const url = URL.createObjectURL(file);
    setPreacherPhotoUrl((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return url;
    });
  };

  const handleRemovePreacherBg = async () => {
    if (!preacherFile) return;
    setBusySlot('preacher');
    try {
      const dataUrl = await removeBgFromFileToDataUrl(preacherFile);
      setPreacherPhotoUrl(dataUrl);
    } finally {
      setBusySlot(null);
    }
  };

  const handleProfilePhotoUpload = async (
    slot: 'logoDataUrl' | 'localPastorsPhoto' | 'presidentPastorsPhoto' | 'circleLeaderPhoto',
    file: File,
    autoRemoveBg: boolean
  ) => {
    setBusySlot(slot);
    try {
      const dataUrl = autoRemoveBg
        ? await removeBgFromFileToDataUrl(file)
        : await fileToDataUrl(file, slot === 'logoDataUrl' ? 400 : 800);
      setProfile((prev) => ({ ...prev, [slot]: dataUrl }));
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    } finally {
      setBusySlot(null);
    }
  };

  const categoryTemplates = CHURCH_TEMPLATES.filter((t) => t.category === selectedCategory);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left: Live Poster Preview */}
      <div className="lg:col-span-6 xl:col-span-7 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shadow-xs">
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            {POST_FORMATS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFormatId(f.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  formatId === f.id
                    ? 'bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {f.label} ({f.ratioLabel})
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'image/png' | 'image/jpeg')}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              <option value="image/png">PNG</option>
              <option value="image/jpeg">JPG</option>
            </select>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:from-violet-700 hover:to-indigo-700"
            >
              <Download className="h-3.5 w-3.5" />
              Baixar Post
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/90 p-4 sm:p-6 shadow-xs">
          <canvas
            ref={canvasRef}
            className="max-h-[680px] w-auto max-w-full rounded-xl shadow-2xl border border-black/10 dark:border-white/10"
          />
        </div>
      </div>

      {/* Right: Editor Controls */}
      <div className="lg:col-span-6 xl:col-span-5 space-y-4">
        {/* Sub-navigation Tabs */}
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-xs">
          {[
            { id: 'dados', label: 'Dados do Culto', icon: LayoutTemplate },
            { id: 'acervo', label: 'Acervo & Fundo', icon: Palette },
            { id: 'perfil', label: 'Perfil da Igreja', icon: UserCircle2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: DADOS DO CULTO */}
        {activeTab === 'dados' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-5">
            {/* Category Pills */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                1. Tipo de Culto
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_LABELS.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      const first = CHURCH_TEMPLATES.find((t) => t.category === cat.id);
                      if (first) applyTemplate(first);
                    }}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                      selectedCategory === cat.id
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Template variations for selected category */}
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                {categoryTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => applyTemplate(tpl)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                      template.id === tpl.id
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span
                      className="h-4 w-4 shrink-0 rounded-full border border-white/30"
                      style={{ backgroundColor: tpl.accentColor }}
                    />
                    <span className="truncate">{tpl.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <hr className="border-slate-100 dark:border-slate-800" />

            {/* Texts */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                2. Informações do Culto
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Chamada / Acima do título
                  </label>
                  <input
                    value={eyebrow}
                    onChange={(e) => setEyebrow(e.target.value)}
                    placeholder="Ex: CULTO DE"
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-800 dark:text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Título Principal
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: JOVENS"
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Subtítulo (opcional)
                  </label>
                  <input
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Ex: Não perca!"
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Data e Horário
                  </label>
                  <input
                    value={dateText}
                    onChange={(e) => setDateText(e.target.value)}
                    placeholder="DOMINGO • 22/11 • 18H00"
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Versículo ou Tema (opcional)
                </label>
                <input
                  value={verse}
                  onChange={(e) => setVerse(e.target.value)}
                  placeholder='Ex: "Eu e a minha casa serviremos ao Senhor." — Josué 24:15'
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-white focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>

            <hr className="border-slate-100 dark:border-slate-800" />

            {/* Preacher Section */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                3. Pregador(a) / Convidado(a)
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  value={preacherRole}
                  onChange={(e) => setPreacherRole(e.target.value)}
                  placeholder="Cargo (Ex: PREGADOR)"
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-white focus:border-violet-500 focus:outline-none"
                />
                <input
                  value={preacherName}
                  onChange={(e) => setPreacherName(e.target.value)}
                  placeholder="Nome (Ex: Pr. Edson)"
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-violet-400">
                  <Upload className="h-3.5 w-3.5" />
                  {preacherPhotoUrl ? 'Trocar foto' : 'Subir foto do pregador'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePreacherUpload(f);
                      e.target.value = '';
                    }}
                  />
                </label>

                {preacherFile && (
                  <button
                    disabled={busySlot === 'preacher'}
                    onClick={handleRemovePreacherBg}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600/15 border border-violet-500/30 px-3 py-2 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-600/25 disabled:opacity-50"
                  >
                    {busySlot === 'preacher' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Remover fundo (IA)
                  </button>
                )}

                {preacherPhotoUrl && (
                  <button
                    onClick={() => {
                      setPreacherPhotoUrl(null);
                      setPreacherFile(null);
                    }}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-slate-400 hover:text-rose-500"
                    title="Remover foto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {preacherPhotoUrl && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Zoom ({preacherZoom}%)
                    <input
                      type="range"
                      min={70}
                      max={145}
                      value={preacherZoom}
                      onChange={(e) => setPreacherZoom(Number(e.target.value))}
                      className="mt-1 w-full accent-violet-600"
                    />
                  </label>
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Posição Vertical
                    <input
                      type="range"
                      min={-120}
                      max={120}
                      value={preacherOffsetY}
                      onChange={(e) => setPreacherOffsetY(Number(e.target.value))}
                      className="mt-1 w-full accent-violet-600"
                    />
                  </label>
                </div>
              )}
            </div>

            <hr className="border-slate-100 dark:border-slate-800" />

            {/* Quick Elements Toggles */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                4. Elementos no Post
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    label: 'Prs. Locais',
                    checked: showLocalPastors,
                    onChange: setShowLocalPastors,
                  },
                  {
                    label: 'Prs. Presidentes',
                    checked: showPresidentPastors,
                    onChange: setShowPresidentPastors,
                  },
                  {
                    label: 'Dirigente Círc. Oração',
                    checked: showCircleLeader,
                    onChange: setShowCircleLeader,
                  },
                  {
                    label: 'Selo 1kg Alimento',
                    checked: showFoodBadge,
                    onChange: setShowFoodBadge,
                  },
                ].map((opt) => (
                  <label
                    key={opt.label}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700/80 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={opt.checked}
                      onChange={(e) => opt.onChange(e.target.checked)}
                      className="accent-violet-600 rounded"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              {showFoodBadge && (
                <input
                  value={foodBadgeText.replace('\n', ' ')}
                  onChange={(e) => setFoodBadgeText(e.target.value.replace(' de ', '\nde '))}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-white"
                  placeholder="Texto do selo (ex: Trazer 1kg de Alimento)"
                />
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ACERVO & FUNDO */}
        {activeTab === 'acervo' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Acervo de Fundos Embutidos
                </p>
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-violet-50 dark:bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-100">
                  <Upload className="h-3 w-3" />
                  Subir fundo próprio
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        const url = URL.createObjectURL(f);
                        setCustomBgUrl(url);
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {CHURCH_BACKGROUNDS.map((bg) => {
                  const active = !customBgUrl && backgroundId === bg.id;
                  return (
                    <button
                      key={bg.id}
                      onClick={() => {
                        setCustomBgUrl(null);
                        setBackgroundId(bg.id);
                      }}
                      className={`group relative aspect-[4/5] overflow-hidden rounded-xl border text-left transition ${
                        active
                          ? 'ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-slate-900 border-violet-500'
                          : 'border-slate-200 dark:border-slate-700 hover:scale-[1.03]'
                      }`}
                    >
                      {bg.type === 'image' && bg.src ? (
                        <img
                          src={bg.src}
                          alt={bg.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="h-full w-full"
                          style={{
                            backgroundImage: `linear-gradient(135deg, ${bg.colors?.[0]}, ${bg.colors?.[1]})`,
                          }}
                        />
                      )}
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-1.5 py-1 text-[10px] font-semibold text-white truncate">
                        {bg.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <hr className="border-slate-100 dark:border-slate-800" />

            {/* Accent Color */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Cor de Destaque
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  '#facc15',
                  '#e2ff66',
                  '#f59e0b',
                  '#ff512f',
                  '#9f2c48',
                  '#f3d19c',
                  '#38bdf8',
                  '#a855f7',
                  '#ffffff',
                ].map((c) => (
                  <button
                    key={c}
                    onClick={() => setAccentColor(c)}
                    style={{ backgroundColor: c }}
                    className={`h-7 w-7 rounded-lg border transition ${
                      accentColor === c
                        ? 'ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-slate-900 border-violet-500'
                        : 'border-slate-300 dark:border-slate-700'
                    }`}
                  />
                ))}
                <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-gradient-to-tr from-rose-500 via-amber-400 to-cyan-500">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <span className="text-[10px] font-bold text-white">+</span>
                </label>
              </div>
            </div>

            {/* Dimmer */}
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300">
                <span>Escurecer fundo (melhora leitura)</span>
                <span className="font-bold text-violet-600 dark:text-violet-400">{bgDim}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={75}
                value={bgDim}
                onChange={(e) => setBgDim(Number(e.target.value))}
                className="mt-1.5 w-full accent-violet-600"
              />
            </div>

            {/* Textures & Frames */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Textura / Adorno
                </p>
                <select
                  value={texture}
                  onChange={(e) => setTexture(e.target.value as TextureStyle)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  <option value="none">Nenhuma</option>
                  <option value="grain">Granulado / Grunge</option>
                  <option value="paper">Textura Papel</option>
                  <option value="sparkles">Estrelas / Brilhos</option>
                </select>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Moldura
                </p>
                <select
                  value={frame}
                  onChange={(e) => setFrame(e.target.value as FrameStyle)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  <option value="none">Sem moldura</option>
                  <option value="thin">Linha Fina</option>
                  <option value="double">Moldura Dupla</option>
                  <option value="corners">Cantos Elegantes</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PERFIL DA IGREJA (SAVED IN BROWSER) */}
        {activeTab === 'perfil' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Settings2 className="h-4 w-4 text-violet-500" />
                  Dados Fixos da Igreja
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Salvo automaticamente neste navegador para você não precisar preencher todo mês.
                </p>
              </div>
              {savedNotice && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-500">
                  <Check className="h-3 w-3" /> Salvo
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Nome da Igreja
                </label>
                <input
                  value={profile.churchName}
                  onChange={(e) => setProfile((p) => ({ ...p, churchName: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Endereço Completo
                </label>
                <input
                  value={profile.address}
                  onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-white"
                />
              </div>

              {/* Logo upload */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                <div className="flex items-center gap-3">
                  {profile.logoDataUrl ? (
                    <img
                      src={profile.logoDataUrl}
                      alt="Logo"
                      className="h-11 w-11 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-white">
                      Logo da Igreja
                    </p>
                    <p className="text-[11px] text-slate-500">Canto superior direito</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="cursor-pointer rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-700">
                    {profile.logoDataUrl ? 'Trocar' : 'Enviar'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleProfilePhotoUpload('logoDataUrl', f, false);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {profile.logoDataUrl && (
                    <button
                      onClick={() => setProfile((p) => ({ ...p, logoDataUrl: null }))}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Pastors & Leaders Photo Slots */}
              {(
                [
                  {
                    slot: 'localPastorsPhoto' as const,
                    labelKey: 'localPastorsLabel' as const,
                    title: 'Prs. Locais',
                  },
                  {
                    slot: 'presidentPastorsPhoto' as const,
                    labelKey: 'presidentPastorsLabel' as const,
                    title: 'Prs. Presidentes',
                  },
                  {
                    slot: 'circleLeaderPhoto' as const,
                    labelKey: 'circleLeaderLabel' as const,
                    title: 'Dirigente Círculo de Oração',
                  },
                ] as const
              ).map((item) => (
                <div
                  key={item.slot}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      {profile[item.slot] ? (
                        <img
                          src={profile[item.slot]!}
                          alt={item.title}
                          className="h-11 w-11 rounded-lg object-cover checkerboard-sm border border-slate-200 dark:border-slate-700"
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400">
                          <UserCircle2 className="h-5 w-5" />
                        </div>
                      )}
                      <p className="text-xs font-bold text-slate-800 dark:text-white">
                        {item.title}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <label className="cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-violet-400">
                        Foto já recortada
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleProfilePhotoUpload(item.slot, f, false);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-violet-600/15 border border-violet-500/30 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-600/25">
                        {busySlot === item.slot ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        Subir e recortar
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleProfilePhotoUpload(item.slot, f, true);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {profile[item.slot] && (
                        <button
                          onClick={() => setProfile((p) => ({ ...p, [item.slot]: null }))}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 p-1 text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    value={profile[item.labelKey]}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, [item.labelKey]: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 resize-none"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
