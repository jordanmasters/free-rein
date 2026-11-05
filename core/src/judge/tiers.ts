// Tiers: Empty, Equipped, Tuned, Enforced, Proven, per piece; each tier's criteria held by every instance of
// yours. First written in Python (retired 2026-10-11).
import { withoutSamples } from "../read/samples";
import { re, M, S, readText, loads, join, dirname, basename, isabs, isfile, isdir, normpath, relpath, abspath, expanduser, listdir, walk, glob,
  getmtime, sorted, unique, splitWs, slice, count, get, iter, items as pyItems, isDict, isStr, or, truthy } from "../py";
import { harness as statementsOf } from "../read/statements";
import { historyDir } from "../read/home";

export const TIER_NAMES = ["Empty", "Equipped", "Tuned", "Enforced", "Proven"];
const MEMORY_DOC = "https://code.claude.com/docs/en/memory";

function _read(p: string): string { try { return readText(p, "ignore", 2_000_000); } catch { return ""; } }
const recent = (d: string | null) => d ? sorted(glob(join(d, "*.jsonl")), f => getmtime(f), true).slice(0, 40) : [];
const pystr = (x: any): string => x === true ? "True" : x === false ? "False" : x === null || x === undefined ? "None" : String(x);

/** How often each skill ran here: Skill tool calls and slash commands you typed. */
export function skillRuns(root: string, historyFor?: string | null): Map<string, number> {
  const runs = new Map<string, number>();
  const add = (k: string) => runs.set(k, (runs.get(k) ?? 0) + 1);
  for (const f of recent(historyDir(historyFor || root))) {
    const t = _read(f);
    (re('"name":"Skill","input":\\{"skill":"([^"]+)"').findall(t) as string[]).forEach(add);
    (re("<command-name>/([a-z][\\w:-]+)</command-name>").findall(t) as string[]).forEach(add);
  }
  return runs;
}

function imports(path: string, root: string, depth = 0, seen = new Set<string>()): string[] {
  const broken: string[] = [];
  for (const m of re("^@([^\\s]+)", M).finditer(_read(path))) {
    const ref = expanduser(m.group(1)!);
    const p = isabs(ref) ? ref : normpath(join(dirname(path), ref));
    if (!isfile(p)) broken.push(m.group(1)!);
    else if (!seen.has(p) && depth < 4) { seen.add(p); broken.push(...imports(p, root, depth + 1, seen)); }
  }
  return broken;
}

function result(tiers: any[], checks: any[]) {
  let reached = 0, nxt: any = null;
  const n = Math.min(tiers.length, checks.length);
  for (let i = 0; i < n; i++) {
    const t = tiers[i], c = checks[i];
    if (c.ok) reached = i + 1;
    else { nxt = { tier: i + 1, name: t.name, progress: c.progress ?? null, missing: (c.missing ?? []).slice(0, 20), why: c.why ?? "" }; break; }
  }
  return { tiers: tiers.slice(0, n).map((t, i) => ({ ...t, ...checks[i] })), reached, of: tiers.length, name: reached ? TIER_NAMES[reached] : "Empty", next: nxt };
}

function skills(item: any, ctx: any) {
  const prof = or(item.profile ?? null, {});
  const its: any[] = or(prof.items ?? null, []);
  const n = its.length + (ctx.home_skills ?? []).length;
  const tunedBad = its.filter(i => i.issues.length), enforcedBad = its.filter(i => i.gaps.length);
  const runs: Map<string, number> = ctx.skill_runs;
  const unproven = its.filter(i => !runs.get(i.name) && !("tested" in i.has));
  return [
    { ok: n > 0, progress: [n, 1], why: !n ? "no skill of yours" : "" },
    { ok: its.length > 0 && !tunedBad.length, progress: [its.length - tunedBad.length, its.length],
      ...(!its.length ? { why: "your only skills come from a package, so there's nothing of your own to tune" } : {}),
      missing: tunedBad.map(i => ({ name: i.name, why: i.issues[0] })) },
    { ok: its.length > 0 && !enforcedBad.length, progress: [its.length - enforcedBad.length, its.length],
      missing: enforcedBad.map(i => ({ name: i.name, why: "needs " + i.gaps.join(", ") + (i.writes_around && i.writes_around.length ? ` (it writes ${i.writes_around.slice(0, 2).join(", ")} around its approval step)` : "") })) },
    { ok: its.length > 0 && !unproven.length, progress: [its.length - unproven.length, its.length],
      missing: unproven.map(i => ({ name: i.name, why: "never ran in your recent sessions, and no eval names it" })) },
  ];
}

