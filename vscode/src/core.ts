// Free Rein's reference scorer (core/src/report/score.ts), built into media/core.js by scripts/build-board.mjs: the
// extension levels with the same code as the board and the core, never a copy of the rules
export const core: {
  levelOf(xp: number, curve: number, top: number): [number, number, number | null];
  levelStart(n: number, curve: number): number;
  score(doc: unknown, rules: unknown): { xp: number; level: number; level_start: number; next_level_at: number | null };
} = require("../media/core.js");
