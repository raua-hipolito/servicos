// Motor compartilhado: carrega fotos, desenha a folha, edita o enquadramento e exporta o PDF.
// Cada modo (polaroid, a5) só informa o tamanho da página e a posição dos "slots".
//
// cfg = {
//   page:    { w, h }          tamanho da folha em mm
//   pdfName: 'arquivo.pdf'
//   slots:   () => [ { x, y, w, h, photo: { x, y, w, h }, guide: bool } ]
// }
function createEditor(cfg) {
  const PAGE = cfg.page;
  const PREVIEW_SCALE = 4;   // pixels por mm no preview
  const PRINT_DPI = 300;
  const ACCENT = '#0f7b6c';

  let photos = [];           // { img, name, zoom, ox, oy, rot }
  let selected = -1;
  let page = 0;
  let drag = null;

  const $ = id => document.getElementById(id);
  const cv = $('sheet');
  const ctx = cv.getContext('2d');
  cv.width = PAGE.w * PREVIEW_SCALE;
  cv.height = PAGE.h * PREVIEW_SCALE;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const perPage = () => cfg.slots().length;
  const pageCount = () => Math.max(1, Math.ceil(photos.length / perPage()));
  const sel = () => photos[selected];

  // ---------- Desenho ----------
  function drawPhoto(c, p, r) {
    const odd = p.rot % 2 === 1;
    const sw = odd ? p.img.naturalHeight : p.img.naturalWidth;
    const sh = odd ? p.img.naturalWidth : p.img.naturalHeight;
    const sc = Math.max(r.w / sw, r.h / sh) * p.zoom;

    // Impede que apareçam faixas vazias dentro da moldura
    const mx = Math.max(0, (sw * sc - r.w) / 2 / r.w);
    const my = Math.max(0, (sh * sc - r.h) / 2 / r.h);
    p.ox = clamp(p.ox, -mx, mx);
    p.oy = clamp(p.oy, -my, my);

    c.save();
    c.beginPath();
    c.rect(r.x, r.y, r.w, r.h);
    c.clip();
    c.translate(r.x + r.w / 2 + p.ox * r.w, r.y + r.h / 2 + p.oy * r.h);
    c.rotate(p.rot * Math.PI / 2);
    c.scale(sc, sc);
    c.drawImage(p.img, -p.img.naturalWidth / 2, -p.img.naturalHeight / 2);
    c.restore();
  }

  // s = pixels por mm. preview = mostra espaços vazios e seleção.
  function drawPage(c, s, pageIdx, preview) {
    const slots = cfg.slots();
    c.save();
    c.scale(s, s);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.fillStyle = '#fff';
    c.fillRect(0, 0, PAGE.w, PAGE.h);

    slots.forEach((slot, k) => {
      const idx = pageIdx * slots.length + k;
      const p = photos[idx];

      if (!p) {
        if (preview) {
          c.setLineDash([1.5, 1.5]);
          c.lineWidth = 0.25;
          c.strokeStyle = '#d3d9df';
          c.strokeRect(slot.x + 0.3, slot.y + 0.3, slot.w - 0.6, slot.h - 0.6);
          c.setLineDash([]);
        }
        return;
      }

      c.fillStyle = '#fff';
      c.fillRect(slot.x, slot.y, slot.w, slot.h);
      drawPhoto(c, p, slot.photo);
      if (slot.guide) {   // contorno fino: guia de corte
        const g = typeof slot.guide === 'object'
          ? slot.guide
          : { color: '#c9ced4', width: 0.2 };
        c.setLineDash([]);   // linha contínua
        c.lineWidth = g.width;
        c.strokeStyle = g.color;
        // desenhada para dentro, para não ser cortada na borda da folha
        c.strokeRect(
          slot.x + g.width / 2,
          slot.y + g.width / 2,
          slot.w - g.width,
          slot.h - g.width
        );
      }
      if (preview && idx === selected) {
        c.lineWidth = 0.9;
        c.strokeStyle = ACCENT;
        c.strokeRect(slot.x + 0.45, slot.y + 0.45, slot.w - 0.9, slot.h - 0.9);
      }
    });
    c.restore();

    if (preview && photos.length === 0) {
      c.fillStyle = '#5d6b7a';
      c.font = `${4.2 * s}px system-ui, sans-serif`;
      c.textAlign = 'center';
      c.fillText('Adicione fotos para começar', cv.width / 2, cv.height / 2);
    }
  }

  // ---------- Atualização da tela ----------
  function render() {
    page = clamp(page, 0, pageCount() - 1);
    drawPage(ctx, PREVIEW_SCALE, page, true);

    $('pageLabel').textContent = `Folha ${page + 1} de ${pageCount()}`;
    $('prev').disabled = page === 0;
    $('next').disabled = page >= pageCount() - 1;
    $('btnPdf').disabled = photos.length === 0;
    $('status').textContent = photos.length
      ? `${photos.length} foto${photos.length > 1 ? 's' : ''} · ${pageCount()} folha${pageCount() > 1 ? 's' : ''}`
      : 'Nenhuma foto adicionada.';

    const has = selected >= 0 && photos[selected];
    $('controls').style.display = has ? 'flex' : 'none';
    $('noSel').style.display = has ? 'none' : 'block';
    if (has) {
      $('zoom').value = photos[selected].zoom;
      $('moveBack').disabled = selected === 0;
      $('moveFwd').disabled = selected === photos.length - 1;
    }
  }

  // ---------- Adicionar fotos ----------
  function addFiles(fileList) {
    const files = [...fileList].filter(f => f.type.startsWith('image/'));
    if (!files.length) return;

    let pending = files.length;
    const loaded = new Array(files.length);

    files.forEach((f, i) => {
      const img = new Image();
      const url = URL.createObjectURL(f);
      img.onload = () => {
        loaded[i] = { img, name: f.name, zoom: 1, ox: 0, oy: 0, rot: 0 };
        done();
      };
      img.onerror = () => {
        loaded[i] = null;
        URL.revokeObjectURL(url);
        done();
      };
      img.src = url;
    });

    function done() {
      if (--pending > 0) return;
      photos.push(...loaded.filter(Boolean));
      render();
    }
  }

  $('file').addEventListener('change', e => {
    addFiles(e.target.files);
    e.target.value = '';
  });
  ['dragenter', 'dragover'].forEach(t =>
    window.addEventListener(t, e => {
      e.preventDefault();
      document.body.classList.add('dragging');
    })
  );
  ['dragleave', 'drop'].forEach(t =>
    window.addEventListener(t, e => {
      e.preventDefault();
      document.body.classList.remove('dragging');
    })
  );
  window.addEventListener('drop', e => addFiles(e.dataTransfer.files));

  // ---------- Interação com a folha ----------
  function slotAt(e) {
    const r = cv.getBoundingClientRect();
    const mm = {
      x: (e.clientX - r.left) / r.width * PAGE.w,
      y: (e.clientY - r.top) / r.height * PAGE.h,
      mmPerPx: PAGE.w / r.width,
    };
    const slots = cfg.slots();
    for (let k = 0; k < slots.length; k++) {
      const o = slots[k];
      if (mm.x >= o.x && mm.x <= o.x + o.w && mm.y >= o.y && mm.y <= o.y + o.h) {
        const idx = page * slots.length + k;
        return { idx: photos[idx] ? idx : -1, mm };
      }
    }
    return { idx: -1, mm };
  }

  cv.addEventListener('pointerdown', e => {
    const { idx, mm } = slotAt(e);
    selected = idx;
    if (idx >= 0) {
      drag = { x: e.clientX, y: e.clientY, mmPerPx: mm.mmPerPx };
      cv.setPointerCapture(e.pointerId);
      cv.style.cursor = 'grabbing';
    }
    render();
  });

  cv.addEventListener('pointermove', e => {
    if (!drag) {
      cv.style.cursor = slotAt(e).idx >= 0 ? 'grab' : 'default';
      return;
    }
    const p = photos[selected];
    const r = cfg.slots()[selected % perPage()].photo;
    p.ox += (e.clientX - drag.x) * drag.mmPerPx / r.w;
    p.oy += (e.clientY - drag.y) * drag.mmPerPx / r.h;
    drag.x = e.clientX;
    drag.y = e.clientY;
    render();
  });

  ['pointerup', 'pointercancel'].forEach(t =>
    cv.addEventListener(t, () => {
      drag = null;
      cv.style.cursor = 'grab';
    })
  );

  cv.addEventListener('wheel', e => {
    const { idx } = slotAt(e);
    if (idx < 0) return;
    e.preventDefault();
    selected = idx;
    const p = photos[idx];
    p.zoom = clamp(p.zoom * (e.deltaY < 0 ? 1.06 : 1 / 1.06), 1, 3);
    render();
  }, { passive: false });

  // ---------- Controles do painel direito ----------
  $('zoom').addEventListener('input', e => { sel().zoom = parseFloat(e.target.value); render(); });
  $('rotL').addEventListener('click', () => { sel().rot = (sel().rot + 3) % 4; render(); });
  $('rotR').addEventListener('click', () => { sel().rot = (sel().rot + 1) % 4; render(); });
  $('reset').addEventListener('click', () => { Object.assign(sel(), { zoom: 1, ox: 0, oy: 0 }); render(); });

  $('remove').addEventListener('click', () => {
    photos.splice(selected, 1);
    selected = -1;
    render();
  });

  function move(d) {
    const j = selected + d;
    if (j < 0 || j >= photos.length) return;
    [photos[selected], photos[j]] = [photos[j], photos[selected]];
    selected = j;
    page = Math.floor(j / perPage());
    render();
  }
  $('moveBack').addEventListener('click', () => move(-1));
  $('moveFwd').addEventListener('click', () => move(1));
  $('prev').addEventListener('click', () => { page--; render(); });
  $('next').addEventListener('click', () => { page++; render(); });

  // ---------- Exportar PDF (tamanho real, 300 dpi) ----------
  $('btnPdf').addEventListener('click', async () => {
    if (!window.jspdf) {
      alert('Não foi possível carregar a biblioteca jsPDF. Verifique sua conexão com a internet e recarregue a página.');
      return;
    }

    const btn = $('btnPdf');
    const label = btn.textContent;
    btn.disabled = true;

    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: 'mm', format: [PAGE.w, PAGE.h], orientation: 'portrait' });
      const s = PRINT_DPI / 25.4;

      const off = document.createElement('canvas');
      off.width = Math.round(PAGE.w * s);
      off.height = Math.round(PAGE.h * s);
      const octx = off.getContext('2d');

      for (let i = 0; i < pageCount(); i++) {
        btn.textContent = `Gerando folha ${i + 1} de ${pageCount()}…`;
        await new Promise(r => setTimeout(r, 30)); // deixa o botão atualizar

        octx.clearRect(0, 0, off.width, off.height);
        drawPage(octx, off.width / PAGE.w, i, false);

        if (i > 0) pdf.addPage([PAGE.w, PAGE.h], 'portrait');
        pdf.addImage(off.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, PAGE.w, PAGE.h);
      }
      pdf.save(cfg.pdfName);
    } catch (err) {
      console.error(err);
      alert('Ocorreu um erro ao gerar o PDF. Tente com menos fotos ou fotos menores.');
    } finally {
      btn.textContent = label;
      btn.disabled = photos.length === 0;
    }
  });

  // Chamado quando o modelo muda: volta para a folha da foto selecionada
  function relayout() {
    page = selected >= 0 ? Math.floor(selected / perPage()) : 0;
    render();
  }

  render();
  return { render, relayout };
}