function projInstructions(item: any, ctx: any) {
  const root = ctx.root;
  const f = ["CLAUDE.md", "AGENTS.md", join(".claude", "CLAUDE.md")].find(x => isfile(join(root, x)));
  if (!f) return [{ ok: false, why: "no CLAUDE.md at the root" }, { ok: false }, { ok: false }];
  const p = join(root, f);
  const lines = count(_read(p), "\n"), broken = imports(p, root);
  const tunedWhy = [...(lines >= 200 ? [`${lines} lines: the docs say to aim under 200`] : []), ...broken.map(b => `@${b} doesn't exist`)];
  const rel = relpath(p, root);
  const backs = ctx.backing.filter((b: any) => b.source.file === rel);
  const measured = backs.filter((b: any) => b.backed !== null), bad = measured.filter((b: any) => b.backed !== true);
  return [
    { ok: true, progress: [1, 1] },
    { ok: !tunedWhy.length, missing: tunedWhy.map(w => ({ name: rel, why: w })), source: MEMORY_DOC },
    { ok: !bad.length, progress: [measured.length - bad.length, measured.length], missing: bad.map((b: any) => ({ name: slice(b.text, 0, 90), why: b.why, line: b.source.line })),
      unmeasured: backs.filter((b: any) => b.backed === null).length,
      ...(!measured.length ? { note: "It has no rules about actions for anything to back, so there's nothing to enforce yet" } : {}) },
  ];
}

function permissions(item: any, ctx: any) {
  const rules: [string, string][] = ctx.rules;
  const broad = rules.filter(([k, r]) => k === "allow" && (["Bash", "Edit", "Write", "Read", "WebFetch"].includes(r) || r.endsWith("(*)") || r === "Edit(**)" || r === "Write(**)")).map(([, r]) => r);
  const sits: any[] = ctx.situations;
  const hi = sits.filter(s => s.stakes !== "everyday"), exposed = hi.filter(s => s.verdict === "exposed");
  const used = sits.filter(s => s.count && (s.by || []).some((b: any) => b.piece === "permissions"));
  return [
    { ok: rules.length > 0, progress: [rules.length, 1] },
    { ok: rules.length > 0 && !broad.length, missing: broad.map(r => ({ name: r, why: "allows a whole tool" })) },
    { ok: rules.length > 0 && !exposed.length, progress: [hi.length - exposed.length, hi.length], missing: exposed.map(s => ({ name: s.what, why: "nothing stops it" })) },
    { ok: used.length > 0, progress: [used.length, Math.max(1, used.length)], missing: used.length ? [] : [{ name: "your rules", why: "no real action in your recent sessions was decided by them yet" }] },
  ];
}

function settingsOf(root: string): [string, string, any][] {
  return ([["user", expanduser("~/.claude/settings.json")], ["project", join(root, ".claude", "settings.json")], ["local", join(root, ".claude", "settings.local.json")]] as [string, string][])
    .map(([scope, p]) => { let st: any; try { st = loads(_read(p) || "{}"); } catch { st = {}; } return [scope, p, isDict(st) ? st : {}] as [string, string, any]; });
}

function hooksOf(root: string): any[] {
  const out: any[] = [];
  for (const [scope, , st] of settingsOf(root))
    for (const [event, entries] of pyItems(or(get(st, "hooks"), {})))
      for (const e of Array.isArray(entries) ? entries : [])
        for (const h of isDict(e) ? iter(or(get(e, "hooks"), [])) : []) {
          const cmd = pystr(get(h, "command", ""));
          const tok = splitWs(cmd.split("$CLAUDE_PROJECT_DIR").join(root).split("${CLAUDE_PROJECT_DIR}").join(root)).filter(x => re("[/.](sh|py|js|mjs|ts)$|/").search(x));
          let sp: string | null = tok.length ? expanduser(tok[tok.length - 1]) : null;
          if (sp && !isabs(sp)) sp = join(root, sp);
          out.push({ event, matcher: pystr(get(e, "matcher", "")), command: cmd, script: sp, scope });
        }
  return out;
}

