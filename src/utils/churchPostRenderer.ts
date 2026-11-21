import { loadImage } from './imageHelpers';
import {
  type ChurchProfile,
  type ChurchTemplate,
  type BackgroundAsset,
  type TextureStyle,
  type FrameStyle,
  type LayoutMode,
  type CardStyle,
  type DateStyle,
} from './churchAssets';

export type PosterElementId =
  | 'churchName'
  | 'logo'
  | 'foodBadge'
  | 'titleBlock'
  | 'localPastors'
  | 'presidentPastors'
  | 'circleLeader'
  | 'preacher'
  | 'labels'
  | 'verse'
  | 'datePill'
  | 'address';

export interface ElementTransform {
  dx: number;
  dy: number;
  scale: number;
}

export type ElementTransformMap = Partial<Record<PosterElementId, ElementTransform>>;

export interface ElementBox {
  id: PosterElementId;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  centerX: number;
  centerY: number;
}

export interface ChurchPostState {
  template: ChurchTemplate;
  background: BackgroundAsset;
  customBgUrl: string | null;
  layoutMode: LayoutMode;
  cardStyle: CardStyle;
  dateStyle: DateStyle;
  width: number;
  height: number;
  eyebrow: string;
  title: string;
  subtitle: string;
  dateText: string;
  verse: string;
  preacherRole: string;
  preacherName: string;
  preacherPhotoUrl: string | null;
  preacherZoom: number;
  preacherOffsetY: number;
  showLogo: boolean;
  logoScale: number;
  showLocalPastors: boolean;
  localPastorsZoom: number;
  showPresidentPastors: boolean;
  presidentPastorsZoom: number;
  showCircleLeader: boolean;
  circleLeaderZoom: number;
  showFoodBadge: boolean;
  foodBadgeText: string;
  accentColor: string;
  bgDim: number;
  texture: TextureStyle;
  frame: FrameStyle;
  transforms?: ElementTransformMap;
}

const imageCache = new Map<string, HTMLImageElement>();
const trimCache = new WeakMap<
  HTMLImageElement,
  { sx: number; sy: number; sw: number; sh: number }
>();

function getTrimmedBounds(img: HTMLImageElement): {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
} {
  const cached = trimCache.get(img);
  if (cached) return cached;

  const full = { sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight };
  try {
    const sampleMax = 256;
    const scale = Math.min(1, sampleMax / Math.max(img.naturalWidth, img.naturalHeight));
    const sw = Math.max(1, Math.round(img.naturalWidth * scale));
    const sh = Math.max(1, Math.round(img.naturalHeight * scale));
    const c = document.createElement('canvas');
    c.width = sw;
    c.height = sh;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return full;
    ctx.drawImage(img, 0, 0, sw, sh);
    const data = ctx.getImageData(0, 0, sw, sh).data;

    let minX = sw;
    let minY = sh;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        if (data[(y * sw + x) * 4 + 3] > 18) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      trimCache.set(img, full);
      return full;
    }

    const result = {
      sx: Math.max(0, Math.floor(minX / scale)),
      sy: Math.max(0, Math.floor(minY / scale)),
      sw: Math.min(img.naturalWidth, Math.ceil((maxX - minX + 1) / scale)),
      sh: Math.min(img.naturalHeight, Math.ceil((maxY - minY + 1) / scale)),
    };
    trimCache.set(img, result);
    return result;
  } catch {
    trimCache.set(img, full);
    return full;
  }
}

async function getCachedImage(src: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!src) return null;
  if (imageCache.has(src)) return imageCache.get(src)!;
  try {
    const img = await loadImage(src);
    imageCache.set(src, img);
    return img;
  } catch {
    return null;
  }
}

function getTr(transforms: ElementTransformMap | undefined, id: PosterElementId): ElementTransform {
  return transforms?.[id] ?? { dx: 0, dy: 0, scale: 1 };
}

function isBrightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 165;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number
) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function drawPortraitWithBottomFade(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  centerX: number,
  bottomY: number,
  maxH: number,
  maxW: number,
  fadeHeightRatio = 0.18
) {
  const bounds = getTrimmedBounds(img);
  const ratio = Math.min(maxW / bounds.sw, maxH / bounds.sh);
  const dw = Math.round(bounds.sw * ratio);
  const dh = Math.round(bounds.sh * ratio);
  if (dw <= 0 || dh <= 0) return { x: centerX, y: bottomY - maxH, w: 0, h: 0 };

  const cleanTemp = document.createElement('canvas');
  cleanTemp.width = dw;
  cleanTemp.height = dh;
  const cCtx = cleanTemp.getContext('2d');
  if (!cCtx) return { x: centerX - dw / 2, y: bottomY - dh, w: dw, h: dh };

  cCtx.drawImage(img, bounds.sx, bounds.sy, bounds.sw, bounds.sh, 0, 0, dw, dh);
  cCtx.globalCompositeOperation = 'destination-in';
  const maskGrad = cCtx.createLinearGradient(0, 0, 0, dh);
  maskGrad.addColorStop(0, 'rgba(0,0,0,1)');
  maskGrad.addColorStop(Math.max(0.5, 1 - fadeHeightRatio), 'rgba(0,0,0,1)');
  maskGrad.addColorStop(1, 'rgba(0,0,0,0)');
  cCtx.fillStyle = maskGrad;
  cCtx.fillRect(0, 0, dw, dh);

  const drawX = Math.round(centerX - dw / 2);
  const drawY = Math.round(bottomY - dh);
  ctx.drawImage(cleanTemp, drawX, drawY);
  return { x: drawX, y: drawY, w: dw, h: dh };
}

function drawMultilineCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  lineHeight: number,
  maxWidth: number
): { lineCount: number; maxLineW: number } {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/);
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }

  let maxLineW = 0;
  lines.forEach((line, idx) => {
    maxLineW = Math.max(maxLineW, ctx.measureText(line).width);
    ctx.fillText(line, x, y + idx * lineHeight);
  });

  return { lineCount: lines.length, maxLineW };
}

function drawTextureOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  texture: TextureStyle,
  accentColor: string
) {
  if (texture === 'none') return;

  if (texture === 'grain' || texture === 'paper') {
    const step = texture === 'grain' ? 4 : 6;
    ctx.save();
    for (let i = 0; i < 1800; i++) {
      const rx = ((i * 73856093) % 10000) / 10000;
      const ry = ((i * 19349663) % 10000) / 10000;
      const alpha = texture === 'grain' ? 0.055 : 0.035;
      ctx.fillStyle = i % 2 === 0 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
      ctx.fillRect(rx * w, ry * h, step, step);
    }
    ctx.restore();
  } else if (texture === 'sparkles') {
    ctx.save();
    ctx.fillStyle = accentColor;
    const points = [
      [0.12, 0.22, 14],
      [0.88, 0.28, 18],
      [0.09, 0.62, 10],
      [0.91, 0.56, 12],
      [0.2, 0.44, 8],
      [0.82, 0.42, 9],
    ];
    for (const [px, py, size] of points) {
      const cx = px * w;
      const cy = py * h;
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.moveTo(cx, cy - size);
      ctx.quadraticCurveTo(cx, cy, cx + size, cy);
      ctx.quadraticCurveTo(cx, cy, cx, cy + size);
      ctx.quadraticCurveTo(cx, cy, cx - size, cy);
      ctx.quadraticCurveTo(cx, cy, cx, cy - size);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawFrameOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: FrameStyle,
  accentColor: string
) {
  if (frame === 'none') return;
  ctx.save();
  ctx.strokeStyle = accentColor;

  if (frame === 'thin') {
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, 28, 28, w - 56, h - 56, 20);
    ctx.stroke();
  } else if (frame === 'double') {
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, 24, 24, w - 48, h - 48, 16);
    ctx.stroke();
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, 38, 38, w - 76, h - 76, 12);
    ctx.stroke();
  } else if (frame === 'corners') {
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 5;
    const m = 34;
    const len = 70;
    ctx.beginPath();
    ctx.moveTo(m, m + len);
    ctx.lineTo(m, m);
    ctx.lineTo(m + len, m);
    ctx.moveTo(w - m - len, m);
    ctx.lineTo(w - m, m);
    ctx.lineTo(w - m, m + len);
    ctx.moveTo(m, h - m - len);
    ctx.lineTo(m, h - m);
    ctx.lineTo(m + len, h - m);
    ctx.moveTo(w - m - len, h - m);
    ctx.lineTo(w - m, h - m);
    ctx.lineTo(w - m, h - m - len);
    ctx.stroke();
  }

  ctx.restore();
}

function drawFoodBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  text: string,
  isLightBg: boolean,
  accentColor: string
) {
  const boxW = Math.round(220 * scale);
  const boxH = Math.round(112 * scale);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  drawRoundedRect(ctx, 0, 0, 220, 112, 18);
  ctx.fillStyle = isLightBg ? 'rgba(255,255,255,0.88)' : 'rgba(15,23,42,0.72)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = accentColor;
  ctx.stroke();

  const ix = 36;
  const iy = 60;
  ctx.fillStyle = '#eab308';
  ctx.fillRect(ix - 18, iy - 4, 36, 22);
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(ix - 8, iy - 8, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(ix + 6, iy - 9, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(ix - 3, iy - 16, 7, 12);

  ctx.fillStyle = isLightBg ? '#1e293b' : '#ffffff';
  ctx.font = '800 20px Montserrat, Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const lines = text.split('\n');
  lines.forEach((line, idx) => {
    ctx.fillText(line, 68, 40 + idx * 26);
  });

  ctx.restore();
  return { x, y, w: boxW, h: boxH };
}

function drawLocationPin(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - 6, 11, Math.PI, 0, false);
  ctx.lineTo(x, y + 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y - 6, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export async function renderChurchPost(
  canvas: HTMLCanvasElement,
  state: ChurchPostState,
  profile: ChurchProfile
): Promise<ElementBox[]> {
  const { width: W, height: H, template, transforms, layoutMode, cardStyle, dateStyle } = state;
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const boxes: ElementBox[] = [];
  const pushBox = (id: PosterElementId, label: string, x: number, y: number, w: number, h: number) => {
    if (w <= 0 || h <= 0) return;
    boxes.push({ id, label, x, y, w, h, centerX: x + w / 2, centerY: y + h / 2 });
  };

  // 1. Background
  const customImg = await getCachedImage(state.customBgUrl);
  const assetImg =
    !customImg && state.background.type === 'image'
      ? await getCachedImage(state.background.src)
      : null;

  if (customImg) {
    drawCoverImage(ctx, customImg, W, H);
  } else if (assetImg) {
    drawCoverImage(ctx, assetImg, W, H);
  } else if (state.background.colors) {
    const grad = ctx.createLinearGradient(0, 0, W * 0.35, H);
    grad.addColorStop(0, state.background.colors[0]);
    grad.addColorStop(0.55, state.background.colors[1]);
    grad.addColorStop(1, state.background.colors[2] ?? state.background.colors[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);
  }

  if (state.bgDim > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${state.bgDim / 100})`;
    ctx.fillRect(0, 0, W, H);
  }

  const isLightBg = Boolean(state.background.isLight && !customImg && state.bgDim < 18);
  const textColor = isLightBg ? template.isLightBg ? template.textColor : '#1e293b' : '#ffffff';
  const accent = state.accentColor;

  if (!isLightBg) {
    const vig = ctx.createLinearGradient(0, H * 0.62, 0, H);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.82)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, H * 0.62, W, H * 0.38);
  }

  drawTextureOverlay(ctx, W, H, state.texture, accent);
  drawFrameOverlay(ctx, W, H, state.frame, accent);

  const scaleY = H / 1350;

  // 2. Church Name Header
  if (profile.churchName.trim()) {
    const tr = getTr(transforms, 'churchName');
    const cx = W / 2 + tr.dx;
    const cy = 62 * scaleY + tr.dy;
    const fontSize = Math.round(28 * tr.scale);
    const lineH = Math.round(34 * tr.scale);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor;
    ctx.shadowColor = isLightBg ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 10;
    ctx.font = `700 ${fontSize}px Montserrat, Inter, sans-serif`;
    const { lineCount, maxLineW } = drawMultilineCentered(
      ctx,
      profile.churchName.toUpperCase(),
      cx,
      cy,
      lineH,
      W - 260
    );
    ctx.restore();
    const boxW = Math.min(maxLineW + 32, W - 220);
    const boxH = lineCount * lineH + 12;
    pushBox('churchName', 'Nome da Igreja', cx - boxW / 2, cy - lineH / 2 - 4, boxW, boxH);
  }

  // 3. Church Logo
  const logoImg = state.showLogo ? await getCachedImage(profile.logoDataUrl) : null;
  if (logoImg) {
    const tr = getTr(transforms, 'logo');
    const logoSize = Math.round(128 * (state.logoScale / 100) * tr.scale);
    const lx = W - logoSize - 44 + tr.dx;
    const ly = 36 * scaleY + tr.dy;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(lx + logoSize / 2, ly + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logoImg, lx, ly, logoSize, logoSize);
    ctx.restore();
    pushBox('logo', 'Logo da Igreja', lx, ly, logoSize, logoSize);
  }

  // 4. Optional Food Badge
  if (state.showFoodBadge) {
    const tr = getTr(transforms, 'foodBadge');
    const rect = drawFoodBadge(
      ctx,
      44 + tr.dx,
      128 * scaleY + tr.dy,
      tr.scale,
      state.foodBadgeText,
      isLightBg,
      accent
    );
    pushBox('foodBadge', 'Selo 1kg Alimento', rect.x, rect.y, rect.w, rect.h);
  }

  // Load portraits
  const [preacherImg, localImg, presidentImg, circleImg] = await Promise.all([
    getCachedImage(state.preacherPhotoUrl),
    state.showLocalPastors ? getCachedImage(profile.localPastorsPhoto) : Promise.resolve(null),
    state.showPresidentPastors
      ? getCachedImage(profile.presidentPastorsPhoto)
      : Promise.resolve(null),
    state.showCircleLeader ? getCachedImage(profile.circleLeaderPhoto) : Promise.resolve(null),
  ]);

  const hasAnyPortrait = Boolean(preacherImg || localImg || presidentImg || circleImg);
  const isFourPersonLayout = Boolean(circleImg && preacherImg);

  // Structural layout coordinates based on LayoutMode!
  const portraitBaseY =
    layoutMode === 'hero-overlap'
      ? 800 * scaleY
      : layoutMode === 'editorial'
        ? 955 * scaleY
        : layoutMode === 'minimal-focus'
          ? 1120 * scaleY
          : 935 * scaleY;

  const titleBlockY =
    layoutMode === 'hero-overlap'
      ? 825 * scaleY
      : layoutMode === 'editorial'
        ? 420 * scaleY
        : layoutMode === 'minimal-focus'
          ? 455 * scaleY
          : hasAnyPortrait
            ? 270 * scaleY
            : 440 * scaleY;

  const labelY =
    layoutMode === 'hero-overlap'
      ? 235 * scaleY
      : layoutMode === 'minimal-focus'
        ? 1145 * scaleY
        : 970 * scaleY;

  const dateBaseY =
    layoutMode === 'editorial'
      ? 168 * scaleY
      : layoutMode === 'hero-overlap'
        ? 1055 * scaleY
        : layoutMode === 'minimal-focus'
          ? 875 * scaleY
          : state.verse.trim()
            ? 1152 * scaleY
            : 1098 * scaleY;

  const verseBaseY =
    layoutMode === 'minimal-focus'
      ? 685 * scaleY
      : layoutMode === 'hero-overlap'
        ? 1150 * scaleY
        : 1068 * scaleY;

  // 5. Portraits Section
  const portraitScaleMod = layoutMode === 'minimal-focus' ? 0.72 : 1;

  if (localImg) {
    const tr = getTr(transforms, 'localPastors');
    const z = (state.localPastorsZoom / 100) * tr.scale * portraitScaleMod;
    const baseX = isFourPersonLayout ? W * 0.14 : layoutMode === 'minimal-focus' ? W * 0.16 : W * 0.19;
    const rect = drawPortraitWithBottomFade(
      ctx,
      localImg,
      baseX + tr.dx,
      portraitBaseY + tr.dy,
      (isFourPersonLayout ? 340 : 370) * scaleY * z,
      (isFourPersonLayout ? 275 : 330) * z
    );
    pushBox('localPastors', 'Prs. Locais', rect.x, rect.y, rect.w, rect.h);
  }

  if (presidentImg) {
    const tr = getTr(transforms, 'presidentPastors');
    const z = (state.presidentPastorsZoom / 100) * tr.scale * portraitScaleMod;
    const baseX = isFourPersonLayout ? W * 0.86 : layoutMode === 'minimal-focus' ? W * 0.84 : W * 0.81;
    const rect = drawPortraitWithBottomFade(
      ctx,
      presidentImg,
      baseX + tr.dx,
      portraitBaseY + tr.dy,
      (isFourPersonLayout ? 340 : 370) * scaleY * z,
      (isFourPersonLayout ? 275 : 330) * z
    );
    pushBox('presidentPastors', 'Prs. Presidentes', rect.x, rect.y, rect.w, rect.h);
  }

  if (circleImg) {
    const tr = getTr(transforms, 'circleLeader');
    const z = (state.circleLeaderZoom / 100) * tr.scale * portraitScaleMod;
    const baseX = preacherImg ? W * 0.38 : W * 0.5;
    const rect = drawPortraitWithBottomFade(
      ctx,
      circleImg,
      baseX + tr.dx,
      portraitBaseY + tr.dy,
      365 * scaleY * z,
      280 * z
    );
    pushBox('circleLeader', 'Dirigente Círc. Oração', rect.x, rect.y, rect.w, rect.h);
  }

  if (preacherImg) {
    const tr = getTr(transforms, 'preacher');
    const zoomFactor =
      (state.preacherZoom / 100) * tr.scale * (layoutMode === 'hero-overlap' ? 1.12 : 1);
    const centerX = (circleImg ? W * 0.62 : W * 0.5) + tr.dx;
    const rect = drawPortraitWithBottomFade(
      ctx,
      preacherImg,
      centerX,
      portraitBaseY + state.preacherOffsetY * scaleY + tr.dy,
      (circleImg ? 420 : 475) * scaleY * zoomFactor,
      (circleImg ? 350 : 450) * zoomFactor
    );
    pushBox('preacher', 'Foto do Pregador', rect.x, rect.y, rect.w, rect.h);
  }

  // 6. Main Typography Block (drawn AFTER portraits so hero-overlap sits dramatically in front!)
  if (state.eyebrow.trim() || state.title.trim() || state.subtitle.trim()) {
    const tr = getTr(transforms, 'titleBlock');
    const cx = W / 2 + tr.dx;
    const titleY = titleBlockY + 24 * scaleY + tr.dy;
    const s = tr.scale * (layoutMode === 'minimal-focus' ? 1.12 : 1);
    const titleHalfH =
      (template.titleStyle === 'fire-gradient' || template.titleStyle === 'impact'
        ? 84
        : template.titleStyle === 'neon-pill' || template.titleStyle === 'serif'
          ? 76
          : 68) * s;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let topY = titleY - titleHalfH;
    let botY = titleY + titleHalfH;
    let maxW = 360 * s;

    if (state.eyebrow.trim()) {
      ctx.fillStyle = isLightBg ? accent : '#f8fafc';
      ctx.shadowColor = isLightBg ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.75)';
      ctx.shadowBlur = 10;
      const isScriptEyebrow = template.titleStyle === 'serif';
      ctx.font = isScriptEyebrow
        ? `italic 600 ${Math.round(54 * s)}px "Great Vibes", cursive`
        : `800 ${Math.round(30 * s)}px Montserrat, Inter, sans-serif`;
      const eyebrowGap = (isScriptEyebrow ? 34 : 28) * s;
      const eyY = titleY - titleHalfH - eyebrowGap;
      ctx.fillText(state.eyebrow, cx, eyY);
      maxW = Math.max(maxW, Math.min(ctx.measureText(state.eyebrow).width + 40, W - 80));
      topY = eyY - 26 * s;
    }

    const mainTitle = state.title.trim();
    if (mainTitle) {
      if (template.titleStyle === 'script') {
        ctx.font = `400 ${Math.round(124 * s)}px "Great Vibes", cursive`;
        ctx.fillStyle = accent;
        ctx.shadowColor = 'rgba(255,255,255,0.85)';
        ctx.shadowBlur = 12;
        ctx.fillText(mainTitle, cx, titleY, W - 100);
      } else if (template.titleStyle === 'serif') {
        ctx.font = `700 ${Math.round(128 * s)}px "Playfair Display", Georgia, serif`;
        ctx.fillStyle = textColor;
        ctx.shadowColor = isLightBg ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 18;
        ctx.fillText(mainTitle, cx, titleY, W - 100);
      } else if (template.titleStyle === 'neon-pill') {
        ctx.font = `900 ${Math.round(104 * s)}px Anton, Montserrat, sans-serif`;
        const tw = Math.min(ctx.measureText(mainTitle).width + 76 * s, W - 90);
        const th = 132 * s;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 24;
        drawRoundedRect(ctx, cx - tw / 2, titleY - th / 2, tw, th, 28 * s);
        ctx.fillStyle = accent;
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#0f172a';
        ctx.shadowBlur = 0;
        ctx.fillText(mainTitle, cx, titleY + 4 * s, W - 130);
        maxW = Math.max(maxW, tw);
      } else if (template.titleStyle === 'fire-gradient') {
        ctx.font = `400 ${Math.round(148 * s)}px Anton, Montserrat, sans-serif`;
        const grad = ctx.createLinearGradient(
          cx - 320 * s,
          titleY - 60 * s,
          cx + 320 * s,
          titleY + 60 * s
        );
        grad.addColorStop(0, template.secondaryColor);
        grad.addColorStop(0.5, accent);
        grad.addColorStop(1, '#dc2626');
        ctx.fillStyle = grad;
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 24;
        ctx.fillText(mainTitle, cx, titleY, W - 90);
      } else {
        ctx.font = `400 ${Math.round(142 * s)}px Anton, Montserrat, sans-serif`;
        ctx.fillStyle = accent;
        ctx.shadowColor = isLightBg ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 22;
        ctx.fillText(mainTitle, cx, titleY, W - 90);
      }
      maxW = Math.max(maxW, Math.min(ctx.measureText(mainTitle).width + 48, W - 80));
    }

    if (state.subtitle.trim()) {
      ctx.shadowColor = isLightBg ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 8;
      if (template.id === 'ceia-bronze') {
        ctx.font = `400 ${Math.round(72 * s)}px "Great Vibes", cursive`;
        ctx.fillStyle = template.secondaryColor;
        const subY = titleY + titleHalfH + 34 * s;
        ctx.fillText(state.subtitle, cx, subY, W - 120);
        botY = subY + 34 * s;
      } else {
        ctx.font = `700 ${Math.round(28 * s)}px Montserrat, Inter, sans-serif`;
        ctx.fillStyle = textColor;
        const subY = titleY + titleHalfH + 30 * s;
        ctx.fillText(state.subtitle, cx, subY, W - 140);
        botY = subY + 22 * s;
      }
    }
    ctx.restore();

    pushBox('titleBlock', 'Título do Culto', cx - maxW / 2, topY, maxW, botY - topY);
  }

  // 7. Preacher & Pastors Labels Band (4 styles: glass, minimal, solid, pill)
  const labelCards: { title: string; body: string }[] = [];

  if (state.showLocalPastors && profile.localPastorsLabel.trim()) {
    const parts = profile.localPastorsLabel.split('\n');
    labelCards.push({
      title: parts[0] ?? 'Prs. Local',
      body: parts.slice(1).join(' ') || '',
    });
  }
  if (state.showCircleLeader && profile.circleLeaderLabel.trim()) {
    const parts = profile.circleLeaderLabel.split('\n');
    labelCards.push({
      title: parts[0] ?? 'Dirigente',
      body: parts.slice(1).join(' ') || '',
    });
  }
  if (state.preacherName.trim()) {
    labelCards.push({
      title: state.preacherRole.trim() || 'PREGADOR',
      body: state.preacherName.trim(),
    });
  }
  if (state.showPresidentPastors && profile.presidentPastorsLabel.trim()) {
    const parts = profile.presidentPastorsLabel.split('\n');
    labelCards.push({
      title: parts[0] ?? 'Prs. Presidentes',
      body: parts.slice(1).join(' ') || '',
    });
  }

  if (labelCards.length > 0) {
    const tr = getTr(transforms, 'labels');
    const ly = labelY + tr.dy;
    const s = tr.scale;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let minX = Infinity;
    let maxX = -Infinity;
    const count = labelCards.length;
    const cardW = Math.round(
      (count === 1 ? 420 : count === 2 ? 380 : count === 3 ? 300 : 240) * s
    );
    const cardH = Math.round(88 * s);
    const gap = Math.round((count === 4 ? 14 : 24) * s);
    const totalW = count * cardW + (count - 1) * gap;
    const startX = W / 2 - totalW / 2 + cardW / 2;

    labelCards.forEach((card, idx) => {
      const cx = startX + idx * (cardW + gap) + tr.dx;
      minX = Math.min(minX, cx - cardW / 2);
      maxX = Math.max(maxX, cx + cardW / 2);

      if (cardStyle === 'minimal') {
        // Clean text with subtle vertical accent divider between items (Canva editorial style!)
        if (idx > 0) {
          ctx.save();
          ctx.strokeStyle = accent;
          ctx.globalAlpha = 0.7;
          ctx.lineWidth = 2.5;
          const divX = cx - cardW / 2 - gap / 2;
          ctx.beginPath();
          ctx.moveTo(divX, ly - 28 * s);
          ctx.lineTo(divX, ly + 28 * s);
          ctx.stroke();
          ctx.restore();
        }
        ctx.shadowColor = isLightBg ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = accent;
        ctx.font = `800 ${Math.round((count === 4 ? 15 : 18) * s)}px Montserrat, Inter, sans-serif`;
        ctx.fillText(card.title.toUpperCase(), cx, ly - 17 * s, cardW - 14);
        ctx.fillStyle = textColor;
        ctx.font = `700 ${Math.round((count === 4 ? 16 : 19) * s)}px Montserrat, Inter, sans-serif`;
        ctx.fillText(card.body, cx, ly + 15 * s, cardW - 14);
        ctx.shadowBlur = 0;
      } else {
        const radius = cardStyle === 'pill' ? cardH / 2 : 16 * s;
        drawRoundedRect(ctx, cx - cardW / 2, ly - cardH / 2, cardW, cardH, radius);

        if (cardStyle === 'solid') {
          ctx.fillStyle = isLightBg ? accent : 'rgba(15,23,42,0.92)';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = accent;
          ctx.stroke();
        } else {
          // glass or pill
          ctx.fillStyle = isLightBg ? 'rgba(255,255,255,0.86)' : 'rgba(15,23,42,0.72)';
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = isLightBg ? 'rgba(159,44,72,0.25)' : 'rgba(255,255,255,0.18)';
          ctx.stroke();
        }

        const solidLight = cardStyle === 'solid' && isLightBg;
        ctx.fillStyle = solidLight ? (isBrightColor(accent) ? '#0f172a' : '#fef3c7') : accent;
        ctx.font = `800 ${Math.round((count === 4 ? 15 : 18) * s)}px Montserrat, Inter, sans-serif`;
        ctx.fillText(card.title.toUpperCase(), cx, ly - 18 * s, cardW - 22);

        ctx.fillStyle = solidLight
          ? isBrightColor(accent)
            ? '#0f172a'
            : '#ffffff'
          : isLightBg
            ? '#334155'
            : '#f8fafc';
        ctx.font = `700 ${Math.round((count === 4 ? 16 : 19) * s)}px Montserrat, Inter, sans-serif`;
        ctx.fillText(card.body, cx, ly + 14 * s, cardW - 22);
      }
    });

    ctx.restore();
    pushBox('labels', 'Cards de Nomes', minX, ly - cardH / 2, maxX - minX, cardH);
  }

  // 8. Verse
  if (state.verse.trim()) {
    const tr = getTr(transforms, 'verse');
    const cx = W / 2 + tr.dx;
    const cy = verseBaseY + tr.dy;
    const fontSize = Math.round((layoutMode === 'minimal-focus' ? 30 : 26) * tr.scale);
    const lineH = Math.round(fontSize * 1.28);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (layoutMode === 'minimal-focus') {
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 120, cy - 38 * tr.scale);
      ctx.lineTo(cx + 120, cy - 38 * tr.scale);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = isLightBg ? textColor : '#f1f5f9';
    ctx.font = `italic 600 ${fontSize}px "Playfair Display", Georgia, serif`;
    ctx.shadowColor = isLightBg ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.75)';
    ctx.shadowBlur = 8;
    const { lineCount, maxLineW } = drawMultilineCentered(ctx, state.verse, cx, cy, lineH, W - 160);
    ctx.restore();
    const bw = Math.min(maxLineW + 32, W - 120);
    const bh = lineCount * lineH + 16;
    pushBox('verse', 'Versículo / Tema', cx - bw / 2, cy - lineH / 2 - 4, bw, bh);
  }

  // 9. Date & Time Banner (4 styles: pill, outline, ribbon, stamp)
  if (state.dateText.trim()) {
    const tr = getTr(transforms, 'datePill');
    const cx = W / 2 + tr.dx;
    const dateY = dateBaseY + tr.dy;
    const s = tr.scale;
    const textUpper = state.dateText.toUpperCase();

    ctx.save();
    ctx.font = `800 ${Math.round(33 * s)}px Montserrat, Inter, sans-serif`;
    const textW = ctx.measureText(textUpper).width;
    const pillW =
      dateStyle === 'ribbon'
        ? Math.min(W - 140, Math.max(textW + 140 * s, 560 * s))
        : Math.min(Math.max(textW + 92 * s, 400 * s), W - 80);
    const pillH = Math.round((dateStyle === 'stamp' ? 92 : 74) * s);

    if (dateStyle === 'outline') {
      drawRoundedRect(ctx, cx - pillW / 2, dateY - pillH / 2, pillW, pillH, 12 * s);
      ctx.fillStyle = isLightBg ? 'rgba(255,255,255,0.65)' : 'rgba(15,23,42,0.55)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = accent;
      ctx.stroke();
      ctx.fillStyle = isLightBg ? textColor : '#ffffff';
    } else if (dateStyle === 'stamp') {
      ctx.beginPath();
      ctx.ellipse(cx, dateY, pillW / 2, pillH / 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = isLightBg ? 'rgba(255,255,255,0.72)' : 'rgba(15,23,42,0.65)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = accent;
      ctx.stroke();
      ctx.fillStyle = isLightBg ? accent : '#ffffff';
    } else if (dateStyle === 'ribbon') {
      drawRoundedRect(ctx, cx - pillW / 2, dateY - pillH / 2, pillW, pillH, 8 * s);
      ctx.fillStyle = accent;
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 16;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = isBrightColor(accent) ? '#0f172a' : '#ffffff';
    } else {
      drawRoundedRect(ctx, cx - pillW / 2, dateY - pillH / 2, pillW, pillH, pillH / 2);
      ctx.fillStyle = accent;
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 16;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = isBrightColor(accent) ? '#0f172a' : '#ffffff';
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(textUpper, cx, dateY + 2 * s, pillW - 44);
    ctx.restore();
    pushBox('datePill', 'Data e Horário', cx - pillW / 2, dateY - pillH / 2, pillW, pillH);
  }

  // 10. Footer Address Bar
  if (profile.address.trim()) {
    const tr = getTr(transforms, 'address');
    const cx = W / 2 + tr.dx;
    const footerY = H - 68 * scaleY + tr.dy;
    const s = tr.scale;
    const barW = Math.min(Math.round((W - 96) * s), W - 40);
    const barH = Math.round(64 * s);

    ctx.save();
    ctx.font = `700 ${Math.round(24 * s)}px Montserrat, Inter, sans-serif`;
    const addrText = profile.address;
    const addrW = Math.min(ctx.measureText(addrText).width, barW - 80);

    drawRoundedRect(ctx, cx - barW / 2, footerY - barH / 2, barW, barH, 16 * s);
    ctx.fillStyle = isLightBg ? 'rgba(255,255,255,0.82)' : 'rgba(15,23,42,0.72)';
    ctx.fill();

    drawLocationPin(ctx, cx - addrW / 2 - 24, footerY, accent);

    ctx.fillStyle = isLightBg ? '#334155' : '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(addrText, cx + 10, footerY + 1, barW - 80);
    ctx.restore();
    pushBox('address', 'Endereço', cx - barW / 2, footerY - barH / 2, barW, barH);
  }

  return boxes;
}
