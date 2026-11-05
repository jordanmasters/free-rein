// Renders the parts catalog to markdown: catalog.json is the single source, CATALOG.md is for people browsing
// the repo. node model/parts/render.mjs writes it; with --check, says whether it's up to date (exit 1 if not).
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MARK = v => v ? "verified" : "unverified";
const byKey = (a, b) => a < b ? -1 : a > b ? 1 : 0;

export function render(cat) {
  const out = [], w = s => out.push(s);
  w("# Harness parts\n");
  w("> Generated from `catalog.json` — do not edit by hand.\n");
  w(cat.note + "\n");

  w("## Capabilities\n");
  w("What a part may declare in `requires`, and what another part must `provide`.\n");
  w("| Capability | Meaning |");
  w("|---|---|");
  for (const k of Object.keys(cat.capabilities).sort(byKey)) w(`| \`${k}\` | ${cat.capabilities[k]} |`);
  w("");

  const runtimes = [...new Set(cat.parts.flatMap(p => Object.keys(p.runtimes)))].sort(byKey);
  const byType = {};
  for (const p of cat.parts) (byType[p.node_type] ??= []).push(p);

  w("## Parts by node type\n");
  w("Parts sharing a `node_type` are candidates for substitution. Candidacy is " +
    "not sufficiency — `requires` decides whether a swap is actually valid.\n");
  for (const type of Object.keys(byType).sort(byKey)) {
    w(`### \`${type}\`\n`);
    w("| Part | Role | Requires | " + runtimes.join(" | ") + " |");
    w("|---|---|---|" + "---|".repeat(runtimes.length));
    for (const p of [...byType[type]].sort((a, b) => byKey(a.id, b.id))) {
      const req = (p.requires || []).map(r => `\`${r}\``).join(", ") || "—";
      const cells = runtimes.map(rt => { const i = p.runtimes[rt] || {}; return i.realization ? `${i.realization} (${MARK(i.verified)})` : "—"; });
      w(`| \`${p.id}\` | ${p.role} | ${req} | ` + cells.join(" | ") + " |");
    }
    w("");
  }

  const unverified = cat.parts.flatMap(p => Object.entries(p.runtimes).filter(([, i]) => i.realization && !i.verified).map(([rt]) => [p.id, rt]))
    .sort((a, b) => byKey(a[0], b[0]) || byKey(a[1], b[1]));
  w("## Coverage\n");
  w(`${cat.parts.length} parts across ${Object.keys(byType).length} node types.\n`);
  if (unverified.length) {
    w(`${unverified.length} realizations are claimed but unverified — they must ` +
      "not be relied on until checked:\n");
    for (const [id, rt] of unverified) w(`- \`${id}\` / ${rt}`);
    w("");
  }
  return out.join("\n") + "\n";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const md = render(JSON.parse(fs.readFileSync(path.join(HERE, "catalog.json"), "utf8")));
  const dest = path.join(HERE, "CATALOG.md");
  if (process.argv.includes("--check")) {
    const ok = fs.existsSync(dest) && fs.readFileSync(dest, "utf8") === md;
    console.log(ok ? "CATALOG.md is up to date" : "CATALOG.md is out of date: run node model/parts/render.mjs");
    process.exit(ok ? 0 : 1);
  }
  fs.writeFileSync(dest, md);
  console.error(`wrote ${dest}`);
}