const REFUSES = re("exit\\s+2\\b|sys\\.exit\\(\\s*2\\s*\\)|process\\.exit\\(\\s*2\\s*\\)|permissionDecision|\"decision\"\\s*:\\s*\"block|'decision'\\s*:\\s*'block");
const refuses = (h: any) => !!h.script && !!REFUSES.search(_read(h.script));

function contradicts(a: any[], b: any[]): [any, any, string[]][] {
  const pol = (x: any) => x.strength === "must-not" || x.strength === "should-not" ? "never" : "always";
  const acts = (x: any) => new Set(x.about.filter((a: any) => "action" in a).map((a: any) => a.action).filter((a: string) => a !== "write" && a !== "run"));
  const out: [any, any, string[]][] = [];
  for (const x of a) for (const y of b) {
    const ax = acts(x), ay = acts(y);
    const both = [...ax].filter(v => ay.has(v)) as string[];
    if (both.length && pol(x) !== pol(y)) out.push([x, y, sorted(both)]);
  }
  return out;
}

function instructions(paths: string[], ctx: any) {
  const root = ctx.root;
  const tuned: any[] = [];
  for (const p of paths) {
    const lines = count(_read(p), "\n"), broken = imports(p, root), rel = ctx.rel(p);
    if (lines >= 200) tuned.push({ name: rel, why: `${lines} lines: the docs say to aim under 200` });
    tuned.push(...broken.map(b => ({ name: rel, why: `@${b} doesn't exist` })));
  }
  const rels = new Set(paths.map(p => ctx.rel(p)));
  const mine = ctx.statements.filter((x: any) => x.kind === "rule" && rels.has(x.source.file));
  const rootr = ctx.statements.filter((x: any) => x.kind === "rule" && x.piece === "proj-instructions");
  for (const [x, y, acts] of contradicts(mine, rootr)) tuned.push({ name: x.source.file, why: `says the opposite of CLAUDE.md:${y.source.line} about ${acts.join(", ")}` });
  const backs = ctx.backing.filter((b: any) => rels.has(b.source.file));
  const measured = backs.filter((b: any) => b.backed !== null), bad = measured.filter((b: any) => b.backed !== true);
  return [
    { ok: !tuned.length, missing: tuned, source: MEMORY_DOC },
    { ok: !bad.length, progress: [measured.length - bad.length, measured.length], missing: bad.map((b: any) => ({ name: slice(b.text, 0, 90), why: b.why, line: b.source.line })),
      ...(!measured.length ? { note: "Its rules aren't about actions Free Rein measures, so there's nothing to back yet" } : {}) },
  ];
}

function personalInstructions(item: any, ctx: any) {
  const p = expanduser("~/.claude/CLAUDE.md");
  if (!isfile(p)) return [{ ok: false, why: "no ~/.claude/CLAUDE.md" }, { ok: false }, { ok: false }];
  return [{ ok: true, progress: [1, 1] }, ...instructions([p], ctx)];
}

function folderInstructions(item: any, ctx: any) {
  const root = ctx.root;
  const files: string[] = [];
  const SKIPD = ["node_modules", ".git", "dist", "build", "vendor", ".next"];
  for (const [dp, , fs] of walk(root, withoutSamples(root, d => !SKIPD.includes(d) && !(d.startsWith(".") && d !== ".claude")))) {
    const rel = relpath(dp, root);
    files.push(...fs.filter(f => (f === "CLAUDE.md" && rel !== ".") || (f.endsWith(".md") && rel.startsWith(join(".claude", "rules")))).map(f => join(dp, f)));
  }
  if (!files.length) return [{ ok: false, why: "no CLAUDE.md below the root, and no .claude/rules" }, { ok: false }, { ok: false }];
  const [t, n] = instructions(files, ctx);
  for (const f of files)
    if (f.includes("/rules/") && !re("\\A---\\s*\\n(.*?\\n)?paths:", S).search(_read(f))) {
      t.missing.push({ name: ctx.rel(f), why: "no paths: frontmatter, so it loads everywhere rather than where it applies" });
      t.ok = false;
    }
  return [{ ok: true, progress: [files.length, files.length] }, t, n];
}

