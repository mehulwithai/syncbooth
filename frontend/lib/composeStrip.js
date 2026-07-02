// Composites the 4 rounds of paired photos into a single downloadable
// strip image (multiple themes, doodle scribble, date, wordmark) — mirrors
// the on-screen PhotoStrip component but rendered to a canvas so it can
// be exported as one PNG file.

const THEMES = {
  black: {
    bg: '#141018',
    text: '#ffffff',
    subtext: 'rgba(255, 255, 255, 0.4)',
    accent: 'rgba(255, 255, 255, 0.2)',
    scribble: '#ec4899'
  },
  white: {
    bg: '#ffffff',
    text: '#333333',
    subtext: 'rgba(51, 51, 51, 0.5)',
    accent: '#888888',
    scribble: '#ff6b6b'
  },
  cream: {
    bg: '#f6ebd4',
    text: '#7c6a51',
    subtext: 'rgba(124, 106, 81, 0.6)',
    accent: '#8b7355',
    scribble: '#d4a373'
  },
  pink: {
    bg: '#f7d1d9',
    text: '#9c4b5e',
    subtext: 'rgba(156, 75, 94, 0.6)',
    accent: '#be185d',
    scribble: '#ff758f'
  },
  blue: {
    bg: '#cedbf2',
    text: '#49648c',
    subtext: 'rgba(73, 100, 140, 0.6)',
    accent: '#1d4ed8',
    scribble: '#64dfdf'
  },
  mint: {
    bg: '#cbd9d0',
    text: '#436651',
    subtext: 'rgba(67, 102, 81, 0.6)',
    accent: '#047857',
    scribble: '#52b788'
  }
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function formatDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

export async function composeStripImage(rounds, themeKey = 'black') {
  const theme = THEMES[themeKey] || THEMES.black;

  // Scale factor to increase resolution/quality
  const SCALE = 3;

  // Slender vertical strip (400px width * SCALE)
  const W = 400 * SCALE;
  const PAD = 16 * SCALE;
  const COL_GAP = 0 * SCALE;
  const ROW_GAP = 8 * SCALE;
  
  // 3:4 Aspect Ratio tiles
  const TILE_W = (W - PAD * 2 - COL_GAP) / 2; // 184px * SCALE
  const TILE_H = 239 * SCALE; // 239px * SCALE
  
  const ROWS = rounds.length;
  const FOOTER_H = 65 * SCALE;
  const H = PAD * 2 + ROWS * TILE_H + (ROWS - 1) * ROW_GAP + FOOTER_H;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background card (sharp corners)
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);

  // Load all images in parallel
  const pairs = await Promise.all(
    rounds.map(async (r) => {
      const [img1, img2] = await Promise.all([loadImage(r.slot1_url), loadImage(r.slot2_url)]);
      return { img1, img2 };
    })
  );

  // Draw photo tiles (sharp corners)
  pairs.forEach(({ img1, img2 }, i) => {
    const y = PAD + i * (TILE_H + ROW_GAP);
    drawCover(ctx, img1, PAD, y, TILE_W, TILE_H);
    drawCover(ctx, img2, PAD + TILE_W + COL_GAP, y, TILE_W, TILE_H);
  });

  // Footer section
  const footerY = PAD * 2 + ROWS * TILE_H + (ROWS - 1) * ROW_GAP;
  
  // Horizontal accent bar (sharp corners)
  ctx.fillStyle = theme.accent;
  ctx.fillRect(W / 2 - 40 * SCALE, footerY + 16 * SCALE, 80 * SCALE, 6 * SCALE);

  // Wordmark (date removed)
  ctx.fillStyle = theme.subtext;
  ctx.font = `600 ${11 * SCALE}px monospace`;
  ctx.textAlign = 'center';
  ctx.save();
  ctx.letterSpacing = `${3 * SCALE}px`;
  ctx.fillText('SYNCBOOTH.COM', W / 2, footerY + 45 * SCALE);
  ctx.restore();

  return canvas.toDataURL('image/png');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCover(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx, sy, sw, sh;

  if (imgRatio > boxRatio) {
    sh = img.height;
    sw = sh * boxRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / boxRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
