// Medidas em milímetros
const CARD = { w: 60, h: 72, side: 4, top: 4, bottom: 14 };   // Polaroid clássica
const COLS = 3, ROWS = 3, GAP = 6;
const PAGE = { w: 210, h: 297 };                                // A4 retrato

const GRID_W = COLS * CARD.w + (COLS - 1) * GAP;
const GRID_H = ROWS * CARD.h + (ROWS - 1) * GAP;
const X0 = (PAGE.w - GRID_W) / 2;
const Y0 = (PAGE.h - GRID_H) / 2;

function polaroidSlots() {
  const slots = [];
  for (let k = 0; k < COLS * ROWS; k++) {
    const x = X0 + (k % COLS) * (CARD.w + GAP);
    const y = Y0 + Math.floor(k / COLS) * (CARD.h + GAP);
    slots.push({
      x, y, w: CARD.w, h: CARD.h,
      photo: {
        x: x + CARD.side,
        y: y + CARD.top,
        w: CARD.w - CARD.side * 2,
        h: CARD.h - CARD.top - CARD.bottom,
      },
      guide: true,   // contorno de corte, já que a moldura é branca
    });
  }
  return slots;
}

createEditor({
  page: PAGE,
  pdfName: 'polaroids.pdf',
  slots: polaroidSlots,
});