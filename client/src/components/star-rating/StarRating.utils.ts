// Clamp a number into the [0, 1] range (used to compute a single star's fill).
export const clamp = (n: number) => Math.max(0, Math.min(1, n));
