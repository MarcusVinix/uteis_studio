import { loadImage } from './imageHelpers';

export type BgEngine = 'bria' | 'portrait' | 'isnet';

export interface RemoveBgProgress {
  percent: number;
  message: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cachedPipelines: Record<string, { model: any; processor: any }> = {};

async function runTransformersModel(
  engine: 'bria' | 'portrait',
  imageUrl: string,
  onProgress?: (p: RemoveBgProgress) => void
): Promise<ImageData> {
  const { AutoModel, AutoProcessor, RawImage, env } = await import('@huggingface/transformers');
  env.allowLocalModels = false;

  const modelId = engine === 'bria' ? 'briaai/RMBG-1.4' : 'Xenova/modnet';

  if (!cachedPipelines[engine]) {
    onProgress?.({
      percent: 8,
      message:
        engine === 'bria'
          ? 'Baixando IA Ultra Precisão (RMBG-1.4)...'
          : 'Baixando IA Especialista em Pessoas (MODNet)...',
    });

    const progressCallback = (info: { status?: string; progress?: number }) => {
      if (info.status === 'progress' && typeof info.progress === 'number') {
        const pct = Math.min(82, Math.max(10, Math.round(10 + info.progress * 0.72)));
        onProgress?.({
          percent: pct,
          message:
            engine === 'bria'
              ? 'Baixando IA Ultra Precisão (salvo em cache após a 1ª vez)...'
              : 'Baixando IA de Retrato (salvo em cache após a 1ª vez)...',
        });
      }
    };

    const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;

    const loadModelWithFallback = async () => {
      const commonOpts =
        engine === 'bria'
          ? {
              config: { model_type: 'custom' as const },
              progress_callback: progressCallback,
            }
          : {
              dtype: 'fp32' as const,
              progress_callback: progressCallback,
            };

      if (hasWebGPU) {
        try {
          return await AutoModel.from_pretrained(modelId, {
            ...commonOpts,
            device: 'webgpu',
          } as Parameters<typeof AutoModel.from_pretrained>[1]);
        } catch {
          // Fall back to WASM if WebGPU is unavailable or fails for this model
        }
      }

      return await AutoModel.from_pretrained(modelId, {
        ...commonOpts,
        device: 'wasm',
      } as Parameters<typeof AutoModel.from_pretrained>[1]);
    };

    const processorPromise =
      engine === 'bria'
        ? AutoProcessor.from_pretrained(modelId, {
            config: {
              do_normalize: true,
              do_pad: false,
              do_rescale: true,
              do_resize: true,
              image_mean: [0.5, 0.5, 0.5],
              feature_extractor_type: 'ImageFeatureExtractor',
              image_std: [1, 1, 1],
              resample: 2,
              rescale_factor: 0.00392156862745098,
              size: { width: 1024, height: 1024 },
            },
          })
        : AutoProcessor.from_pretrained(modelId);

    const [model, processor] = await Promise.all([loadModelWithFallback(), processorPromise]);
    cachedPipelines[engine] = { model, processor };
  }

  const { model, processor } = cachedPipelines[engine];

  onProgress?.({ percent: 86, message: 'Analisando contornos em alta definição...' });
  const rawImg = await RawImage.fromURL(imageUrl);
  const { pixel_values } = await processor(rawImg);

  onProgress?.({ percent: 92, message: 'Recortando o fundo com precisão...' });
  const { output } = await model({ input: pixel_values });

  const maskTensor = output[0].mul(255).to('uint8');
  const mask = await RawImage.fromTensor(maskTensor).resize(rawImg.width, rawImg.height);

  // Composite mask alpha channel onto original full-res image
  const origImg = await loadImage(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = origImg.naturalWidth;
  canvas.height = origImg.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Contexto canvas indisponível.');

  ctx.drawImage(origImg, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imgData.data;
  const maskData = mask.data;
  const maskChannels = mask.channels;

  for (let i = 0; i < canvas.width * canvas.height; i++) {
    pixels[i * 4 + 3] = maskData[i * maskChannels];
  }

  onProgress?.({ percent: 100, message: 'Concluído!' });
  return imgData;
}

async function runImglyModel(
  file: File,
  onProgress?: (p: RemoveBgProgress) => void
): Promise<ImageData> {
  const { removeBackground } = await import('@imgly/background-removal');

  const blob = await removeBackground(file, {
    model: 'isnet_fp16',
    progress: (key: string, current: number, total: number) => {
      const pct = total > 0 ? Math.min(98, Math.round((current / total) * 100)) : 50;
      onProgress?.({
        percent: pct,
        message: key.toLowerCase().includes('fetch')
          ? 'Baixando modelo rápido (IS-Net)...'
          : 'Removendo fundo...',
      });
    },
    output: { format: 'image/png' },
  });

  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Contexto canvas indisponível.');
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function removeImageBackground(
  file: File,
  imageUrl: string,
  engine: BgEngine,
  onProgress?: (p: RemoveBgProgress) => void
): Promise<ImageData> {
  if (engine === 'isnet') {
    return runImglyModel(file, onProgress);
  }
  return runTransformersModel(engine, imageUrl, onProgress);
}
