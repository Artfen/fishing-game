// Which boat she is, and what sort of boat she is (G8, boats of her own). Each of your boats has an
// id of her own. Your first boat of a kind has her kind for her id ('rib'); another of the same
// kind has her kind and a number ('rib~2'). So an id always says what sort of boat she is, and
// every save from before G8 keeps its ids as they were.

// Her kind, from her id ('rib~2' → 'rib'; 'rib' → 'rib').
export const kindOf = (id) => (typeof id === 'string' ? id.replace(/~\d+$/, '') : id);
// The nth of a kind's id (the first: the kind itself).
export const idFor = (kind, n = 1) => (n > 1 ? `${kind}~${n}` : kind);
// Which of a kind she is (1 for the first).
export const nthOf = (id) => {
  const m = typeof id === 'string' && /~(\d+)$/.exec(id);
  return m ? Number(m[1]) : 1;
};
// A boat's id as a save may hold it: a kind's letters, and perhaps a second to ninth of it.
export const ID_RE = /^[a-z]{2,12}(?:~[2-9])?$/;
// An id, of one of these kinds (if given).
export const isBoatId = (s, kinds = null) => typeof s === 'string' && ID_RE.test(s) && (!kinds || kinds.includes(kindOf(s)));
