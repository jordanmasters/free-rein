// The agent review: the brief names sensitive files without reading them; a review's findings are kept only when
// every quote is really in the file it cites, and never when one quotes a sensitive file.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { reviewBrief, readReview, sensitiveFiles } from "../../src/report/review";
import { board } from "../../src/report/board";

const repo = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "free-rein-review-"));
  fs.writeFileSync(path.join(d, "CLAUDE.md"), "# Rules\n\n- Never ship straight to the trunk.\n- Keep commits small.\n");
  fs.mkdirSync(path.join(d, ".claude", "skills", "tidy"), { recursive: true });
  fs.writeFileSync(path.join(d, ".claude", "skills", "tidy", "SKILL.md"), "---\nname: tidy\n---\nPush to main when the notes are tidy.\n");
  fs.writeFileSync(path.join(d, ".env"), "TOKEN=do-not-read\n");
  fs.writeFileSync(path.join(d, ".env.example"), "TOKEN=\n");
  return d;
};

test("sensitive files are named, never read; an example file isn't one", () => {
  const d = repo();
  assert.deepEqual(sensitiveFiles(d), [{ file: ".env", tracked: false }]);
  const b = reviewBrief(d, { name: "x", slots: [{ types: [{ id: "proj-instructions", inst: [{ path: path.join(d, "CLAUDE.md") }] }] }] });
  assert.match(b, /Never read these files[\s\S]*`\.env` \(not tracked by git\)/);
  assert.match(b, /- `CLAUDE\.md`/, "the files to read");
  assert.ok(!b.includes("do-not-read"), "the secret's content is never in the brief");
});

test("a review keeps findings whose quotes check out, and drops the rest", () => {
  const d = repo();
  fs.mkdirSync(path.join(d, ".free-rein"));
  fs.writeFileSync(path.join(d, ".free-rein", "review.json"), JSON.stringify({ version: 1, at: new Date(Date.now() + 5000).toISOString(), agent: "Claude Code", model: "test", findings: [
    { kind: "paraphrased-rule", title: "Trunk means main", detail: "A push rule in other words.", severity: "high", file: "CLAUDE.md", line: 4, quote: "Never ship straight to the trunk." },
    { kind: "contradiction", title: "Skill pushes to main", detail: "", severity: "medium", file: "CLAUDE.md", line: 3, quote: "Never ship straight to the trunk.",
      also: [{ file: ".claude/skills/tidy/SKILL.md", line: 4, quote: "Push to main when the notes are tidy." }] },
    { kind: "other", title: "Made up", detail: "", file: "CLAUDE.md", line: 2, quote: "This sentence is not in the file at all." },
    { kind: "other", title: "Leaks", detail: "", file: ".env", line: 1, quote: "TOKEN=do-not-read" },
  ] }));
  const r = readReview(d)!;
  assert.deepEqual(r.findings.map(f => [f.title, f.found_line]), [["Trunk means main", 3], ["Skill pushes to main", 3]], "the cited line corrected to where the quote is");
  assert.deepEqual(r.findings[1].also.map(a => a.line), [4]);
  assert.deepEqual(r.dropped.map(x => x.reason), ["a quote isn't in the file it cites", "it quotes a sensitive file"]);
  assert.deepEqual(r.changed_since, []);
  assert.equal(readReview(fs.mkdtempSync(path.join(os.tmpdir(), "free-rein-none-"))), null, "no review, nothing");
});

test("the sentences Free Rein can't place go in the brief by id; your agent's kinds come back only when their quotes check out", () => {
  const d = repo();
  fs.writeFileSync(path.join(d, "CLAUDE.md"), "# Rules\n\nNo unsolicited emojis.\nConcise answers please.\n");
  const b = board(d);
  const brief = reviewBrief(d, b);
  const unplaced = b.words.files.flatMap((f: any) => f.sentences.filter((s: any) => s.kind === "residual"));
  assert.ok(unplaced.length >= 1);
  assert.ok(unplaced.every((s: any) => brief.includes(s.id)), "each by its id");
  const id = unplaced.find((s: any) => /emojis/.test(s.text)).id;
  fs.mkdirSync(path.join(d, ".free-rein"), { recursive: true });
  fs.writeFileSync(path.join(d, ".free-rein", "review.json"), JSON.stringify({ version: 1, findings: [], sentences: [
    { id, kind: "rule", strength: "must-not", quote: "No unsolicited emojis." },
    { id, kind: "rule", strength: "must", quote: "a quote that isn't there at all" },
    { id: "CLAUDE.md:99:abcdef12", kind: "fact", quote: "No unsolicited emojis." },
  ] }));
  assert.deepEqual(readReview(d)!.sentences.map(s => [s.kind, s.strength]), [["rule", "must-not"]], "a quote not in the file, or at another line, is dropped");
  // its time is when the file was written, whatever the agent says (a model doesn't know the time)
  const rj = path.join(d, ".free-rein", "review.json"); fs.writeFileSync(rj, JSON.stringify({ ...JSON.parse(fs.readFileSync(rj, "utf8")), at: "2020-01-01T12:00:00Z" }));
  assert.equal(readReview(d)!.at, fs.statSync(rj).mtime.toISOString());
  const w = board(d).words, s = w.files.flatMap((f: any) => f.sentences).find((x: any) => x.id === id);
  assert.deepEqual(s.agent, { kind: "rule", strength: "must-not" });
  assert.equal(s.kind, "residual", "the patterns' kind stays; your agent's is beside it");
  assert.equal(w.totals.agent_found_rules, 1);
  assert.equal(board(d).said.summary.rules, b.said.summary.rules, "it never counts toward the rules Free Rein measures");
});
