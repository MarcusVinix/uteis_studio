import { loadImage } from './imageHelpers';

export type BgEngine = 'bria' | 'portrait' | 'isnet';

export interface RemoveBgProgress {
  percent: number;
  message: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cachedPipelines: Record<string, { model: any; processor: any }> = {};

/**
 * Normalizes any uploaded image (RGBA PNG, grayscale, CMYK, huge 48MP phone photo)
 * into a clean 3-channel RGB canvas capped at `maxDim` so ONNX models never crash
 * on channel mismatches or GPU/WASM out-of-memory.
 */
async function createNormalizedInputDataUrl(
  origImg: HTMLImageElement,
  maxDim = 1600
): Promise<string> {
  let w = origImg.naturalWidth;
  let h = origImg.naturalHeight;
  if (w > maxDim || h > maxDim) {
    if (w >= h) {
      h = Math.max(1, Math.round((h * maxDim) / w));
      w = maxDim;
    } else {
      w = Math.max(1, Math.round((w * maxDim) / h));
      h = maxDim;
    }
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Contexto canvas indisponível.');
  // Fill opaque background first so transparent PNGs become clean 3-channel RGB
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(origImg, 0, 0, w, h);
  return c.toDataURL('image/jpeg', 0.96);
}

async function loadTransformersEngine(
  engine: 'bria' | 'portrait',
  device: 'webgpu' | 'wasm',
  onProgress?: (p: RemoveBgProgress) => void
) {
  const cacheKey = `${engine}:${device}`;
  if (cachedPipelines[cacheKey]) return cachedPipelines[cacheKey];

  const { AutoModel, AutoProcessor, env } = await import('@huggingface/transformers');
  env.allowLocalModels = false;

  const modelId = engine === 'bria' ? 'briaai/RMBG-1.4' : 'Xenova/modnet';

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

  const modelOpts =
    engine === 'bria'
      ? {
          config: { model_type: 'custom' as const },
          device,
          progress_callback: progressCallback,
        }
      : {
          dtype: 'fp32' as const,
          device,
          progress_callback: progressCallback,
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

  const [model, processor] = await Promise.all([
    AutoModel.from_pretrained(
      modelId,
      modelOpts as Parameters<typeof AutoModel.from_pretrained>[1]
    ),
    processorPromise,
  ]);

  const entry = { model, processor };
  cachedPipelines[cacheKey] = entry;
  return entry;
}

async function runTransformersModelOnce(
  engine: 'bria' | 'portrait',
  device: 'webgpu' | 'wasm',
  origImg: HTMLImageElement,
  normalizedUrl: string,
  onProgress?: (p: RemoveBgProgress) => void
): Promise<ImageData> {
  const { RawImage } = await import('@huggingface/transformers');
  const { model, processor } = await loadTransformersEngine(engine, device, onProgress);

  onProgress?.({ percent: 86, message: 'Analisando contornos em alta definição...' });
  const rawImg = (await RawImage.fromURL(normalizedUrl)).rgb();
  const { pixel_values } = await processor(rawImg);

  onProgress?.({ percent: 92, message: 'Recortando o fundo com precisão...' });
  const result = await model({ input: pixel_values });
  const outTensor = result.output ?? Object.values(result)[0];
  if (!outTensor) throw new Error('Saída da IA vazia.');

  const maskTensor = outTensor[0].mul(255).to('uint8');
  const mask = await RawImage.fromTensor(maskTensor).resize(
    origImg.naturalWidth,
    origImg.naturalHeight
  );

  // Composite mask alpha channel onto original full-res image
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
  const totalPixels = canvas.width * canvas.height;

  for (let i = 0; i < totalPixels; i++) {
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

  const origImg = await loadImage(imageUrl);
  const normalizedUrl = await createNormalizedInputDataUrl(origImg, 1600);

  // Try WASM directly first? Actually WebGPU is faster when supported,
  // but if WebGPU fails during load OR inference, fall back cleanly to WASM,
  // and if WASM also fails (e.g. network blocked to Hugging Face), fall back to IS-Net.
  const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;

  if (hasWebGPU) {
    try {
      return await runTransformersModelOnce(engine, 'webgpu', origImg, normalizedUrl, onProgress);
    } catch (webgpuErr) {
      console.warn(`WebGPU falhou para ${engine}, tentando WASM...`, webgpuErr);
    }
  }

  try {
    return await runTransformersModelOnce(engine, 'wasm', origImg, normalizedUrl, onProgress);
  } catch (wasmErr) {
    console.warn(`WASM falhou para ${engine}, usando fallback IS-Net...`, wasmErr);
    onProgress?.({
      percent: 45,
      message: 'Alternando automaticamente para motor reserva...',
    });
    return await runImglyModel(file, onProgress);
  }
}
