import { priceMidpoint, formatUSD } from '../util/price.js';

// Config panel: swatch rows, part pickers, and a build sheet that doubles as
// a checkout list (vendor link per item, open-all button). Vanilla DOM.
// main.js owns the build state; the panel renders it and reports clicks.

const WRAP_BASE_EST = 3750; // midpoint of "most quality quotes ~$3,000-4,500"
const WRAP_FINISH_ADJ = { satin: 400, matte: 400 };
const WRAP_FLIP_EST = 5500; // "color-flip films ~$4,500-6,500+"

export function wrapCostEstimate(finish) {
  if (finish === 'color-flip') return WRAP_FLIP_EST;
  return WRAP_BASE_EST + (WRAP_FINISH_ADJ[finish] || 0);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function needsFitmentFlag(notes) {
  return notes ? /FL5|FK8|verify|confirm|fitment uncertain/i.test(notes) : false;
}

export function initPanel(root, { db, actions }) {
  root.innerHTML = '';

  const refs = { swatches: new Map(), rows: new Map(), sections: new Map(), buildSheet: null, total: null };

  // Collapsible category card: header shows the current selection so the
  // default panel is a short list of categories, not the whole catalog
  // (accordion: opening one closes the others). Returns the content body.
  function section(title, hint, { collapsible = true } = {}) {
    const s = el('section', `panel-section${collapsible ? '' : ' open'}`);
    const head = el(collapsible ? 'button' : 'div', 'section-head');
    head.appendChild(el('span', 'sec-title', title));
    let current = null;
    if (collapsible) {
      current = el('span', 'sec-current', '');
      head.appendChild(current);
      head.appendChild(el('span', 'chev', '▾'));
      head.addEventListener('click', () => {
        const wasOpen = s.classList.contains('open');
        for (const o of refs.sections.values()) o.sec.classList.remove('open');
        if (!wasOpen) s.classList.add('open');
      });
    }
    s.appendChild(head);
    const body = el('div', 'section-body');
    if (hint) body.appendChild(el('p', 'hint', hint));
    s.appendChild(body);
    root.appendChild(s);
    if (collapsible) refs.sections.set(title, { sec: s, current });
    return body;
  }

  // Paint: factory swatches with year badges, then wraps with finish badges.
  const paintSec = section('Color', 'Factory colors are $0. Wraps show installed estimates.');
  const factoryRow = el('div', 'swatch-row');
  for (const color of db.factory_colors) {
    const sw = el('button', 'swatch');
    sw.style.background = color.hex;
    const is2024 = color.years.includes('2024');
    sw.title = `${color.name} (${color.years})`;
    if (!is2024) sw.appendChild(el('span', 'swatch-badge', color.years));
    sw.addEventListener('click', () => actions.selectFactory(color));
    refs.swatches.set(`factory:${color.name}`, sw);
    factoryRow.appendChild(sw);
  }
  paintSec.appendChild(el('h3', null, 'Factory'));
  paintSec.appendChild(factoryRow);

  const wrapRow = el('div', 'swatch-row');
  for (const wrap of db.wraps) {
    const sw = el('button', 'swatch');
    sw.style.background = wrap.hex;
    sw.title = `${wrap.name} | ${wrap.line} | ${wrap.finish} | est ${formatUSD(wrapCostEstimate(wrap.finish))} installed`;
    sw.appendChild(el('span', 'swatch-badge', wrap.finish));
    sw.addEventListener('click', () => actions.selectWrap(wrap));
    refs.swatches.set(`wrap:${wrap.name}`, sw);
    wrapRow.appendChild(sw);
  }
  paintSec.appendChild(el('h3', null, 'Wraps'));
  paintSec.appendChild(wrapRow);

  // Generic picker list used by suspension / wheels / exhaust.
  function pickerSection(title, hint, items, { key, label, sub, price, stockLabel, onPick }) {
    const sec = section(title, hint);
    const list = el('div', 'pick-list');
    sec.appendChild(list);

    if (stockLabel) {
      const row = el('button', 'pick-row');
      row.appendChild(el('span', 'pick-label', stockLabel));
      row.appendChild(el('span', 'pick-price', '$0'));
      row.addEventListener('click', () => onPick(null));
      refs.rows.set(`${key}:stock`, row);
      list.appendChild(row);
    }

    for (const item of items) {
      const row = el('button', 'pick-row');
      const labelWrap = el('span', 'pick-label');
      labelWrap.appendChild(el('span', null, label(item)));
      const subText = sub(item);
      if (subText) labelWrap.appendChild(el('span', 'pick-sub', subText));
      if (needsFitmentFlag(item.notes)) {
        const flag = el('span', 'flag-badge', 'verify fitment');
        flag.title = item.notes;
        labelWrap.appendChild(flag);
      }
      row.appendChild(labelWrap);
      row.appendChild(el('span', 'pick-price', formatUSD(priceMidpoint(price(item)))));
      row.addEventListener('click', () => onPick(item));
      refs.rows.set(`${key}:${label(item)}`, row);
      list.appendChild(row);
    }
    return sec;
  }

  pickerSection(
    'Suspension', 'Drops render live on the car.',
    db.suspension,
    {
      key: 'susp',
      label: (i) => `${i.brand} ${i.product}`,
      sub: (i) => (i.drop_front_in != null
        ? `-${i.drop_front_in}in F / -${i.drop_rear_in}in R`
        : 'drop unpublished, ~1.0in shown'),
      price: (i) => i.price,
      stockLabel: 'Stock (adaptive dampers)',
      onPick: (i) => actions.selectSuspension(i),
    },
  );

  pickerSection(
    'Wheels', 'Rendered on the car in the first listed finish.',
    db.wheels,
    {
      key: 'wheel',
      label: (i) => `${i.brand} ${i.model}`,
      sub: (i) => `${i.size} ${i.offset} | ${i.style}`,
      price: (i) => i.price_set,
      stockLabel: 'Stock 19x9.5 +60',
      onPick: (i) => actions.selectWheels(i),
    },
  );

  pickerSection(
    'Exhaust', 'All triple center except the A\'PEXi dual conversion.',
    db.exhausts,
    {
      key: 'exh',
      label: (i) => `${i.brand} ${i.product}`,
      sub: (i) => i.config,
      price: (i) => i.price,
      stockLabel: 'Stock (active valve)',
      onPick: (i) => actions.selectExhaust(i),
    },
  );

  // Build sheet / checkout: always visible, it is the running summary.
  const buildSec = section('Build sheet', null, { collapsible: false });
  refs.buildSheet = el('div', 'build-sheet');
  buildSec.appendChild(refs.buildSheet);
  refs.total = el('div', 'build-total');
  buildSec.appendChild(refs.total);
  const copyLink = el('button', 'open-all copy-link', 'Copy build link');
  copyLink.addEventListener('click', () => {
    actions.copyBuildLink().then(
      () => { copyLink.textContent = 'Link copied'; },
      () => { copyLink.textContent = 'Copy failed, grab the URL bar'; },
    );
    setTimeout(() => { copyLink.textContent = 'Copy build link'; }, 1800);
  });
  buildSec.appendChild(copyLink);
  const openAll = el('button', 'open-all', 'Open vendor pages for checkout');
  openAll.addEventListener('click', () => actions.openVendorPages());
  buildSec.appendChild(openAll);
  buildSec.appendChild(el('p', 'hint', 'Opens each part\'s vendor page in a new tab. Your browser may ask to allow pop-ups. Prices researched Aug 2026, verify at checkout.'));

  // Credits (CC-BY attribution is a license requirement, keep visible).
  const credits = el('footer', 'credits');
  credits.innerHTML =
    'FL5 3D model: <a href="https://sketchfab.com/3d-models/honda-civic-type-r-fl5-2f54931a83744e048cacc3886d6cf5da" target="_blank" rel="noopener">"Honda Civic Type R (FL5)" by Mona x Supercars (@Car2022)</a>, CC Attribution. Parts data researched Aug 2026.';
  root.appendChild(credits);

  // Color starts open so the first thing a visitor sees is interactive.
  refs.sections.get('Color')?.sec.classList.add('open');

  function setSelected(map, prefix, activeKey) {
    for (const [key, node] of map) {
      if (key.startsWith(prefix)) node.classList.toggle('selected', key === activeKey);
    }
  }

  // Collapsed headers advertise the current pick.
  function setCurrentLabels(build) {
    const cur = (title, text) => {
      const s = refs.sections.get(title);
      if (s) s.current.textContent = text;
    };
    cur('Color', build.paint ? build.paint.item.name : '');
    cur('Suspension', build.suspension
      ? `${build.suspension.brand} ${build.suspension.product}` : 'Stock');
    cur('Wheels', build.wheels
      ? `${build.wheels.brand} ${build.wheels.model}` : 'Stock');
    cur('Exhaust', build.exhaust
      ? `${build.exhaust.brand} ${build.exhaust.product}` : 'Stock');
  }

  // Re-render selection highlights + build sheet from the build state.
  function setBuild(build) {
    setCurrentLabels(build);
    const paintKey = build.paint
      ? `${build.paint.type}:${build.paint.item.name}`
      : null;
    setSelected(refs.swatches, 'factory:', paintKey);
    setSelected(refs.swatches, 'wrap:', paintKey);
    setSelected(refs.rows, 'susp:', build.suspension ? `susp:${build.suspension.brand} ${build.suspension.product}` : 'susp:stock');
    setSelected(refs.rows, 'wheel:', build.wheels ? `wheel:${build.wheels.brand} ${build.wheels.model}` : 'wheel:stock');
    setSelected(refs.rows, 'exh:', build.exhaust ? `exh:${build.exhaust.brand} ${build.exhaust.product}` : 'exh:stock');

    const items = buildItems(build);
    refs.buildSheet.innerHTML = '';
    for (const it of items) {
      const row = el('div', 'sheet-row');
      const name = el('span', 'sheet-name', it.name);
      if (it.installed) name.appendChild(el('span', 'installed-badge', 'installed'));
      row.appendChild(name);
      const right = el('span', 'sheet-right');
      right.appendChild(el('span', 'sheet-price', it.price == null ? '' : formatUSD(it.price)));
      if (it.url) {
        const a = el('a', 'sheet-link', 'buy');
        a.href = it.url;
        a.target = '_blank';
        a.rel = 'noopener';
        right.appendChild(a);
      }
      row.appendChild(right);
      refs.buildSheet.appendChild(row);
    }
    const total = items.reduce((sum, it) => sum + (it.price || 0), 0);
    refs.total.textContent = `Total (approx): ${formatUSD(total)}`;
  }

  return { setBuild };
}

// Flatten the build state into sheet line items. Baseline mods are already
// on the car, so they list at $0.
export function buildItems(build) {
  const items = [
    { name: 'PRL High Volume Intake', price: 0, installed: true },
    { name: 'Wheel spacers', price: 0, installed: true },
  ];
  if (build.paint?.type === 'wrap') {
    const w = build.paint.item;
    items.push({ name: `Wrap: ${w.name} (${w.line})`, price: wrapCostEstimate(w.finish) });
  }
  if (build.suspension) {
    items.push({
      name: `${build.suspension.brand} ${build.suspension.product}`,
      price: priceMidpoint(build.suspension.price),
      url: build.suspension.url,
    });
  }
  if (build.wheels) {
    items.push({
      name: `${build.wheels.brand} ${build.wheels.model} (${build.wheels.size})`,
      price: priceMidpoint(build.wheels.price_set),
      url: build.wheels.url,
    });
  }
  if (build.exhaust) {
    items.push({
      name: `${build.exhaust.brand} ${build.exhaust.product}`,
      price: priceMidpoint(build.exhaust.price),
      url: build.exhaust.url,
    });
  }
  return items;
}
