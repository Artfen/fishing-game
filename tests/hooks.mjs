// Module resolution for the tests (see setup.mjs).
const ROOT = new URL('../', import.meta.url).href;
const THREE = new URL('../vendor/three/three.module.min.js', import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: THREE, format: 'module', shortCircuit: true };
  const r = await next(specifier, context);
  if (r.url.startsWith(ROOT) && /\.js(\?|$)/.test(r.url)) return { ...r, format: 'module' };
  return r;
}
