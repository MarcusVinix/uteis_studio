import React, { useRef, useState, useEffect } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  multiple?: boolean;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onFilesSelected,
  multiple = false,
  title = 'Arraste sua imagem aqui ou clique para escolher',
  subtitle = 'PNG, JPG ou WebP • Você também pode colar com Ctrl+V',
  compact = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        onFilesSelected(multiple ? files : [files[0]]);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [multiple, onFilesSelected]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/')
    );
    if (dropped.length > 0) {
      onFilesSelected(multiple ? dropped : [dropped[0]]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files ? Array.from(e.target.files) : [];
    if (selected.length > 0) {
      onFilesSelected(multiple ? selected : [selected[0]]);
    }
    e.target.value = '';
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`group relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 ${
        isDragging
          ? 'border-violet-500 bg-violet-50/80 dark:bg-violet-500/10 scale-[1.01]'
          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/70 hover:border-violet-400 dark:hover:border-violet-500 hover:bg-violet-50/30 dark:hover:bg-violet-500/5'
      } ${compact ? 'p-6' : 'p-12 sm:p-16'}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
      />
      <div className="flex flex-col items-center justify-center text-center">
        <div
          className={`mb-4 flex items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-105 ${
            isDragging
              ? 'bg-violet-600 text-white shadow-lg shadow-violet-200 dark:shadow-violet-950'
              : 'bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-500/20 dark:to-indigo-500/20 text-violet-600 dark:text-violet-400'
          } ${compact ? 'h-12 w-12' : 'h-16 w-16'}`}
        >
          {isDragging ? (
            <ImageIcon className={compact ? 'h-6 w-6' : 'h-8 w-8'} />
          ) : (
            <Upload className={compact ? 'h-6 w-6' : 'h-8 w-8'} />
          )}
        </div>
        <p className={`font-semibold text-slate-800 dark:text-slate-100 ${compact ? 'text-sm' : 'text-lg'}`}>
          {title}
        </p>
        <p className={`mt-1 text-slate-500 dark:text-slate-400 ${compact ? 'text-xs' : 'text-sm'}`}>
          {subtitle}
        </p>
        {!compact && (
          <span className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700">
            Selecionar {multiple ? 'imagens' : 'imagem'}
          </span>
        )}
      </div>
    </div>
  );
};