function liveInjection(item: any, ctx: any) {
  const hs = ctx.hooks.filter((h: any) => ["UserPromptSubmit", "SessionStart", "PreCompact", "PostCompact"].includes(h.event));
  if (!hs.length) return [{ ok: false, why: "no hook injects context" }, { ok: false }];
  const gone = hs.filter((h: any) => h.script && !isfile(h.script));
  return [{ ok: true, progress: [hs.length, hs.length] },
    { ok: !gone.length, progress: [hs.length - gone.length, hs.length], missing: gone.map((h: any) => ({ name: slice(h.command, 0, 60), why: "its script isn't there" })) }];
}

function gitHooks(root: string): any[] {
  const out: any[] = [];
  for (const d of ["hooks/git", ".husky", ".githooks", ".git/hooks"]) {
    const base = join(root, d);
    for (const f of isdir(base) ? sorted(listdir(base)) : [])
      if (["pre-commit", "commit-msg", "pre-push"].includes(f) && re("\\bexit\\s+[1-9]|\\bset -e\\b").search(_read(join(base, f))))
        out.push({ event: "git " + f, matcher: f !== "pre-push" ? "git commit" : "git push", command: join(d, f), script: join(base, f), scope: "project" });
  }
  return out;
}

function hardGate(item: any, ctx: any) {
  const hs = [...ctx.hooks.filter((h: any) => (h.event === "PreToolUse" || h.event === "PermissionRequest") && refuses(h)), ...gitHooks(ctx.root)];
  if (!hs.length) return [{ ok: false, why: "no hook that can refuse" }, { ok: false }, { ok: false }, { ok: false }];
  const loose = hs.filter(h => (!h.matcher || h.matcher === "*") && !h.event.startsWith("git "));
  const gone = hs.filter(h => h.script && !isfile(h.script));
  const agent = hs.filter(h => !h.event.startsWith("git "));
  const covers = (tool: string) => agent.some(h => re(`(^|\\|)${tool}(\\||$)|^\\*?$`).search(h.matcher));
  const gaps = ([["file writes", "Edit"], ["file writes", "Write"], ["commands", "Bash"]] as [string, string][]).filter(([, t]) => !covers(t)).map(([n]) => n);
  const used = ctx.situations.filter((s: any) => s.count && (s.by || []).some((b: any) => b.piece === "hard-gate" && b.job === "refuses"));
  return [
    { ok: true, progress: [hs.length, hs.length] },
    { ok: !loose.length && !gone.length, missing: [...loose.map(h => ({ name: slice(h.command, 0, 60), why: "its matcher is every tool; name what it's for" })),
      ...gone.map(h => ({ name: slice(h.command, 0, 60), why: "its script isn't there" }))] },
    { ok: !gaps.length, missing: unique(gaps).map(g => ({ name: g, why: "no hook that can refuse sits in front of them" })) },
    { ok: used.length > 0, progress: [used.length, Math.max(1, used.length)], missing: used.length ? [] : [{ name: "your hooks", why: "no real action in your recent sessions was one they refuse" }] },
  ];
}

const SECRETS: [string, string][] = [[".env files", "\\.env"], ["keys", "\\.(pem|key)\\b|id_(rsa|ed25519)"], ["~/.ssh", "\\.ssh"], ["cloud credentials", "\\.aws|\\.config/gcloud|credentials"]];
function sandboxOf(root: string): any { const sb: any = {}; for (const [, , st] of settingsOf(root)) Object.assign(sb, or(get(st, "sandbox"), {})); return sb; }

