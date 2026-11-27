// Medidas em milímetros
const PAGE = { w: 100, h: 150 };   // A6 retrato (10 × 15 cm)
const PHOTO = { w: 30, h: 40 };    // foto 3 × 4 cm
const CUT_LINE = { color: '#000', width: 0.15 };   // linha fina de corte

const LAYOUTS = {
  '2x3': { cols: 2, rows: 3, gap: 3 },
  '3x2': { cols: 3, rows: 2, gap: 2 },
};

const AI_LIB = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.8/+esm';
const AI_MAX_SIDE = 768;   // tamanho de trabalho da IA (sobra para 3 × 4 cm a 300 dpi)

const $ = id => document.getElementById(id);

// ---------- Posição das 6 fotos ----------
function slots() {
  const L = LAYOUTS[$('layout').value];
  const gridW = L.cols * PHOTO.w + (L.cols - 1) * L.gap;
  const gridH = L.rows * PHOTO.h + (L.rows - 1) * L.gap;
  const x0 = (PAGE.w - gridW) / 2;
  const y0 = (PAGE.h - gridH) / 2;

  const out = [];
  for (let k = 0; k < L.cols * L.rows; k++) {
    const x = x0 + (k % L.cols) * (PHOTO.w + L.gap);
    const y = y0 + Math.floor(k / L.cols) * (PHOTO.h + L.gap);
    out.push({
      x, y, w: PHOTO.w, h: PHOTO.h,
      photo: { x, y, w: PHOTO.w, h: PHOTO.h },
      guide: CUT_LINE,
    });
  }
  return out;
}

// ---------- Utilidades ----------
function toCanvas(img, maxSide) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const k = Math.min(1, maxSide / Math.max(iw, ih));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(iw * k));
  c.height = Math.max(1, Math.round(ih * k));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}

// Coloca o recorte (com transparência) sobre a cor escolhida
function compose(cut, hex) {
  const c = document.createElement('canvas');
  c.width = cut.width;
  c.height = cut.height;
  const x = c.getContext('2d');
  x.fillStyle = hex;
  x.fillRect(0, 0, c.width, c.height);
  x.drawImage(cut, 0, 0);
  return c;
}

// ---------- Método inteligente (IA no navegador) ----------
let libPromise = null;
function loadLib() {
  if (!libPromise) {
    libPromise = import(AI_LIB).catch(err => { libPromise = null; throw err; });
  }
  return libPromise;
}

async function aiCut(img) {
  const base = toCanvas(img, AI_MAX_SIDE);
  const blob = await new Promise(res => base.toBlob(res, 'image/png'));
  const lib = await loadLib();
  const remove = lib.removeBackground || lib.default;
  const out = await remove(blob, { model: 'isnet_quint8' });   // modelo mais leve e rápido
  const bmp = await createImageBitmap(out);
  const cut = document.createElement('canvas');
  cut.width = bmp.width;
  cut.height = bmp.height;
  cut.getContext('2d').drawImage(bmp, 0, 0);
  return cut;
}

// ---------- Método simples (só fundo branco liso, ligado às bordas) ----------
function simpleRemove(img, tol, hex) {
  const c = toCanvas(img, AI_MAX_SIDE);
  const w = c.width, h = c.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const im = ctx.getImageData(0, 0, w, h);
  const d = im.data;

  const lim = 255 - tol;
  const isBg = i => d[i * 4] >= lim && d[i * 4 + 1] >= lim && d[i * 4 + 2] >= lim;

  const bg = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let sp = 0;
  const push = i => { if (!bg[i] && isBg(i)) { bg[i] = 1; stack[sp++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp) {
    const i = stack[--sp];
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }

  const R = parseInt(hex.slice(1, 3), 16);
  const G = parseInt(hex.slice(3, 5), 16);
  const B = parseInt(hex.slice(5, 7), 16);
  for (let i = 0; i < w * h; i++) {
    if (bg[i]) {
      const p = i * 4;
      d[p] = R; d[p + 1] = G; d[p + 2] = B; d[p + 3] = 255;
    }
  }
  ctx.putImageData(im, 0, 0);
  return c;
}

// ---------- Aplicar nas fotos ----------
let job = 0;   // se o usuário mexer de novo no meio do processo, recomeça

async function processPhotos(list) {
  const my = ++job;
  const on = $('rmbg').checked;
  const method = $('method').value;
  const color = $('bgcolor').value;
  const tol = +$('tol').value;
  const status = $('status');
  let aiFailed = false;

  for (let i = 0; i < list.length; i++) {
    if (my !== job) return;
    const p = list[i];

    if (!on) {
      p.img = p.orig;
    } else if (method === 'ai' && !aiFailed) {
      try {
        if (!p.cut) {
          status.textContent = i === 0 && !libPromise
            ? 'Carregando o modelo de IA (só na primeira vez, pode demorar)…'
            : `Recortando fundo… ${i + 1} de ${list.length}`;
          await new Promise(r => setTimeout(r, 0));   // deixa a tela atualizar
          p.cut = await aiCut(p.orig);
        }
        p.img = compose(p.cut, color);
      } catch (err) {
        console.error('Falha no recorte por IA:', err);
        aiFailed = true;
        p.img = simpleRemove(p.orig, tol, color);
      }
    } else {
      p.img = simpleRemove(p.orig, tol, color);
    }
    editor.render();
  }

  if (my !== job) return;
  if (aiFailed) {
    status.textContent = 'Não consegui carregar a IA (precisa de internet). Usei o método simples.';
  }
  editor.render();
}

const editor = createEditor({
  page: PAGE,
  pdfName: 'fotos-3x4.pdf',
  slots,
  onAdd: processPhotos,
});

// ---------- Opções ----------
function syncUi() {
  const simple = $('method').value === 'simple';
  $('tolWrap').hidden = !simple;
  $('tolWrap').style.display = simple ? 'grid' : 'none';
  $('bgHint').style.display = simple ? 'none' : 'block';
}

let timer;
function reprocessAll() {
  clearTimeout(timer);
  timer = setTimeout(() => processPhotos(editor.getPhotos()), 150);
}

['rmbg', 'method', 'bgcolor', 'tol'].forEach(id => $(id).addEventListener('input', () => {
  syncUi();
  reprocessAll();
}));
$('layout').addEventListener('change', () => editor.relayout());
syncUi();