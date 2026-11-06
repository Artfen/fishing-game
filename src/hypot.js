// Math.hypot of two, three and four numbers, worked out step by step the way the browser's own
// does it (each scaled by the largest, the squares summed with Kahan's compensation, the root
// scaled back), so they give the very same answers, but as plain arithmetic the engine can
// inline, without the garbage each call to the built-in one leaves behind. For the hot paths
// only (the hulls' physics, the land's shape): they're called many thousands of times a frame.

export function hypot2(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  let max = 0;
  if (a > max) max = a;
  if (b > max) max = b;
  if (max === Infinity) return Infinity;
  if (a !== a || b !== b) return NaN;
  if (max === 0) return 0;
  // (The first square goes into the sum exactly, with nothing to compensate.)
  let n = a / max;
  const s0 = n * n;
  n = b / max;
  return Math.sqrt(s0 + n * n) * max;
}

export function hypot3(a, b, c) {
  a = Math.abs(a); b = Math.abs(b); c = Math.abs(c);
  let max = 0;
  if (a > max) max = a;
  if (b > max) max = b;
  if (c > max) max = c;
  if (max === Infinity) return Infinity;
  if (a !== a || b !== b || c !== c) return NaN;
  if (max === 0) return 0;
  let n = a / max, sum = n * n, s, p;
  n = b / max; s = n * n; p = sum + s;
  const comp = (p - sum) - s;
  sum = p;
  n = c / max; s = n * n - comp;
  return Math.sqrt(sum + s) * max;
}

export function hypot4(a, b, c, d) {
  a = Math.abs(a); b = Math.abs(b); c = Math.abs(c); d = Math.abs(d);
  let max = 0;
  if (a > max) max = a;
  if (b > max) max = b;
  if (c > max) max = c;
  if (d > max) max = d;
  if (max === Infinity) return Infinity;
  if (a !== a || b !== b || c !== c || d !== d) return NaN;
  if (max === 0) return 0;
  let n = a / max, sum = n * n, comp = 0, s, p;
  n = b / max; s = n * n; p = sum + s; comp = (p - sum) - s; sum = p;
  n = c / max; s = n * n - comp; p = sum + s; comp = (p - sum) - s; sum = p;
  n = d / max; s = n * n - comp;
  return Math.sqrt(sum + s) * max;
}