function secretsOut(item: any, ctx: any) {
  const deny = ctx.rules.filter(([k]: [string]) => k === "deny").map(([, r]: [string, string]) => r);
  const sb = sandboxOf(ctx.root);
  const reads = deny.join(" ") + " " + iter(or(get(or(get(sb, "filesystem"), {}), "denyRead"), [])).join(" ");
  const have = SECRETS.filter(([, rx]) => re(rx).search(reads)).map(([n]) => n);
  if (!have.length) return [{ ok: false, why: "nothing keeps secrets out" }, { ok: false }, { ok: false }];
  const shell = !!(truthy(get(sb, "enabled")) && truthy(get(or(get(sb, "filesystem"), {}), "denyRead")))
    || ctx.hooks.some((h: any) => h.event === "PreToolUse" && re("Bash").search(h.matcher) && refuses(h) && re("\\.env|secret", { I: true }).search(_read(h.script || "")));
  return [
    { ok: true, progress: [have.length, SECRETS.length] },
    { ok: have.length === SECRETS.length, progress: [have.length, SECRETS.length], missing: SECRETS.filter(([n]) => !have.includes(n)).map(([n]) => ({ name: n, why: "not covered" })) },
    { ok: shell, missing: shell ? [] : [{ name: "commands", why: "a Read rule doesn't stop `cat .env`: the sandbox's denyRead, or a Bash hook that refuses, would" }], source: "https://code.claude.com/docs/en/sandboxing" },
  ];
}

function sandbox(item: any, ctx: any) {
  const sb = sandboxOf(ctx.root);
  if (!truthy(get(sb, "enabled"))) return [{ ok: false, why: "the sandbox isn't on" }, { ok: false }, { ok: false }];
  const ex = or(get(sb, "excludedCommands"), []);
  const loose = ex.length > 5 || get(sb, "allowUnsandboxedCommands") === true;
  return [{ ok: true },
    { ok: !loose, missing: loose ? [{ name: "exceptions", why: `${ex.length} commands run outside it` + (truthy(get(sb, "allowUnsandboxedCommands")) ? ", and unsandboxed commands are allowed" : "") }] : [] },
    { ok: truthy(get(sb, "failIfUnavailable")), missing: truthy(get(sb, "failIfUnavailable")) ? [] : [{ name: "failIfUnavailable", why: "if the sandbox can't start, commands run without it" }], source: "https://code.claude.com/docs/en/sandboxing" }];
}

function networkLimits(item: any, ctx: any) {
  const sb = sandboxOf(ctx.root);
  const net = or(get(sb, "network"), {});
  const cmds = !!(truthy(get(sb, "enabled")) && (truthy(get(net, "allowedDomains")) || truthy(get(net, "deniedDomains"))));
  const rules: [string, string][] = ctx.rules;
  const fetchAllow = rules.filter(([k, r]) => k === "allow" && r.startsWith("WebFetch(domain:"));
  const fetchGate = rules.some(([k, r]) => (k === "deny" || k === "ask") && (r === "WebFetch" || r === "WebFetch(*)"));
  const fetch = (fetchGate && fetchAllow.length > 0) || rules.some(([k, r]) => k === "deny" && r.startsWith("WebFetch(domain:"));
  if (!cmds && !fetch) return [{ ok: false, why: "nothing limits where it can reach" }, { ok: false }, { ok: false }];
  const defaultDeny = truthy(get(net, "allowedDomains")) && fetchGate;
  return [{ ok: true },
    { ok: cmds && fetch, missing: [...(cmds ? [] : [{ name: "commands", why: "the sandbox's domain list limits commands; it isn't set" }]),
      ...(fetch ? [] : [{ name: "fetching", why: "WebFetch isn't limited: the sandbox's domains don't cover it" }])], source: "https://code.claude.com/docs/en/sandboxing" },
    { ok: defaultDeny, missing: defaultDeny ? [] : [{ name: "the default", why: "anything not named should be refused: an allowedDomains list, and WebFetch asking or refused otherwise" }] }];
}

function spendLimits(item: any, ctx: any) {
  const wf = join(ctx.root, ".github", "workflows");
  const runs: [string, boolean][] = [];
  for (const f of isdir(wf) ? sorted(listdir(wf)) : []) {
    const t = _read(join(wf, f));
    if (re("anthropics/claude-code-action|\\bclaude\\s+(-p|--print)\\b").search(t)) runs.push([f, !!re("--max-turns|--max-budget-usd|max_turns").search(t)]);
  }
  if (!runs.length) return [{ ok: false, why: "nothing runs unattended here, so there's nothing to limit" }, { ok: false }];
  const lim = runs.filter(r => r[1]);
  return [{ ok: lim.length > 0, progress: [lim.length, runs.length] },
    { ok: lim.length === runs.length, progress: [lim.length, runs.length], missing: runs.filter(([, ok]) => !ok).map(([f]) => ({ name: f, why: "runs with no turn or budget limit" })) }];
}

