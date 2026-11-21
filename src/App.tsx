import { useState, useEffect } from 'react';
import { Sparkles, Crop, Minimize2, ShieldCheck, Wand2, Sun, Moon } from 'lucide-react';
import { BackgroundRemover } from './tools/BackgroundRemover';
import { ImageCropResize } from './tools/ImageCropResize';
import { ImageCompressor } from './tools/ImageCompressor';

type ToolId = 'bg' | 'crop' | 'compress';

const TOOLS: {
  id: ToolId;
  name: string;
  shortName: string;
  description: string;
  icon: typeof Sparkles;
  badge?: string;
}[] = [
  {
    id: 'bg',
    name: 'Removedor de Fundo',
    shortName: 'Remover Fundo',
    description:
      'Remova o fundo com IA de alta precisão, refine com pincel apagar/restaurar e troque o fundo.',
    icon: Sparkles,
    badge: 'IA',
  },
  {
    id: 'crop',
    name: 'Recortar & Redimensionar',
    shortName: 'Recortar',
    description: 'Ajuste proporções para redes sociais, gire, espelhe e defina o tamanho exato.',
    icon: Crop,
  },
  {
    id: 'compress',
    name: 'Comprimir & Converter',
    shortName: 'Comprimir',
    description: 'Reduza o peso de várias imagens de uma vez e converta para WebP, JPG ou PNG.',
    icon: Minimize2,
  },
];

export default function App() {
  const [activeTool, setActiveTool] = useState<ToolId>('bg');
  const [transferredFile, setTransferredFile] = useState<File | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('uteis-theme');
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('uteis-theme', theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const handleSendToTool = (target: ToolId, file: File) => {
    setTransferredFile(file);
    setActiveTool(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentTool = TOOLS.find((t) => t.id === activeTool)!;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-slate-950/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 via-violet-600 to-indigo-600 text-white shadow-sm">
              <Wand2 className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                Úteis<span className="text-violet-600 dark:text-violet-400">Studio</span>
              </span>
              <span className="hidden sm:inline-block ml-2 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Ferramentas de Imagem
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">100% no navegador • Sem enviar dados</span>
              <span className="sm:hidden">100% Privado</span>
            </div>

            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 shadow-xs transition hover:border-violet-400 dark:hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {/* Tool Navigation Tabs */}
        <div className="mb-8 flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              const isActive = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  className={`group flex items-start gap-3.5 rounded-2xl border p-4 text-left transition-all ${
                    isActive
                      ? 'border-violet-500 bg-white dark:bg-slate-900 shadow-md shadow-violet-100/80 dark:shadow-violet-950/40 ring-1 ring-violet-500/25'
                      : 'border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-900'
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
                      isActive
                        ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-violet-50 dark:group-hover:bg-violet-500/15 group-hover:text-violet-600 dark:group-hover:text-violet-400'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-bold ${
                          isActive
                            ? 'text-violet-950 dark:text-white'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {tool.name}
                      </span>
                      {tool.badge && (
                        <span className="rounded-md bg-gradient-to-r from-cyan-500 to-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {tool.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {tool.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-4">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white sm:text-2xl">
                {currentTool.name}
              </h1>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {currentTool.description}
              </p>
            </div>
          </div>
        </div>

        {/* Active Tool View */}
        {activeTool === 'bg' && (
          <BackgroundRemover
            initialFile={transferredFile}
            onClearInitialFile={() => setTransferredFile(null)}
            onSendToTool={(target, file) => handleSendToTool(target, file)}
          />
        )}

        {activeTool === 'crop' && (
          <ImageCropResize
            initialFile={transferredFile}
            onClearInitialFile={() => setTransferredFile(null)}
            onSendToTool={(target, file) => handleSendToTool(target, file)}
          />
        )}

        {activeTool === 'compress' && (
          <ImageCompressor
            initialFile={transferredFile}
            onClearInitialFile={() => setTransferredFile(null)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-950 py-5 text-center text-xs text-slate-400 dark:text-slate-500">
        Úteis Studio — Processamento 100% local no navegador. Nenhuma imagem é enviada para servidores.
      </footer>
    </div>
  );
}
