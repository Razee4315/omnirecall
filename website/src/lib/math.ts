export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v)