function humanGate(item: any, ctx: any) {
  const sits = ctx.situations.filter((s: any) => ["knowledge", "safeguards", "outward", "accounts"].includes(s.stakes));
  const asked = sits.filter((s: any) => (s.by || []).some((b: any) => b.piece === "human-gate"));
  if (!asked.length && item.state !== "yes") return [{ ok: false, why: "no approval step" }, { ok: false }, { ok: false }, { ok: false }];
  const writes = sits.filter((s: any) => s.tool === "Edit");
  const open = writes.filter((s: any) => s.verdict === "exposed" || s.verdict === "classifier");
  const held = (s: any) => (s.by || []).some((b: any) => ["permissions", "hard-gate"].includes(b.piece) && ["asks", "refuses"].includes(b.job) && !b.believed);
  const soft = asked.filter((s: any) => !held(s)), used = asked.filter((s: any) => s.count);
  return [
    { ok: true, progress: [asked.length, asked.length] },
    { ok: !open.length, progress: [writes.length - open.length, writes.length], missing: open.map((s: any) => ({ name: s.what, why: "a high-stakes write nothing asks about" })) },
    { ok: asked.length > 0 && !soft.length, progress: [asked.length - soft.length, asked.length],
      missing: soft.map((s: any) => ({ name: s.what, why: "the ask is only in a skill's words; a hook or an ask rule would make it happen" })) },
    { ok: used.length > 0, progress: [used.length, Math.max(1, asked.length)], missing: used.length ? [] : [{ name: "your approvals", why: "none was asked in your recent sessions" }] },
  ];
}

function notifications(item: any, ctx: any) {
  const hs = ctx.hooks.filter((h: any) => h.event === "Notification");
  const ch = settingsOf(ctx.root).map(([, , st]) => get(st, "preferredNotifChannel")).find(x => truthy(x)) ?? null;
  if (!hs.length && !truthy(ch)) return [{ ok: false, why: "nothing tells you when it's waiting" }, { ok: false }];
  const seen = hs.length > 0 || (truthy(ch) && ch !== "terminal_bell");
  return [{ ok: true }, { ok: seen, missing: seen ? [] : [{ name: "the terminal bell", why: "only rings in the terminal; a Notification hook can reach your desktop or phone" }],
    source: "https://code.claude.com/docs/en/hooks" }];
}

function completionCheck(item: any, ctx: any) {
  const hs = ctx.hooks.filter((h: any) => h.event === "Stop" || h.event === "SubagentStop");
  if (!hs.length) return [{ ok: false, why: "nothing runs when it stops" }, { ok: false }, { ok: false }, { ok: false }];
  const cc: string[] = ctx.check_commands || [];
  const real = hs.filter((h: any) => re("\\b(npm|pnpm|yarn) (run )?(test|lint|check|typecheck)|\\bpytest\\b|\\bmake (test|check|lint)|\\bunittest\\b|\\bcargo test\\b|\\bgo test\\b").search(_read(h.script || "") + h.command));
  const refusing = hs.filter(refuses);
  const runs = ctx.stop_runs || {};
  const ran = hs.filter((h: any) => (runs[h.command] || {}).n), clean = ran.filter((h: any) => !runs[h.command].errors);
  const realRefuses = real.some((h: any) => refusing.includes(h));
  return [
    { ok: true, progress: [hs.length, hs.length] },
    { ok: real.length > 0, missing: real.length ? [] : hs.map((h: any) => ({ name: slice(h.command, 0, 60), why: "runs, but not your tests or lint" + (cc.length ? ` (${cc.join(", ")})` : "") })) },
    { ok: real.length > 0 && realRefuses, missing: realRefuses ? [] : [{ name: "sending it back", why: "it can't refuse to stop when the checks fail (exit 2)" }] },
    { ok: clean.length > 0, progress: [clean.length, hs.length], missing: clean.length ? [] : [{ name: "your Stop hooks", why: "not seen running cleanly in your recent sessions" }] },
  ];
}

