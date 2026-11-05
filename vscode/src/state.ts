// What Free Rein remembers: the harness you're looking at, the ones you looked at
// recently, and your trust answers for each. No VS Code here, so it tests on its own.

export interface Store {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Thenable<void> | Promise<void>;
}

export interface TrustCategory {
  id: string; name: string; question: string; evidence_score: number;
  missing: string[]; pieces: { id: string; name: string; state: string }[];
}
export interface Trust { scale: string[]; categories: TrustCategory[]; backed: number }
export type Answers = Record<string, number>

const RECENT = "freeRein.recent";
const MAX_RECENT = 8;

export function recent(store: Store): string[] {
  return store.get<string[]>(RECENT) ?? [];
}

export async function addRecent(store: Store, path: string) {
  const list = [path, ...recent(store).filter(p => p !== path)].slice(0, MAX_RECENT);
  await store.update(RECENT, list);
}

// Answers are kept per harness and not shared between them: trust is earned
// by each harness, not carried over from another.
const answersKey = (target: string) => `freeRein.trust:${target}`;
export type TrustState = { answers: Answers } | { skipped: true } | undefined;

export function trustState(store: Store, target: string): TrustState {
  return store.get<TrustState>(answersKey(target));
}
export async function saveAnswers(store: Store, target: string, answers: Answers) {
  await store.update(answersKey(target), { answers });
}
export async function skipTrust(store: Store, target: string) {
  await store.update(answersKey(target), { skipped: true });
}
export async function clearTrust(store: Store, target: string) {
  await store.update(answersKey(target), undefined);
}

// Felt trust on the same 0-100 line as the evidence, per kind of action and
// overall. The gap is how far felt trust runs past what the controls back up.
// Same rule as the web app's trust check.
export function compare(trust: Trust, answers: Answers) {
  const top = Math.max(1, trust.scale.length - 1);
  const rows = trust.categories.map(c => {
    const mine = Math.round((100 * (answers[c.id] ?? 0)) / top);
    const gap = mine - c.evidence_score;
    const verdict = gap > 25 ? "trusting well beyond the evidence"
      : gap > 0 ? "slightly ahead of the evidence"
      : gap < -25 ? "the evidence supports more trust than you give" : "matched";
    return { id: c.id, name: c.name, mine, evidence: c.evidence_score, gap, verdict,
             close: gap > 0 ? c.pieces.filter(p => p.state !== "yes").slice(0, 2) : [] };
  });
  const felt = Math.round(rows.reduce((a, r) => a + r.mine, 0) / Math.max(1, rows.length));
  return { rows, felt, gap: felt - trust.backed, ahead: rows.filter(r => r.gap > 0).length };
}
