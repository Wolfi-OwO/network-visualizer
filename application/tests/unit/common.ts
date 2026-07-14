export * from '../common.ts';
export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
