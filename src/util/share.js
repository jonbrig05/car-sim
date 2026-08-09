// Build state <-> URL hash, so a build is shareable as a plain link
// (the Reddit "here's my setup" mechanic). Slugs derive from display names,
// which survive DB reordering; renaming a DB entry breaks old links, so
// treat names as stable identifiers.

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const paintSlug = (item) => slug(item.name);
const suspensionSlug = (item) => slug(`${item.brand} ${item.product}`);
const wheelSlug = (item) => slug(`${item.brand} ${item.model}`);
const exhaustSlug = (item) => slug(`${item.brand} ${item.product}`);

export function encodeBuildHash(build) {
  const parts = [];
  if (build.paint) {
    parts.push(`p=${build.paint.type === 'wrap' ? 'w' : 'f'}.${paintSlug(build.paint.item)}`);
  }
  if (build.suspension) parts.push(`s=${suspensionSlug(build.suspension)}`);
  if (build.wheels) parts.push(`wh=${wheelSlug(build.wheels)}`);
  if (build.exhaust) parts.push(`e=${exhaustSlug(build.exhaust)}`);
  return parts.length ? `#${parts.join(',')}` : '';
}

// Returns a partial build with only the entries the hash resolves against
// the DB; unknown slugs are ignored so a stale link degrades gracefully.
export function decodeBuildHash(hash, db) {
  const out = {};
  if (!hash || hash.length < 2) return out;
  for (const part of hash.slice(1).split(',')) {
    const [key, value] = part.split('=');
    if (!value) continue;
    if (key === 'p') {
      const [kind, ...rest] = value.split('.');
      const wanted = rest.join('.');
      if (kind === 'f') {
        const item = db.factory_colors.find((c) => paintSlug(c) === wanted);
        if (item) out.paint = { type: 'factory', item };
      } else if (kind === 'w') {
        const item = db.wraps.find((w) => paintSlug(w) === wanted);
        if (item) out.paint = { type: 'wrap', item };
      }
    } else if (key === 's') {
      const item = db.suspension.find((i) => suspensionSlug(i) === value);
      if (item) out.suspension = item;
    } else if (key === 'wh') {
      const item = db.wheels.find((i) => wheelSlug(i) === value);
      if (item) out.wheels = item;
    } else if (key === 'e') {
      const item = db.exhausts.find((i) => exhaustSlug(i) === value);
      if (item) out.exhaust = item;
    }
  }
  return out;
}
