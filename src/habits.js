// The hours fish keep, shared by every species definition (fish.js, atlantic.js).
export const isDay = (h) => h >= 6.2 && h < 19;
export const isEvening = (h) => h >= 18.5 || h < 5;
export const isTwilight = (h) => (h >= 5 && h < 7.5) || (h >= 17.5 && h < 20.5);
export const clamp01 = (v) => Math.max(0, Math.min(1, v));
