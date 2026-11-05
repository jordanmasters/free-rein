#!/usr/bin/env node
// free-rein: Free Rein on the command line. Every command reads the harness at ROOT (default: here) and prints JSON.
//
//   free-rein read [ROOT] [--no-home] [--runtime ID] [--mode auto|manual]   the harness document (free-rein.harness/1)
//   free-rein score [DOCUMENT.json | -]                                      the reference scorer's numbers for a document
//   free-rein check [ROOT] [--format text|json|sarif] [--output FILE] [--fail-on error|warning|note|none] [--home]
//                                                                        what needs attention; exits 1 when a finding
//                                                                        is at --fail-on or worse (default: error)
//   free-rein lint [ROOT]                                                    the graph's lint findings, most serious first
//   free-rein board [ROOT] [--no-home] [--runtime ID] [--profile ID]         the board's data
//   free-rein upgrades [ROOT]                                                what can be upgraded, and how
//   free-rein plan ROOT PIECE                                                one upgrade: its edits or request, and its effect
//   free-rein extract | statements | models | discover [ROOT]                the graph, the prose, the models, nearby harnesses
//   free-rein profiles                                                       the example profiles there are
//   free-rein spec                                                           Free Rein's model (pieces, runtimes) as it reads it
import * as fs from "fs";
import { load } from "./read/spec";
import { score } from "./report/score";
import { abspath, isdir } from "./py";
import { extract } from "./read/extract";
import { harness as statements } from "./read/statements";
import { discover } from "./read/discover";
import { models } from "./read/models";
import { lint } from "./judge/lint";
import { board, profiles } from "./report/board";
import { document } from "./report/harness";
import { plan, upgrades } from "./write/changes";
import { check, fails, text, sarif, LEVELS, Level } from "./report/check";
import * as path from "path";
import * as os from "os";
import { pluginFiles, pluginErrors, plugins } from "./read/plugins";
import { SUPPORTED } from "./read/runtimes";

const argv = process.argv.slice(2);
const flag = (k: string) => argv.includes(k);
const opt = (k: string) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : undefined);
const VALUED = new Set(["--runtime", "--mode", "--profile", "--format", "--output", "--fail-on"]);
const pos = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && VALUED.has(argv[i - 1])));
const [cmd] = pos;
const root = () => {
  const r = abspath(pos[1] || ".");
  if (!isdir(r)) throw new Error(`no such folder: ${pos[1] || "."}`);
  return r;
};
const out = (v: unknown) => process.stdout.write(JSON.stringify(v, null, 1) + "\n");
const SEV: Record<string, number> = { serious: 0, warning: 1, info: 2 };

// each command's options: anything else is a mistake (a typo in CI must not pass quietly)
const HOME_OPTS = ["--no-home", "--runtime"];
const OPTIONS: Record<string, string[]> = {
  read: [...HOME_OPTS, "--mode"], score: [], check: ["--home", "--no-home", "--runtime", "--format", "--output", "--fail-on"],
  lint: HOME_OPTS, board: [...HOME_OPTS, "--profile"], upgrades: HOME_OPTS, plan: HOME_OPTS, extract: HOME_OPTS, statements: HOME_OPTS,
  models: HOME_OPTS, discover: [], profiles: [], spec: [],
};

// output piped into something that stops reading (| head) ends quietly
process.stdout.on("error", (e: any) => { if (e?.code === "EPIPE") process.exit(0); throw e; });