function rewind(item: any, ctx: any) {
  const shipped = item.supplied === "runtime" || item.state === "yes" || item.state === "partial";
  const snap = ctx.hooks.some((h: any) => re("\\bgit (stash|commit|worktree add)\\b|snapshot").search(h.command + " " + _read(h.script || "")));
  return [{ ok: shipped, why: shipped ? "" : "nothing can take changes back" },
    { ok: snap, missing: snap ? [] : [{ name: "commands", why: "checkpoints don't track what commands change; a hook that snapshots (git stash) would" }], source: "https://code.claude.com/docs/en/checkpointing" }];
}

const CHECKS: Record<string, (item: any, ctx: any) => any[]> = { skills, "proj-instructions": projInstructions, permissions,
  "personal-instructions": personalInstructions, "folder-instructions": folderInstructions, "live-injection": liveInjection,
  "hard-gate": hardGate, "secrets-out": secretsOut, sandbox, "network-limits": networkLimits, "spend-limits": spendLimits,
  "human-gate": humanGate, notifications, "completion-check": completionCheck, rewind };

/** Each Stop hook's runs in recent sessions, and whether they errored. */
export function stopRuns(root: string, historyFor?: string | null): Record<string, { n: number; errors: number }> {
  const out: Record<string, { n: number; errors: number }> = {};
  for (const f of recent(historyDir(historyFor || root)))
    for (const m of re('"subtype":"stop_hook_summary","hookCount":\\d+,"hookInfos":\\[(.*?)\\],"hookErrors":\\[(.*?)\\]').finditer(_read(f)))
      for (const c of re('"command":"([^"]+)"').findall(m.group(1)!) as string[]) {
        const e = (out[c] ??= { n: 0, errors: 0 });
        e.n += 1;
        e.errors += m.group(2)!.trim() ? 1 : 0;
      }
  return out;
}

function context(root: string, a: any, sits: any[], backing: any[]) {
  const rules: [string, string][] = [];
  for (const p of [join(root, ".claude", "settings.json"), join(root, ".claude", "settings.local.json"), expanduser("~/.claude/settings.json")]) {
    let st: any;
    try { st = loads(_read(p) || "{}"); } catch { continue; }
    for (const k of ["allow", "ask", "deny"]) rules.push(...iter(or(get(or(get(st, "permissions"), {}), k), [])).filter(isStr).map(x => [k, x] as [string, string]));
  }
  const home = ((a.home || {}).skills || []).filter((x: any) => !x.pkg || x.pkg !== "runtime");
  const rel = (p: string) => abspath(p).startsWith(root + "/") ? relpath(p, root) : "~/" + relpath(p, expanduser("~"));
  let statements: any[] = [];
  try { statements = statementsOf(root); } catch { statements = []; }
  return { root, situations: sits, backing, rules, skill_runs: skillRuns(root), home_skills: home, hooks: hooksOf(root), rel, statements, stop_runs: stopRuns(root), check_commands: [] };
}

/** {piece id: tier result} for every piece that has tiers in pieces.json. */
export function evaluate(spec: any, a: any, root: string, sits: any[], backing: any[], historyFor?: string | null): Record<string, any> {
  const ctx: any = context(root, a, sits, backing);
  if (historyFor) { ctx.skill_runs = skillRuns(root, historyFor); ctx.stop_runs = stopRuns(root, historyFor); }
  const items: Record<string, any> = Object.fromEntries(a.slots.flatMap((s: any) => s.items).map((i: any) => [i.id, i]));
  const out: Record<string, any> = {};
  for (const s of spec.slots) for (const it of s.items) {
    if (!truthy(it.tiers) || !(it.id in CHECKS) || !(it.id in items)) continue;
    if (["no", "unchecked"].includes(items[it.id].state) && it.id !== "proj-instructions" && it.id !== "skills") {
      const m: string = it.tiers[0].means;
      out[it.id] = { tiers: [{ ...it.tiers[0], why: "you don't have it yet: " + m[0].toLowerCase() + m.slice(1) }, ...it.tiers.slice(1)],
        reached: 0, of: it.tiers.length, name: "Empty", next: { tier: 1, name: it.tiers[0].name, why: "you don't have it yet" } };
      continue;
    }
    out[it.id] = result(it.tiers, CHECKS[it.id](items[it.id], ctx));
  }
  return out;
}
export { basename, pyItems };
