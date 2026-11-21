import { loadImage } from './imageHelpers';
import {
  type ChurchProfile,
  type ChurchTemplate,
  type BackgroundAsset,
  type TextureStyle,
  type FrameStyle,
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
  preacherZoom: number; // 60..160
  preacherOffsetY: number; // -120..120
  showLogo: boolean;
  logoScale: number; // 60..180
  showLocalPastors: boolean;
  localPastorsZoom: number; // 50..160
  showPresidentPastors: boolean;
  presidentPastorsZoom: number; // 50..160
  showCircleLeader: boolean;
  circleLeaderZoom: number; // 50..160
  showFoodBadge: boolean;
  foodBadgeText: string;
  accentColor: string;
  bgDim: number; // 0..75
  texture: TextureStyle;
  frame: FrameStyle;
  transforms?: ElementTransformMap;
}

const imageCache = new Map<string, HTMLImageElement>();

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
  fadeHeightRatio = 0.22
) {
  const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
  const dw = Math.round(img.naturalWidth * ratio);
  const dh = Math.round(img.naturalHeight * ratio);
  if (dw <= 0 || dh <= 0) return { x: centerX, y: bottomY - maxH, w: 0, h: 0 };

  const cleanTemp = document.createElement('canvas');
  cleanTemp.width = dw;
  cleanTemp.height = dh;
  const cCtx = cleanTemp.getContext('2d');
  if (!cCtx) return { x: centerX - dw / 2, y: bottomY - dh, w: dw, h: dh };

  cCtx.drawImage(img, 0, 0, dw, dh);
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
  const { width: W, height: H, template, transforms } = state;
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

  if (!template.isLightBg) {
    const vig = ctx.createLinearGradient(0, H * 0.65, 0, H);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.78)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, H * 0.65, W, H * 0.35);
  }

  drawTextureOverlay(ctx, W, H, state.texture, state.accentColor);
  drawFrameOverlay(ctx, W, H, state.frame, state.accentColor);

  const scaleY = H / 1350;
  const textColor = template.textColor;
  const accent = state.accentColor;

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
    ctx.shadowColor = template.isLightBg ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
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
      template.isLightBg,
      accent
    );
    pushBox('foodBadge', 'Selo 1kg Alimento', rect.x, rect.y, rect.w, rect.h);
  }

  // 5. Portraits Section
  const [preacherImg, localImg, presidentImg, circleImg] = await Promise.all([
    getCachedImage(state.preacherPhotoUrl),
    state.showLocalPastors ? getCachedImage(profile.localPastorsPhoto) : Promise.resolve(null),
    state.showPresidentPastors
      ? getCachedImage(profile.presidentPastorsPhoto)
      : Promise.resolve(null),
    state.showCircleLeader ? getCachedImage(profile.circleLeaderPhoto) : Promise.resolve(null),
  ]);

  const hasAnyPortrait = Boolean(preacherImg || localImg || presidentImg || circleImg);
  const titleBlockY = hasAnyPortrait ? 270 * scaleY : 440 * scaleY;
  const portraitBaseY = 935 * scaleY;

  if (localImg) {
    const tr = getTr(transforms, 'localPastors');
    const z = (state.localPastorsZoom / 100) * tr.scale;
    const rect = drawPortraitWithBottomFade(
      ctx,
      localImg,
      W * 0.19 + tr.dx,
      portraitBaseY + tr.dy,
      370 * scaleY * z,
      330 * z
    );
    pushBox('localPastors', 'Prs. Locais', rect.x, rect.y, rect.w, rect.h);
  }

  if (presidentImg) {
    const tr = getTr(transforms, 'presidentPastors');
    const z = (state.presidentPastorsZoom / 100) * tr.scale;
    const rect = drawPortraitWithBottomFade(
      ctx,
      presidentImg,
      W * 0.81 + tr.dx,
      portraitBaseY + tr.dy,
      370 * scaleY * z,
      330 * z
    );
    pushBox('presidentPastors', 'Prs. Presidentes', rect.x, rect.y, rect.w, rect.h);
  }

  if (circleImg) {
    const tr = getTr(transforms, 'circleLeader');
    const z = (state.circleLeaderZoom / 100) * tr.scale;
    const rect = drawPortraitWithBottomFade(
      ctx,
      circleImg,
      W * 0.36 + tr.dx,
      portraitBaseY - 15 + tr.dy,
      360 * scaleY * z,
      270 * z
    );
    pushBox('circleLeader', 'Dirigente Círc. Oração', rect.x, rect.y, rect.w, rect.h);
  }

  if (preacherImg) {
    const tr = getTr(transforms, 'preacher');
    const zoomFactor = (state.preacherZoom / 100) * tr.scale;
    const centerX = (circleImg ? W * 0.58 : W * 0.5) + tr.dx;
    const rect = drawPortraitWithBottomFade(
      ctx,
      preacherImg,
      centerX,
      portraitBaseY + state.preacherOffsetY * scaleY + tr.dy,
      480 * scaleY * zoomFactor,
      460 * zoomFactor
    );
    pushBox('preacher', 'Foto do Pregador', rect.x, rect.y, rect.w, rect.h);
  }

  // 6. Main Typography Block (Eyebrow + Main Title + Subtitle)
  if (state.eyebrow.trim() || state.title.trim() || state.subtitle.trim()) {
    const tr = getTr(transforms, 'titleBlock');
    const cx = W / 2 + tr.dx;
    const titleY = titleBlockY + 24 * scaleY + tr.dy;
    const s = tr.scale;
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
      ctx.fillStyle = template.isLightBg ? accent : '#f8fafc';
      ctx.shadowColor = template.isLightBg ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.65)';
      ctx.shadowBlur = 8;
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
        ctx.shadowColor = 'rgba(0,0,0,0.65)';
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
        const grad = ctx.createLinearGradient(cx - 320 * s, titleY - 60 * s, cx + 320 * s, titleY + 60 * s);
        grad.addColorStop(0, template.secondaryColor);
        grad.addColorStop(0.5, accent);
        grad.addColorStop(1, '#dc2626');
        ctx.fillStyle = grad;
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 22;
        ctx.fillText(mainTitle, cx, titleY, W - 90);
      } else {
        ctx.font = `400 ${Math.round(142 * s)}px Anton, Montserrat, sans-serif`;
        ctx.fillStyle = accent;
        ctx.shadowColor = template.isLightBg ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.75)';
        ctx.shadowBlur = 20;
        ctx.fillText(mainTitle, cx, titleY, W - 90);
      }
      maxW = Math.max(maxW, Math.min(ctx.measureText(mainTitle).width + 48, W - 80));
    }

    if (state.subtitle.trim()) {
      ctx.shadowColor = template.isLightBg ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)';
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

  // 7. Preacher & Pastors Labels Band
  const labelCards: { title: string; body: string; x: number }[] = [];

  if (state.showLocalPastors && profile.localPastorsLabel.trim()) {
    const parts = profile.localPastorsLabel.split('\n');
    labelCards.push({
      title: parts[0] ?? 'Prs. Local',
      body: parts.slice(1).join(' ') || '',
      x: W * 0.2,
    });
  }

  if (state.preacherName.trim()) {
    labelCards.push({
      title: state.preacherRole.trim() || 'PREGADOR',
      body: state.preacherName.trim(),
      x: W * 0.5,
    });
  } else if (state.showCircleLeader && profile.circleLeaderLabel.trim()) {
    const parts = profile.circleLeaderLabel.split('\n');
    labelCards.push({
      title: parts[0] ?? 'Dirigente',
      body: parts.slice(1).join(' ') || '',
      x: W * 0.5,
    });
  }

  if (state.showPresidentPastors && profile.presidentPastorsLabel.trim()) {
    const parts = profile.presidentPastorsLabel.split('\n');
    labelCards.push({
      title: parts[0] ?? 'Prs. Presidentes',
      body: parts.slice(1).join(' ') || '',
      x: W * 0.8,
    });
  }

  if (labelCards.length > 0) {
    const tr = getTr(transforms, 'labels');
    const labelY = 960 * scaleY + tr.dy;
    const s = tr.scale;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let minX = Infinity;
    let maxX = -Infinity;
    const cardH = Math.round(88 * s);

    labelCards.forEach((card, idx) => {
      const cardW = Math.round((labelCards.length === 1 ? 420 : 300) * s);
      const baseCx =
        labelCards.length === 1
          ? W / 2
          : labelCards.length === 2
            ? idx === 0
              ? W * 0.28
              : W * 0.72
            : card.x;
      const cx = baseCx + tr.dx;

      minX = Math.min(minX, cx - cardW / 2);
      maxX = Math.max(maxX, cx + cardW / 2);

      drawRoundedRect(ctx, cx - cardW / 2, labelY - cardH / 2, cardW, cardH, 16 * s);
      ctx.fillStyle = template.isLightBg ? 'rgba(255,255,255,0.82)' : 'rgba(15,23,42,0.72)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = template.isLightBg
        ? 'rgba(159, 44, 72, 0.25)'
        : 'rgba(255, 255, 255, 0.16)';
      ctx.stroke();

      ctx.fillStyle = accent;
      ctx.font = `800 ${Math.round(18 * s)}px Montserrat, Inter, sans-serif`;
      ctx.fillText(card.title.toUpperCase(), cx, labelY - 18 * s, cardW - 24);

      ctx.fillStyle = template.isLightBg ? '#334155' : '#f8fafc';
      ctx.font = `700 ${Math.round(19 * s)}px Montserrat, Inter, sans-serif`;
      ctx.fillText(card.body, cx, labelY + 14 * s, cardW - 24);
    });

    ctx.restore();
    pushBox('labels', 'Cards de Nomes', minX, labelY - cardH / 2, maxX - minX, cardH);
  }

  // 8. Verse
  if (state.verse.trim()) {
    const tr = getTr(transforms, 'verse');
    const cx = W / 2 + tr.dx;
    const cy = 1068 * scaleY + tr.dy;
    const fontSize = Math.round(26 * tr.scale);
    const lineH = Math.round(32 * tr.scale);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = template.isLightBg ? textColor : '#f1f5f9';
    ctx.font = `italic 600 ${fontSize}px "Playfair Display", Georgia, serif`;
    ctx.shadowColor = template.isLightBg ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 8;
    const { lineCount, maxLineW } = drawMultilineCentered(ctx, state.verse, cx, cy, lineH, W - 160);
    ctx.restore();
    const bw = Math.min(maxLineW + 32, W - 120);
    const bh = lineCount * lineH + 12;
    pushBox('verse', 'Versículo / Tema', cx - bw / 2, cy - lineH / 2 - 4, bw, bh);
  }

  // 9. Date & Time Pill Banner
  if (state.dateText.trim()) {
    const tr = getTr(transforms, 'datePill');
    const cx = W / 2 + tr.dx;
    const dateY = (state.verse.trim() ? 1152 * scaleY : 1098 * scaleY) + tr.dy;
    const s = tr.scale;
    ctx.save();
    ctx.font = `800 ${Math.round(34 * s)}px Montserrat, Inter, sans-serif`;
    const textW = ctx.measureText(state.dateText.toUpperCase()).width;
    const pillW = Math.min(Math.max(textW + 92 * s, 420 * s), W - 80);
    const pillH = Math.round(74 * s);

    drawRoundedRect(ctx, cx - pillW / 2, dateY - pillH / 2, pillW, pillH, pillH / 2);
    ctx.fillStyle = accent;
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 16;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle =
      accent.toLowerCase() === '#ffffff' ||
      accent.toLowerCase() === '#facc15' ||
      accent.toLowerCase() === '#e2ff66' ||
      accent.toLowerCase() === '#f3d19c' ||
      accent.toLowerCase() === '#f5b942' ||
      accent.toLowerCase() === '#fef3c7'
        ? '#0f172a'
        : '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.dateText.toUpperCase(), cx, dateY + 2 * s, pillW - 44);
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
    ctx.fillStyle = template.isLightBg ? 'rgba(255,255,255,0.82)' : 'rgba(15,23,42,0.72)';
    ctx.fill();

    drawLocationPin(ctx, cx - addrW / 2 - 24, footerY, accent);

    ctx.fillStyle = template.isLightBg ? '#334155' : '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(addrText, cx + 10, footerY + 1, barW - 80);
    ctx.restore();
    pushBox('address', 'Endereço', cx - barW / 2, footerY - barH / 2, barW, barH);
  }

  return boxes;
}