try {
  if (cmd && OPTIONS[cmd]) {
    const bad = argv.filter(a => a.startsWith("--") && !OPTIONS[cmd].includes(a));
    if (bad.length) throw new Error(`free-rein ${cmd} doesn't take ${bad.join(", ")}${OPTIONS[cmd].length ? ` (it takes ${OPTIONS[cmd].join(", ")})` : ""}`);
  }
  // without your home folder (--no-home; free-rein check unless --home), nothing is read from it at all: the run gets an
  // empty one. Your plugins are found first, since they live there.
  const homeOff = cmd === "check" ? !flag("--home") : flag("--no-home");
  if (homeOff && cmd && OPTIONS[cmd]?.includes("--no-home")) {
    if (process.env.FREE_REIN_PLUGINS === undefined) process.env.FREE_REIN_PLUGINS = pluginFiles().join(":");
    process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), "free-rein-no-home-"));
    process.on("exit", () => { try { fs.rmSync(process.env.HOME!, { recursive: true, force: true }); } catch { /* left for the system */ } });
  }
  // what went wrong in a plugin (loading it, or a step while reading), said once the command has run
  process.on("exit", () => { for (const e of pluginErrors()) process.stderr.write(`free-rein: plugin problem: ${e}\n`); });
  // a runtime Free Rein doesn't support is a mistake, not Claude Code
  const rt = opt("--runtime");
  if (rt !== undefined && !SUPPORTED.includes(rt)) throw new Error(`unsupported runtime: ${rt} (one of: ${SUPPORTED.join(", ")})`);
  switch (cmd) {
    case "read": {
      const r = root(), home = !flag("--no-home");
      out(document(board(r, { count_home: home, runtime: opt("--runtime") ?? "claude" }), load(), r, opt("--mode") ?? null, home));
      break;
    }
    case "score": {
      const doc = JSON.parse(fs.readFileSync(!pos[1] || pos[1] === "-" ? 0 : pos[1], "utf8"));
      if (!doc || !Array.isArray(doc.pieces)) throw new Error("that isn't a harness document (free-rein read makes one)");
      out(score(doc, load()));
      break;
    }
    case "check": {
      const format = opt("--format") ?? "text", failOn = (opt("--fail-on") ?? "error") as Level | "none";
      if (!["text", "json", "sarif"].includes(format)) throw new Error(`--format is text, json or sarif, not ${format}`);
      if (![...LEVELS, "none"].includes(failOn)) throw new Error(`--fail-on is error, warning, note or none, not ${failOn}`);
      const r = check(root(), { count_home: flag("--home"), runtime: opt("--runtime") ?? "claude" });
      const version = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8")).version;
      const body = format === "sarif" ? JSON.stringify(sarif(r, version), null, 2) + "\n"
        : format === "json" ? JSON.stringify({ ...r, root: undefined, fails: fails(r, failOn) }, null, 1) + "\n" : text(r);
      if (opt("--output")) { fs.writeFileSync(opt("--output")!, body); if (format !== "text") process.stdout.write(text(r)); }
      else process.stdout.write(body);
      process.exitCode = fails(r, failOn) ? 1 : 0;
      // plugins are code you run: say which ones did (stderr, so the output stays as asked)
      if (plugins().length) process.stderr.write(`free-rein: plugins loaded: ${plugins().map(p => p.id).join(", ")}\n`);
      break;
    }
    case "lint": out(lint(root())[1].map((f, i) => ({ f, i })).sort((a, b) => (SEV[a.f.severity] - SEV[b.f.severity]) || (a.f.class < b.f.class ? -1 : a.f.class > b.f.class ? 1 : a.i - b.i)).map(x => x.f)); break;
    case "board": out(opt("--profile") ? board(null, { profile: opt("--profile") }) : board(root(), { count_home: !flag("--no-home"), runtime: opt("--runtime") ?? "claude" })); break;
    case "upgrades": out(upgrades(root())); break;
    case "plan": if (!pos[2]) throw new Error("which piece? free-rein plan ROOT PIECE (see free-rein upgrades)"); out(plan(root(), pos[2])); break;
    case "extract": out(extract(root()).toJson()); break;
    case "statements": { const r = root(); out(statements(r, extract(r).toJson())); break; }
    case "models": out(models(root())); break;
    case "discover": out({ base: root(), harnesses: discover(root()) }); break;
    case "profiles": out(profiles()); break;
    case "spec": out(load()); break;
    default:
      process.stderr.write(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//   free-rein")).map(l => l.slice(3)).join("\n") + "\n");
      process.exit(cmd ? 2 : 0);
  }
} catch (e: any) {
  process.stderr.write(`free-rein: ${e?.message ?? e}\n`);
  process.exit(2);
}
