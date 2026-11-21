import { loadImage } from './imageHelpers';
import {
  type ChurchProfile,
  type ChurchTemplate,
  type BackgroundAsset,
  type TextureStyle,
  type FrameStyle,
} from './churchAssets';

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
  preacherZoom: number; // 70..150
  preacherOffsetY: number; // -120..120
  showLocalPastors: boolean;
  showPresidentPastors: boolean;
  showCircleLeader: boolean;
  showFoodBadge: boolean;
  foodBadgeText: string;
  accentColor: string;
  bgDim: number; // 0..75
  texture: TextureStyle;
  frame: FrameStyle;
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

  // Render to small temp canvas to apply smooth bottom alpha fade so torso blends seamlessly
  const temp = document.createElement('canvas');
  temp.width = dw;
  temp.height = dh;
  const tCtx = temp.getContext('2d');
  if (!tCtx) return { x: centerX - dw / 2, y: bottomY - dh, w: dw, h: dh };

  tCtx.drawImage(img, 0, 0, dw, dh);

  const fadeStart = Math.round(dh * (1 - fadeHeightRatio));
  tCtx.globalCompositeOperation = 'destination-in';
  const grad = tCtx.createLinearGradient(0, fadeStart, 0, dh);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  tCtx.fillStyle = grad;
  tCtx.fillRect(0, fadeStart, dw, dh - fadeStart);
  tCtx.globalCompositeOperation = 'source-over';
  // Keep upper part fully opaque
  tCtx.globalCompositeOperation = 'destination-over';
  tCtx.fillStyle = 'rgba(0,0,0,0)';
  tCtx.fillRect(0, 0, dw, fadeStart);

  // Redraw properly with clean full-height gradient mask
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
): number {
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

  lines.forEach((line, idx) => {
    ctx.fillText(line, x, y + idx * lineHeight);
  });

  return lines.length;
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
    // Deterministic subtle noise pattern
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
    // Top-left
    ctx.beginPath();
    ctx.moveTo(m, m + len);
    ctx.lineTo(m, m);
    ctx.lineTo(m + len, m);
    // Top-right
    ctx.moveTo(w - m - len, m);
    ctx.lineTo(w - m, m);
    ctx.lineTo(w - m, m + len);
    // Bottom-left
    ctx.moveTo(m, h - m - len);
    ctx.lineTo(m, h - m);
    ctx.lineTo(m + len, h - m);
    // Bottom-right
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
  text: string,
  isLightBg: boolean,
  accentColor: string
) {
  ctx.save();
  const boxW = 220;
  const boxH = 112;
  drawRoundedRect(ctx, x, y, boxW, boxH, 18);
  ctx.fillStyle = isLightBg ? 'rgba(255,255,255,0.88)' : 'rgba(15,23,42,0.72)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = accentColor;
  ctx.stroke();

  // Simple clean food basket icon
  const ix = x + 36;
  const iy = y + 60;
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

  // Text
  ctx.fillStyle = isLightBg ? '#1e293b' : '#ffffff';
  ctx.font = '800 20px Montserrat, Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const lines = text.split('\n');
  lines.forEach((line, idx) => {
    ctx.fillText(line, x + 68, y + 40 + idx * 26);
  });

  ctx.restore();
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
): Promise<void> {
  const { width: W, height: H, template } = state;
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Ensure web fonts are loaded before drawing
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

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

  // Optional background dim overlay for readability
  if (state.bgDim > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${state.bgDim / 100})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Subtle bottom gradient vignette so footer text is always legible
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

  // 2. Church Name Header (top center)
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = textColor;
  ctx.shadowColor = template.isLightBg ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 10;
  ctx.font = '700 28px Montserrat, Inter, sans-serif';
  drawMultilineCentered(ctx, profile.churchName.toUpperCase(), W / 2, 62 * scaleY, 34, W - 260);
  ctx.restore();

  // 3. Church Logo (top-right corner, circular badge)
  const logoImg = await getCachedImage(profile.logoDataUrl);
  if (logoImg) {
    const logoSize = 128;
    const lx = W - logoSize - 44;
    const ly = 36 * scaleY;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(lx + logoSize / 2, ly + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logoImg, lx, ly, logoSize, logoSize);
    ctx.restore();
  }

  // 4. Optional Food Badge (top-left, for Santa Ceia)
  if (state.showFoodBadge) {
    drawFoodBadge(ctx, 44, 128 * scaleY, state.foodBadgeText, template.isLightBg, accent);
  }

  // 5. Portraits Section (Preacher center + Optional Pastors & Circle Leader)
  const [preacherImg, localImg, presidentImg, circleImg] = await Promise.all([
    getCachedImage(state.preacherPhotoUrl),
    state.showLocalPastors ? getCachedImage(profile.localPastorsPhoto) : Promise.resolve(null),
    state.showPresidentPastors
      ? getCachedImage(profile.presidentPastorsPhoto)
      : Promise.resolve(null),
    state.showCircleLeader ? getCachedImage(profile.circleLeaderPhoto) : Promise.resolve(null),
  ]);

  const hasAnyPortrait = Boolean(preacherImg || localImg || presidentImg || circleImg);

  // Layout zones adapt smoothly whether portraits are present or not
  const titleBlockY = hasAnyPortrait ? 270 * scaleY : 440 * scaleY;
  const portraitBaseY = 935 * scaleY;

  // Draw side portraits first (behind center preacher for depth!)
  if (localImg) {
    drawPortraitWithBottomFade(ctx, localImg, W * 0.19, portraitBaseY, 370 * scaleY, 330);
  }
  if (presidentImg) {
    drawPortraitWithBottomFade(ctx, presidentImg, W * 0.81, portraitBaseY, 370 * scaleY, 330);
  }
  if (circleImg) {
    drawPortraitWithBottomFade(ctx, circleImg, W * 0.36, portraitBaseY - 15, 360 * scaleY, 270);
  }

  // Center preacher portrait (prominent!)
  if (preacherImg) {
    const zoomFactor = state.preacherZoom / 100;
    const centerX = circleImg ? W * 0.58 : W * 0.5;
    drawPortraitWithBottomFade(
      ctx,
      preacherImg,
      centerX,
      portraitBaseY + state.preacherOffsetY * scaleY,
      480 * scaleY * zoomFactor,
      460 * zoomFactor
    );
  }

  // 6. Main Typography Block (Eyebrow + Main Title + Subtitle)
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const titleY = titleBlockY + 24 * scaleY;
  const titleHalfH =
    template.titleStyle === 'fire-gradient' || template.titleStyle === 'impact'
      ? 84
      : template.titleStyle === 'neon-pill' || template.titleStyle === 'serif'
        ? 76
        : 68;

  // Eyebrow (always clearly above the top edge of the main title)
  if (state.eyebrow.trim()) {
    ctx.fillStyle = template.isLightBg ? accent : '#f8fafc';
    ctx.shadowColor = template.isLightBg ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 8;
    const isScriptEyebrow = template.titleStyle === 'serif';
    ctx.font = isScriptEyebrow
      ? 'italic 600 54px "Great Vibes", cursive'
      : '800 30px Montserrat, Inter, sans-serif';
    const eyebrowGap = isScriptEyebrow ? 34 : 28;
    ctx.fillText(state.eyebrow, W / 2, titleY - titleHalfH - eyebrowGap);
  }

  // Main Title
  const mainTitle = state.title.trim();
  if (mainTitle) {
    if (template.titleStyle === 'script') {
      ctx.font = '400 124px "Great Vibes", cursive';
      ctx.fillStyle = accent;
      ctx.shadowColor = 'rgba(255,255,255,0.85)';
      ctx.shadowBlur = 12;
      ctx.fillText(mainTitle, W / 2, titleY, W - 100);
    } else if (template.titleStyle === 'serif') {
      ctx.font = '700 128px "Playfair Display", Georgia, serif';
      ctx.fillStyle = textColor;
      ctx.shadowColor = 'rgba(0,0,0,0.65)';
      ctx.shadowBlur = 18;
      ctx.fillText(mainTitle, W / 2, titleY, W - 100);
    } else if (template.titleStyle === 'neon-pill') {
      ctx.font = '900 104px Anton, Montserrat, sans-serif';
      const tw = Math.min(ctx.measureText(mainTitle).width + 76, W - 90);
      const th = 132;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 24;
      drawRoundedRect(ctx, W / 2 - tw / 2, titleY - th / 2, tw, th, 28);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#0f172a';
      ctx.shadowBlur = 0;
      ctx.fillText(mainTitle, W / 2, titleY + 4, W - 130);
    } else if (template.titleStyle === 'fire-gradient') {
      ctx.font = '400 148px Anton, Montserrat, sans-serif';
      const grad = ctx.createLinearGradient(W * 0.2, titleY - 60, W * 0.8, titleY + 60);
      grad.addColorStop(0, template.secondaryColor);
      grad.addColorStop(0.5, accent);
      grad.addColorStop(1, '#dc2626');
      ctx.fillStyle = grad;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 22;
      ctx.fillText(mainTitle, W / 2, titleY, W - 90);
    } else {
      // 'impact'
      ctx.font = '400 142px Anton, Montserrat, sans-serif';
      ctx.fillStyle = accent;
      ctx.shadowColor = template.isLightBg ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.75)';
      ctx.shadowBlur = 20;
      ctx.fillText(mainTitle, W / 2, titleY, W - 90);
    }
  }

  // Subtitle (always clearly below the bottom edge of the main title)
  if (state.subtitle.trim()) {
    ctx.shadowColor = template.isLightBg ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 8;
    if (template.id === 'ceia-bronze') {
      ctx.font = '400 72px "Great Vibes", cursive';
      ctx.fillStyle = template.secondaryColor;
      ctx.fillText(state.subtitle, W / 2, titleY + titleHalfH + 34, W - 120);
    } else {
      ctx.font = '700 28px Montserrat, Inter, sans-serif';
      ctx.fillStyle = textColor;
      ctx.fillText(state.subtitle, W / 2, titleY + titleHalfH + 30, W - 140);
    }
  }
  ctx.restore();

  // 7. Preacher & Pastors Labels Band (clean pill cards just below portraits)
  const labelY = 960 * scaleY;
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
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    labelCards.forEach((card, idx) => {
      const cardW = labelCards.length === 1 ? 420 : 300;
      const cardH = 88;
      const cx =
        labelCards.length === 1
          ? W / 2
          : labelCards.length === 2
            ? idx === 0
              ? W * 0.28
              : W * 0.72
            : card.x;

      drawRoundedRect(ctx, cx - cardW / 2, labelY - cardH / 2, cardW, cardH, 16);
      ctx.fillStyle = template.isLightBg ? 'rgba(255,255,255,0.82)' : 'rgba(15,23,42,0.72)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = template.isLightBg
        ? 'rgba(159, 44, 72, 0.25)'
        : 'rgba(255, 255, 255, 0.16)';
      ctx.stroke();

      ctx.fillStyle = template.isLightBg ? accent : accent;
      ctx.font = '800 18px Montserrat, Inter, sans-serif';
      ctx.fillText(card.title.toUpperCase(), cx, labelY - 18, cardW - 24);

      ctx.fillStyle = template.isLightBg ? '#334155' : '#f8fafc';
      ctx.font = '700 19px Montserrat, Inter, sans-serif';
      ctx.fillText(card.body, cx, labelY + 14, cardW - 24);
    });

    ctx.restore();
  }

  // 8. Verse (if provided)
  if (state.verse.trim()) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = template.isLightBg ? textColor : '#f1f5f9';
    ctx.font = 'italic 600 26px "Playfair Display", Georgia, serif';
    ctx.shadowColor = template.isLightBg ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 8;
    drawMultilineCentered(ctx, state.verse, W / 2, 1068 * scaleY, 32, W - 160);
    ctx.restore();
  }

  // 9. Date & Time Pill Banner
  if (state.dateText.trim()) {
    const dateY = state.verse.trim() ? 1152 * scaleY : 1098 * scaleY;
    ctx.save();
    ctx.font = '800 34px Montserrat, Inter, sans-serif';
    const textW = ctx.measureText(state.dateText.toUpperCase()).width;
    const pillW = Math.min(Math.max(textW + 92, 420), W - 120);
    const pillH = 74;

    drawRoundedRect(ctx, W / 2 - pillW / 2, dateY - pillH / 2, pillW, pillH, 37);
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
    ctx.fillText(state.dateText.toUpperCase(), W / 2, dateY + 2, pillW - 44);
    ctx.restore();
  }

  // 10. Footer Address Bar
  if (profile.address.trim()) {
    const footerY = H - 68 * scaleY;
    ctx.save();
    ctx.font = '700 24px Montserrat, Inter, sans-serif';
    const addrText = profile.address;
    const addrW = Math.min(ctx.measureText(addrText).width, W - 160);

    // Subtle footer strip
    drawRoundedRect(ctx, 48, footerY - 32, W - 96, 64, 16);
    ctx.fillStyle = template.isLightBg ? 'rgba(255,255,255,0.82)' : 'rgba(15,23,42,0.72)';
    ctx.fill();

    drawLocationPin(ctx, W / 2 - addrW / 2 - 24, footerY, accent);

    ctx.fillStyle = template.isLightBg ? '#334155' : '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(addrText, W / 2 + 10, footerY + 1, W - 170);
    ctx.restore();
  }
}
