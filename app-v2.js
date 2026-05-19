const cardsRoot = document.getElementById('cards');
const pdfBtn = document.getElementById('download-pdf-v2');
const EDITS_KEY = 'reference-list-v2-edits';

function loadEdits() {
  try {
    return JSON.parse(localStorage.getItem(EDITS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveEdits(edits) {
  localStorage.setItem(EDITS_KEY, JSON.stringify(edits));
}

function fixMojibake(text) {
  if (typeof text !== 'string') return text;
  if (!/[РС][\u0400-\u04FF]/.test(text) && !text.includes('в„–')) return text;
  try {
    return decodeURIComponent(escape(text));
  } catch {
    return text;
  }
}

function normalizeRecord(record) {
  const normalized = {};
  Object.entries(record || {}).forEach(([rawKey, rawVal]) => {
    const key = fixMojibake(rawKey);
    const val = typeof rawVal === 'string' ? fixMojibake(rawVal) : rawVal;
    normalized[key] = val;
  });

  if (!normalized['№'] && normalized['в„–']) {
    normalized['№'] = normalized['в„–'];
  }

  return normalized;
}

function makeField(title, value) {
  const wrap = document.createElement('div');
  wrap.className = 'field';

  const t = document.createElement('div');
  t.className = 'row-title';
  t.textContent = title;

  const v = document.createElement('div');
  v.className = 'val';
  v.textContent = value || '—';
  v.setAttribute('contenteditable', 'plaintext-only');

  wrap.append(t, v);
  return wrap;
}

function fullTitle(text) {
  const clean = (text || '').trim();
  return clean || 'Объект строительства';
}

function buildCard(record, index, edits) {
  const card = document.createElement('article');
  card.className = `project${index % 2 ? ' alt' : ''}`;
  card.dataset.index = String(index);

  const top = document.createElement('div');
  top.className = 'project-top';
  top.setAttribute('contenteditable', 'plaintext-only');
  top.setAttribute('data-edit-key', `${index}:top`);
  top.textContent = edits[`${index}:top`] ?? fullTitle(record['Наименование объекта']);

  const badge = document.createElement('div');
  badge.className = 'badge';
  badge.textContent = edits[`${index}:badge`] ?? `#${record['№'] || index + 1}`;
  badge.setAttribute('contenteditable', 'plaintext-only');
  badge.setAttribute('data-edit-key', `${index}:badge`);

  const body = document.createElement('div');
  body.className = 'project-body';
  const fields = [
    ['Договор', record['Договор']],
    ['Застройщик', record['Застройщик']],
    ['Дата окончания строительства', record['Дата окончания строительства']],
    ['Наименование объекта', record['Наименование объекта']],
    ['Адрес объекта строительства', record['Адрес объекта строительства']],
    ['Виды работ', record['Виды работ']],
    ['Краткие сведения об объекте', record['Краткие сведения об объекте']]
  ];

  fields.forEach(([label, val], fieldIndex) => {
    const field = makeField(label, edits[`${index}:field:${fieldIndex}`] ?? val);
    field.querySelector('.val')?.setAttribute('data-edit-key', `${index}:field:${fieldIndex}`);
    body.append(field);
  });

  card.append(top, badge, body);
  return card;
}

function wireInlineEditing(edits) {
  cardsRoot.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const key = target.getAttribute('data-edit-key');
    if (!key) return;
    edits[key] = target.textContent || '';
    saveEdits(edits);
  });
}

function fitCardForPdf(card) {
  const top = card.querySelector('.project-top');
  const body = card.querySelector('.project-body');
  if (!top || !body) return;

  top.style.maxHeight = 'none';
  top.style.overflow = 'visible';
  top.style.lineHeight = '1.35';

  const rowTitles = Array.from(card.querySelectorAll('.row-title'));
  const values = Array.from(card.querySelectorAll('.val'));
  let bodySize = 9;
  let titleSize = 9;
  let tries = 0;

  while (body.scrollHeight > body.clientHeight && tries < 12) {
    tries += 1;
    bodySize = Math.max(7.8, bodySize - 0.2);
    titleSize = Math.max(7.6, titleSize - 0.2);
    body.style.fontSize = `${bodySize.toFixed(1)}px`;
    body.style.lineHeight = '1.35';
    rowTitles.forEach((el) => {
      el.style.fontSize = `${titleSize.toFixed(1)}px`;
      el.style.lineHeight = '1.2';
    });
    values.forEach((el) => {
      el.style.lineHeight = '1.3';
    });
  }

  let topSize = parseFloat(getComputedStyle(top).fontSize || '10');
  while (body.scrollHeight > body.clientHeight && topSize > 8.2) {
    topSize -= 0.2;
    top.style.fontSize = `${topSize.toFixed(1)}px`;
  }
}

function buildPdfPages(sourceCards, heroTemplate) {
  const pagesWrap = document.createElement('div');
  pagesWrap.className = 'pdf-pages';

  for (let i = 0; i < sourceCards.length; i += 4) {
    const page = document.createElement('section');
    page.className = 'pdf-page';

    const header = heroTemplate.cloneNode(true);
    header.classList.add('pdf-sheet-header');
    header.querySelectorAll('.btn').forEach((b) => b.remove());
    page.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'pdf-page-grid';

    for (let j = 0; j < 4; j += 1) {
      if (sourceCards[i + j]) {
        const card = sourceCards[i + j].cloneNode(true);
        grid.appendChild(card);
      } else {
        const spacer = document.createElement('article');
        spacer.className = 'project';
        spacer.style.visibility = 'hidden';
        grid.appendChild(spacer);
      }
    }

    grid.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
    grid.querySelectorAll('.project').forEach((card) => fitCardForPdf(card));
    page.appendChild(grid);
    pagesWrap.appendChild(page);
  }

  return pagesWrap;
}

async function init() {
  const res = await fetch('./data/reference-data.json', { cache: 'no-store' });
  const payload = await res.json();
  const rows = (payload.records || []).map(normalizeRecord);
  const edits = loadEdits();

  rows.forEach((r, i) => {
    cardsRoot.appendChild(buildCard(r, i, edits));
  });

  wireInlineEditing(edits);

  const line = document.createElement('div');
  line.className = 'timeline-line';
  document.querySelector('.timeline-wrap').appendChild(line);

  pdfBtn.addEventListener('click', async () => {
    pdfBtn.disabled = true;
    const old = pdfBtn.textContent;
    pdfBtn.textContent = 'Подготовка PDF...';
    let mount = null;

    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }

      const source = document.getElementById('pdf-root-v2');
      const clone = source.cloneNode(true);
      document.body.classList.add('pdf-mode');
      clone.id = 'pdf-v2-export';

      const cloneCards = Array.from(clone.querySelectorAll('.project'));
      const heroTemplate = clone.querySelector('.hero');
      const cardsContainer = clone.querySelector('#cards');
      const pages = buildPdfPages(cloneCards, heroTemplate);
      cardsContainer.replaceWith(pages);

      const heroEl = clone.querySelector('.hero');
      if (heroEl) heroEl.remove();

      const lineEl = clone.querySelector('.timeline-line');
      if (lineEl) lineEl.remove();

      mount = document.createElement('div');
      mount.style.position = 'fixed';
      mount.style.left = '-99999px';
      mount.style.top = '0';
      mount.style.width = '297mm';
      mount.style.height = 'auto';
      mount.style.overflow = 'visible';
      mount.style.background = '#fff';
      mount.appendChild(clone);
      document.body.appendChild(mount);

      const JsPdfCtor = window.jspdf?.jsPDF || window.jsPDF;
      const pagesEls = Array.from(clone.querySelectorAll('.pdf-page'));

      if (JsPdfCtor && window.html2canvas) {
        const pdf = new JsPdfCtor({ unit: 'mm', format: 'a4', orientation: 'landscape' });
        for (let i = 0; i < pagesEls.length; i += 1) {
          const pageEl = pagesEls[i];
          const canvas = await html2canvas(pageEl, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false
          });
          const img = canvas.toDataURL('image/jpeg', 0.98);
          if (i > 0) pdf.addPage('a4', 'landscape');
          pdf.addImage(img, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
        }
        pdf.save('reference-list-v2.pdf');
      } else if (window.html2pdf) {
        await html2pdf().from(clone).set({
          margin: [0, 0, 0, 0],
          filename: 'reference-list-v2.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
          pagebreak: { mode: ['css'] }
        }).save();
      } else {
        throw new Error('PDF libraries are not available in window');
      }
    } catch (error) {
      console.error(error);
      alert('Не удалось сформировать PDF. Обновите страницу и попробуйте снова.');
    } finally {
      document.body.classList.remove('pdf-mode');
      if (mount) mount.remove();
      pdfBtn.disabled = false;
      pdfBtn.textContent = old;
    }
  });
}

init();
