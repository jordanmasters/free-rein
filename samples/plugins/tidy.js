// A made-up framework's Free Rein plugin, for Free Rein's tests: "Tidy" keeps rituals (rituals/*.md), its own hooks
// (tidy/hooks/*.sh), a config (.claude/tidy.json) that names a notes folder, and a review gate on that folder.
// It shows how a plugin plugs into every point Free Rein offers.
const fs = require("fs");
const path = require("path");
const has = p => { try { fs.statSync(p); return true; } catch { return false; } };
const cfg = root => { try { return JSON.parse(fs.readFileSync(path.join(root, ".claude", "tidy.json"), "utf8")); } catch { return {}; } };

module.exports = {
  id: "tidy",
  name: "Tidy",
  colour: "#7FB3D5",
  icon: "Sparkles",
  detect: root => has(path.join(root, ".claude", "tidy.json")),
  ownRepo: root => has(path.join(root, "TIDY_REPO")),

  afterSkills(ctx) {
    const py = ctx.kit.py, dir = py.join(ctx.root, "rituals");
    if (!py.isdir(dir)) return;
    for (const f of py.sorted(py.listdir(dir))) if (f.endsWith(".md")) {
      const p = py.join(dir, f), text = ctx.read(p);
      ctx.g.node("contract", f.slice(0, -3), { weight: ctx.kit.lineCount(text), summary: ctx.kit.firstParagraph(text), provenance: { path: p } });
    }
  },
  skillEdges(ctx, src, body) {
    for (const m of ctx.kit.re("rituals/([\\w-]+)\\.md").finditer(body)) ctx.g.edge("reads", src, `contract:${m.group(1)}`);
  },
  ownHooks(ctx) {
    const py = ctx.kit.py, dir = py.join(ctx.root, "tidy", "hooks");
    if (py.isdir(dir)) for (const f of py.sorted(py.listdir(dir))) ctx.hookNode(py.join(dir, f), f.replace(/\.sh$/, ""));
  },
  ownHookFor(ctx, command) {
    const m = ctx.kit.re("tidy/hooks/([\\w-]+\\.sh)").search(command);
    return m && ctx.g.nodes.has(`executor:tidy/hooks/${m.group(1)}`) ? `executor:tidy/hooks/${m.group(1)}` : null;
  },
  afterSignals(ctx) {
    const p = ctx.kit.py.join(ctx.root, ".claude", "tidy.json");
    ctx.g.node("config", "tidy.json", { provenance: { path: p } });
  },
  contexts(ctx) {
    for (const n of ctx.g.nodes.values()) n.contexts = n.type === "contract" ? ["base", "tidy"] : ["base"];
  },
  vaults: root => cfg(root).notes ? [[cfg(root).notes, "configured in .claude/tidy.json"]] : [],

  lint(g, root, kit) {
    const read = new Set(g.edges.filter(e => e.type === "reads").map(e => e.target));
    const words = { title: "A ritual nothing uses", what: "Tidy has a ritual no skill reads.", why: "It never runs.", fix: "Point a skill at it, or remove it." };
    return [...g.nodes.values()].filter(n => n.type === "contract" && !read.has(n.id)).map(n => kit.finding("tidy-unread-ritual", "warning", n.id, `${n.id} isn't read by any skill`, words));
  },
  situations: root => cfg(root).notes ? [{ stakes: "knowledge", tool: "Edit", target: `${cfg(root).notes}/log.md`, what: "Write Tidy's log" }] : [],
  gates(root, target) {
    const notes = cfg(root).notes;
    return notes && target.startsWith(notes + "/") ? [{ label: `Tidy asks before ${notes}/`, path: path.join(root, ".claude", "tidy.json"), lines: [1] }] : [];
  },

  package: {
    name: "Tidy",
    about: "Rituals, a notes folder and a review gate on it.",
    parts: ["rituals", "a notes folder", "a review gate"],
    install: "Run tidy-init in the repo",
    runs_on: ["claude"],
    locate: () => path.join(__dirname, "tidy-repo"),
    installed: root => has(path.join(root, ".claude", "tidy.json")),
    installInto(dst) {
      fs.mkdirSync(path.join(dst, ".claude"), { recursive: true });
      if (!has(path.join(dst, ".claude", "tidy.json"))) fs.writeFileSync(path.join(dst, ".claude", "tidy.json"), JSON.stringify({ notes: "notes" }, null, 2) + "\n");
      fs.mkdirSync(path.join(dst, "notes"), { recursive: true });
      if (!has(path.join(dst, "notes", "README.md"))) fs.writeFileSync(path.join(dst, "notes", "README.md"), "# Notes\n\nTidy keeps these.\n");
      fs.mkdirSync(path.join(dst, "rituals"), { recursive: true });
      if (!has(path.join(dst, "rituals", "standup.md"))) fs.writeFileSync(path.join(dst, "rituals", "standup.md"), "# Standup\n\nWhat was done, what's next.\n");
      fs.mkdirSync(path.join(dst, ".claude", "skills", "tidy-daily"), { recursive: true });
      if (!has(path.join(dst, ".claude", "skills", "tidy-daily", "SKILL.md")))
        fs.writeFileSync(path.join(dst, ".claude", "skills", "tidy-daily", "SKILL.md"), "---\nname: tidy-daily\ndescription: Use when the day starts, to run Tidy's standup.\n---\n1. Follow rituals/standup.md.\n");
    },
  },
};
