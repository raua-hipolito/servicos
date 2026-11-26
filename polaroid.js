// Medidas em milímetros
const PAGE = { w: 210, h: 297 };   // A4 retrato
const MARGIN = 5.5;                // margem de segurança da folha

// ratio = altura / largura da Polaroid
const MODELS = {
  '9':  { cols: 3, rows: 3, gap: 4, ratio: 1.2  },
  '4':  { cols: 2, rows: 2, gap: 4, ratio: 1.2  },
  '6':  { cols: 2, rows: 3, gap: 4, ratio: 1.2  },
  '12': { cols: 3, rows: 4, gap: 3, ratio: 1.25 },   // mini
};
let current = '9';

// Calcula o maior tamanho de Polaroid que cabe na folha para o modelo escolhido
function cardSize(m) {
  const availW = PAGE.w - MARGIN * 2;
  const availH = PAGE.h - MARGIN * 2;
  const wByWidth  = (availW - (m.cols - 1) * m.gap) / m.cols;
  const wByHeight = ((availH - (m.rows - 1) * m.gap) / m.rows) / m.ratio;
  const w = Math.min(wByWidth, wByHeight);
  const side = w * 0.0667;          // borda lateral e superior
  return { w, h: w * m.ratio, side, top: side, bottom: w * 0.2333 };
}

function polaroidSlots() {
  const m = MODELS[current];
  const c = cardSize(m);
  const gridW = m.cols * c.w + (m.cols - 1) * m.gap;
  const gridH = m.rows * c.h + (m.rows - 1) * m.gap;
  const x0 = (PAGE.w - gridW) / 2;
  const y0 = (PAGE.h - gridH) / 2;

  const slots = [];
  for (let k = 0; k < m.cols * m.rows; k++) {
    const x = x0 + (k % m.cols) * (c.w + m.gap);
    const y = y0 + Math.floor(k / m.cols) * (c.h + m.gap);
    slots.push({
      x, y, w: c.w, h: c.h,
      photo: {
        x: x + c.side,
        y: y + c.top,
        w: c.w - c.side * 2,
        h: c.h - c.top - c.bottom,
      },
      guide: true,   // contorno de corte, já que a moldura é branca
    });
  }
  return slots;
}

const editor = createEditor({
  page: PAGE,
  pdfName: 'polaroids.pdf',
  slots: polaroidSlots,
});

// ---------- Seleção do modelo ----------
const fmt = mm => (mm / 10).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function updateInfo() {
  const c = cardSize(MODELS[current]);
  document.getElementById('modelInfo').textContent =
    `Cada Polaroid: ${fmt(c.w)} × ${fmt(c.h)} cm.`;
}

document.querySelectorAll('.models button').forEach(btn => {
  btn.addEventListener('click', () => {
    current = btn.dataset.model;
    document.querySelectorAll('.models button').forEach(b => b.classList.toggle('on', b === btn));
    updateInfo();
    editor.relayout();
  });
});

updateInfo();