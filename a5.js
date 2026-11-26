// Medidas em milímetros
const PAGE = { w: 210, h: 297 };   // A4 retrato
const A5 = { w: 148.5, h: 210 };   // A5 em pé (metade exata da A4)

const CUT_LINE = { color: '#000', width: 0.3 };   // linha preta contínua de 0,3 mm

function fullSlot(x, y, w, h) {
  return { x, y, w, h, photo: { x, y, w, h }, guide: CUT_LINE };
}
function a5Slots() {
  if (document.getElementById('layout').value === '1') {
    // 1 foto A5 em pé, centralizada na folha
    return [fullSlot((PAGE.w - A5.w) / 2, (PAGE.h - A5.h) / 2, A5.w, A5.h)];
  }
  // 2 fotos A5 deitadas (210 × 148,5), uma em cima da outra
  return [
    fullSlot(0, 0, A5.h, A5.w),
    fullSlot(0, A5.w, A5.h, A5.w),
  ];
}

const editor = createEditor({
  page: PAGE,
  pdfName: 'fotos-a5.pdf',
  slots: a5Slots,
});

document.getElementById('layout').addEventListener('change', () => editor.render());