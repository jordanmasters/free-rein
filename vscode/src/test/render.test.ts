// The board renders: the page the extension builds, loaded in a browser-like DOM (jsdom), for the samples and an
// empty folder, full and compact. Fails if any script throws while the board loads, or its main parts stay empty.
// Run: npm test (from vscode/)
import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { pathToFileURL } from "url";
import { readHarness } from "../read";
import { page } from "../page";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JSDOM, VirtualConsole } = require("jsdom");

const repo = path.resolve(__dirname, "..", "..", "..");
const media = path.resolve(__dirname, "..", "..", "media");
const made: string[] = [];
process.on("exit", () => { for (const d of made) try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* left for the system */ } });
const mkTemp = (prefix: string) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); made.push(d); return d; };
process.env.HOME = mkTemp("free-rein-home-");

const url = (f: string) => pathToFileURL(path.join(media, f)).href;
const uris = { css: url("board.css"), lucide: url("lucide.min.js"), board: url("board.js"), cspSource: "file:" };

// load the page and wait for its scripts; collect every error a script throws or the page reports
function render(data: unknown, compact: boolean, flags: Record<string, boolean> = {}, prefs: Record<string, unknown> = {}): Promise<{ errors: string[]; doc: any; close: () => void }> {
  const errors: string[] = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e: Error) => errors.push(e.stack || e.message));
  const dom = new JSDOM(page(media, uris, data, prefs, compact), {
    url: url("board.html"), runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w: any) {
      // what jsdom doesn't have and the board touches: no layout here, so these do nothing
      w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
      // features behind a flag (Loops and Flows), on for the render that tests them
      w.FREE_REIN_FLAGS = flags;
      w.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      w.addEventListener("error", (e: any) => errors.push(e.error?.stack || e.message));
    },
  });
  return new Promise(resolve => dom.window.addEventListener("load", () =>
    setTimeout(() => resolve({ errors, doc: dom.window.document, close: () => dom.window.close() }), 300)));
}

async function main() {
  const roots: [string, string][] = [["kitchen", path.join(repo, "samples", "kitchen")], ["solo", path.join(repo, "samples", "solo")],
    ["empty folder", mkTemp("free-rein-empty-")]];
  for (const [name, root] of roots) {
    const data = await readHarness(root, repo);
    for (const compact of [false, true]) {
      // the full kitchen board tests Loops and Flows, behind their flag; the others show what everyone sees
      const flagged = name === "kitchen" && !compact;
      const { errors, doc, close } = await render(data, compact, flagged ? { loops: true } : {}, flagged ? { agentReview: true } : {});
      if (!flagged && !compact) assert.deepEqual([...doc.querySelectorAll("#v44head [data-bview] .nm")].map((b: any) => b.textContent), ["Harness", "Free rein"], `${name}: Loops and Flows are behind a flag`);
      const filled = (id: string) => (doc.getElementById(id)?.innerHTML ?? "").length;
      const how = `${name}, ${compact ? "compact" : "full"}`;
      assert.deepStrictEqual(errors, [], `${how}: no script errors`);
      for (const id of ["v44head", "v44inv"]) assert.ok(filled(id) > 200, `${how}: #${id} is drawn`);
      console.log(`ok  the board renders: ${how}`);
      // out of your reach is said in the pane only: no tile carries a "can't edit" mark
      assert.strictEqual(doc.querySelectorAll("#v44inv .ne32").length, 0, `${how}: no can't-edit mark on a tile`);
      // each tile's step bar has one bar per real step of its ladder: Skills 3, Rewind 2, Subagents 1
      if (name === "kitchen" && !compact) {
        const bars = (id: string) => doc.querySelectorAll(`#v44inv [data-t="${id}"] .lv44.ld i`).length;
        assert.deepStrictEqual([bars("skills"), bars("rewind"), bars("subagents")], [3, 2, 1], "step bars follow each ladder");
        // Show on tiles: off by default; the next-step chip appears when switched on, and goes when switched off
        const w = doc.defaultView, nx = () => doc.querySelectorAll("#v44inv .nx56").length;
        assert.strictEqual(nx(), 0, "no next-step chips by default");
        // the board's own tools are in one More menu: View is a part of it
        doc.querySelector("#v44head [data-more]").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        doc.querySelector('#v44head [data-moresub="view"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        const box = doc.querySelector('[data-tl="next"]');
        box.checked = true; box.dispatchEvent(new w.Event("change", { bubbles: true }));
        assert.ok(nx() > 0, "next-step chips when switched on");
        const off = doc.querySelector('[data-tl="next"]');
        off.checked = false; off.dispatchEvent(new w.Event("change", { bubbles: true }));
        assert.strictEqual(nx(), 0, "and gone when switched off");
        console.log("ok  tiles: step bars follow each piece's ladder; Show on tiles switches the next-step chip");
        // the View menu holds the sections toggle too; the legend opens on the Layers tab, standing alone (no trail)
        assert.ok(doc.querySelector("[data-vsolo]"), "View has Sections around the core");
        doc.querySelector('[data-list="layers"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        doc.querySelector("#v44head [data-more]").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        doc.querySelector('[data-topic="legend"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        assert.match(doc.getElementById("v44drawer").textContent, /How to read a tile/, "the legend opens on the Layers tab");
        assert.strictEqual(doc.querySelectorAll("#v44drawer .nv52").length, 0, "the legend has no trail");
        doc.querySelector("[data-closetopic]")?.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        // outside the board there's no View menu
        // no left rail: Settings from the gear, Drafts beside it, each with a way back; the views in the top bar, no Live tag
        assert.strictEqual(doc.querySelectorAll("#v44rail button").length, 0, "no left rail");
        assert.strictEqual(doc.querySelectorAll("#v44head [data-bview]").length, 4, "the four views, in the top bar");
        assert.deepEqual([...doc.querySelectorAll("#v44head [data-bview] .nm")].map((b: any) => b.textContent), ["Harness", "Loops", "Flows", "Free rein"], "with the flag on, all four");
        assert.match(doc.querySelector('#v44head [data-bview="has"] .sc83').textContent, /^\d+\/62$/, "Harness shows pieces in place");
        assert.match(doc.querySelector('#v44head [data-bview="free"] .sc83').textContent, /^\d+%$/, "Free rein shows its share");
        assert.ok(!/\bLive\b/.test(doc.getElementById("v44head").textContent), "live says nothing");
        // the top bar: the context button, the views, the bell and More; the side panel's switch is on the divider
        assert.ok(doc.querySelector("#v44rz [data-toginsp]") && !doc.querySelector("#v44head [data-toginsp]"), "the side panel opens and closes from the divider");
        assert.strictEqual(doc.querySelectorAll("#v44head .tb59 > *").length <= 7, true, "a short top bar");
        doc.querySelector("#v44head [data-more]").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        doc.querySelector('#v44head [data-view="settings"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        assert.ok(doc.querySelector("#v44view .bk70"), "Settings has Back to the board");
        doc.querySelector("#v44head [data-more]").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        doc.querySelector('#v44head [data-view="drafts"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        doc.querySelector("#v44head [data-more]").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        assert.strictEqual(doc.querySelectorAll('#v44head [data-moresub="view"]').length, 0, "no View menu in Drafts");
        assert.match(doc.getElementById("v44view").textContent, /Applied/, "Drafts holds what was applied");
        doc.querySelector('#v44view [data-view="board"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        assert.strictEqual(doc.getElementById("v44view").hidden, true, "back on the board");
        console.log("ok  View menu: one place for how the board looks; the legend opens on any tab; none outside the board");
        // Moves: the side panel opens on one list of what to do; tick two and fix them in one draft
        const click = (el: any) => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        assert.deepEqual([...doc.querySelectorAll("#v44drawer [data-list] .nm")].map((x: any) => x.textContent), ["Pieces", "Layers", "Situations"], "three tabs; moves are a notification");
        click(doc.querySelector('#v44head [data-moves]'));
        assert.ok(doc.querySelectorAll("#v44drawer .mc73").length >= 2, "the bell opens the moves in the side panel");
        const ticks = doc.querySelectorAll("#v44drawer [data-mpick]") as any;
        for (const t of [ticks[0], ticks[1]]) { t.checked = true; t.dispatchEvent(new w.Event("change", { bubbles: true })); }
        assert.match(doc.querySelector("#v44drawer .ft73").textContent, /2 picked/, "two picked, one draft to make");
        click(doc.querySelector("#v44drawer [data-movesclose]"));
        console.log("ok  Moves: a bell with a count; the list in the side panel; pick a few to fix in one draft");
        // Loops: a library, shelf by scope; a loop opens in the side panel with its parts; back to Harness
        click(doc.querySelector('[data-bview="checks"]'));
        assert.strictEqual(doc.querySelectorAll("#v44bview .sh73").length, 4, "four shelves: each action, each step, each route, over time");
        assert.ok(doc.querySelectorAll("#v44bview .lc73:not(.tpl)").length >= 4, "the loops it has: the agent loop, the done check, the approval…");
        assert.ok(doc.querySelector("#v44bview .lc73 .wh72.bl"), "each drawn with who judges; a blocking judge has a solid ring");
        assert.ok(doc.querySelector("#v44drawer .mv73p"), "with nothing picked, the side panel shows this view's moves, even with Layers the open tab");
        click(doc.querySelector('#v44bview [data-inst^="done:"]'));
        assert.match(doc.querySelector("#v44drawer .pn73").textContent, /Trigger[\s\S]*Judge[\s\S]*Feed back/, "a loop opens in the side panel: its parts");
        click(doc.querySelector('[data-bview="has"]'));
        assert.strictEqual(doc.getElementById("v44bview").hidden, true, "back to Harness");
        console.log("ok  Loops: a library by scope, each loop with who judges; one opens in the side panel");
        // Free rein: the fourth view. How much it does on its own, the written rules, and each kind of action beside its words
        click(doc.querySelector('[data-bview="free"]'));
        const fv = doc.getElementById("v44bview").textContent;
        assert.match(fv, /Free rein[\s\S]*Your agent has free rein on \d+%[\s\S]*Exposed[\s\S]*Written rules enforced[\s\S]*Your words, beside what happens[\s\S]*Rules that don't hold[\s\S]*All written rules/, "one sentence, the figure, the tiles, then each kind of action and the written rules");
        assert.ok(doc.querySelectorAll("#v44bview .kc90").length >= 4, "a card per kind of action");
        assert.match(doc.querySelector('#v44bview .kc90[data-stake="outward"]').textContent, /agree[\s\S]*never[\s\S]*refused/, "kitchen: it says never push, and pushing is refused");
        assert.match(doc.querySelector("#v44bview .hero97").textContent, /Your agent has free rein on \d+% of what it tries[\s\S]*Everyday work[\s\S]*High-stakes work/, "a headline, then split by what's at stake");
        assert.ok(doc.querySelector('#v44bview .lc97[data-fout="o:refused:high"]'), "an outcome opens those actions, for that kind of work");
        assert.ok(doc.querySelectorAll("#v44bview .wf97 i[data-sitopen]").length >= 10, "one square per action, each opening it");
        click(doc.querySelector('[data-bview="has"]'));
        console.log("ok  Free rein: how much it does on its own; written rules, measured and enforced; by kind of action");
        // Something wrong? a symptom switches to its view and outlines the pieces that answer it
        const sym = () => { click(doc.querySelector("#v44head [data-more]")); click(doc.querySelector('#v44head [data-moresub="sym"]')); };
        sym();
        doc.querySelector('[data-sym="forgets"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        assert.ok(doc.querySelectorAll("#v44inv .sym70").length >= 3, "the pieces that answer it, outlined");
        sym();
        doc.querySelector('[data-sym="wrong-stop"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        assert.ok(!doc.getElementById("v44bview").hidden && doc.querySelector("#v44bview .sb71"), "a loop symptom opens Loops");
        doc.querySelector('#v44bview [data-symclear]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        doc.querySelector('[data-bview="has"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        console.log("ok  Something wrong?: a symptom opens its view and outlines its pieces");
        // Flows: one map; kitchen's route, its done check; a stop opens in the side panel
        click(doc.querySelector('[data-bview="flows"]'));
        assert.ok(doc.querySelectorAll("#v44bview .st73").length >= 2, "a main route, drawn as stops on a line");
        assert.match(doc.querySelector("#v44bview .sk72").textContent, /done\.sh/, "the done check every task passes");
        assert.ok(doc.querySelector("#v44bview .bd73"), "the steps on no route, in a band");
        click(doc.querySelector('#v44bview .st73[data-flowstep]'));
        assert.match(doc.querySelector("#v44drawer .pn73").textContent, /Leads here[\s\S]*Offers next/, "a stop opens in the side panel");
        assert.ok(doc.querySelector('#v44bview .st73 circle[r="13"]'), "and the map rings the stop picked");
        click(doc.querySelector('[data-bview="has"]'));
        console.log("ok  Flows: one map of routes, the done check, a stop in the side panel");
      }
      // a tile and its pane count the same thing: the pane's "What you have" matches the tile's ×N
      if (name === "kitchen" && !compact) {
        const w = doc.defaultView, tileEl = doc.querySelector('#v44inv [data-t="skills"]');
        const onTile = Number((tileEl.querySelector(".n").textContent || "").replace("×", ""));
        tileEl.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        const badge = doc.querySelector('details[data-fold="have"] summary .b');
        assert.ok(badge, "the pane has What you have, with a count");
        assert.strictEqual(Number(badge.textContent), onTile, "the pane counts what the tile counts");
        // the levels: the next one first, all of them one click away; what it says: a meter, then the full table
        assert.ok(doc.querySelector("#v44drawer .tn79, #v44drawer .ok55") || !doc.querySelector('#v44drawer details[data-fold="tiers"]'), "the next level first");
        const all = doc.querySelector("#v44drawer [data-rulesall]");
        if (all) {
          all.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
          assert.ok(doc.querySelectorAll("#v44view .rt79 tbody tr").length > 0, "every rule, in a table in the main area");
          doc.querySelector('#v44view [data-view="board"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
          assert.strictEqual(doc.getElementById("v44view").hidden, true, "and back to the board");
        }
        doc.querySelector("[data-close]")?.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
      }
      // Map to an editor: the count of what its window edits, and the circle limited to those pieces and back
      if (name === "kitchen" && !compact) {
        const w = doc.defaultView, click = (sel: string) => doc.querySelector(sel).dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        const shown = () => new Set([...doc.querySelectorAll("#v44inv [data-t]")].map((x: any) => x.dataset.t)).size;
        // the context button: the folder, and under it the program, the model and a count of layers; it opens the switches
        const ctx = () => doc.querySelector("#v44head [data-ctx]");
        assert.match(ctx().textContent, /kitchen\s*Claude Code · .+ · 3 layers/, "the folder, its program, model and layers");
        click("#v44head [data-ctx]");
        assert.deepEqual([...doc.querySelectorAll("#v44head .cx86 [data-hly]")].map((x: any) => x.dataset.hly), ["builtin", "project", "local"], "the layers, each with its switch");
        assert.ok(doc.querySelector("#v44head .cx86 [data-rtpick]") && doc.querySelector('#v44head .cx86 [data-modelpick="main"]'), "the program and the model, as pickers");
        click('#v44head .cx86 [data-yours]');
        assert.match(doc.querySelector("#v44head [data-diffopen]").textContent, /Draft\s*1/, "a layer switched off: one Draft chip, counting it");
        click("#v44head [data-diffopen]");
        assert.match(doc.querySelector("#v44head .dp67").textContent, /Look only[\s\S]*Without your own files/, "the chip lists it as look only");
        assert.strictEqual(doc.querySelectorAll("#v44drawer .dl62").length, 0, "the Layers tab doesn't repeat it");
        click('#v44head .dp67 [data-backreal]');
        assert.strictEqual(doc.querySelector("#v44head [data-diffopen]"), null, "back to live: no chip");
        assert.strictEqual(doc.querySelectorAll("#v44drawer [data-mapto]").length, 0, "no Map to row in the side panel");
        // the layers: the levels Claude Code reads kitchen at, its built-ins included; the bar and the tab count the same
        click("#v44head [data-ctx]");
        click('#v44head .cx86 [data-seg="layers"]');
        const lv = [...doc.querySelectorAll("#v44drawer [data-hly]")].map((x: any) => x.dataset.hly);
        assert.deepEqual(lv, ["builtin", "project", "local"], "from the base up: Claude Code, this repo shared, this repo just you (the tests' home folder is empty)");
        assert.match(ctx().textContent, new RegExp(`${lv.length} layers`), "the bar counts every layer");
        assert.deepEqual([...doc.querySelectorAll("#v44drawer [data-hly] .tg75")].map((x: any) => x.textContent), ["built in", "shared", "just you"], "each layer tagged by who gets it");
        assert.deepEqual([...doc.querySelectorAll('#v44drawer [data-hly="project"] .bn, #v44drawer [data-hly="local"] .bn')].map((x: any) => x.childNodes[0].textContent.trim()), ["This repo", "This repo"], "named by where it applies");
        assert.match(doc.querySelector('#v44drawer [data-hly="project"] .pc75').textContent, /^\d+ pieces?$/, "a plain count of pieces, no bar");
        click('#v44drawer [data-hly="project"]');
        assert.match(doc.querySelector("#v44drawer .ly75.on").textContent, /Sets the mode it starts in \(Plan\)/, "an open layer says what it sets");
        assert.ok(!/committed to git: everyone who clones it[\s\S]*committed to git/.test(doc.querySelector("#v44drawer .ly75.on").textContent), "opened, it doesn't repeat what the row says");
        assert.match(doc.querySelector("#v44drawer .ly75.on .fb80").textContent, /What its files give/, "opened: each piece with the files that give it");
        assert.ok(doc.querySelector('#v44drawer [data-hly="builtin"] [data-modelpick="main"]'), "the runtime's row: the model can be switched, in a draft");
        assert.ok(doc.querySelectorAll("#v44drawer .ly75.on [data-pcopen]").length > 0, "a layer opens to its pieces, like a section");
        click('#v44drawer [data-fold80="ly:how"]');
        assert.match(doc.getElementById("v44drawer").textContent, /How layers work[\s\S]*Settings[\s\S]*Instructions/, "how layers work, folded");
        assert.match(doc.getElementById("v44drawer").textContent, /Not used here: Your organization \(everyone\), All repos \(just you\)[\s\S]*The session \(/, "the layers not used, and the session, inside How layers work");
        // a segment opens the Layers tab at its row: every mode Claude Code shows
        if (!doc.querySelector('#v44drawer [data-fold80="ly:builtin"][aria-expanded="true"]')) click('#v44drawer [data-fold80="ly:builtin"]');
        assert.ok(doc.querySelector('#v44drawer [data-fold80="ly:builtin"][aria-expanded="true"]'), "the built-in layer opens, where the runtime is chosen");
        assert.ok(doc.querySelector('#v44drawer .bi75 #ras60') || doc.querySelector("#v44drawer .bi75 b"), "the built-in layer's name is the runtime picker");
        // the mode is a picker beside the runtime and the model, with every mode Claude Code offers
        const modeSel = () => doc.querySelector('#v44drawer [data-modesel=""]');
        assert.deepEqual([...modeSel().options].map((o: any) => o.textContent.replace(/ \((its own|default)\)$/, "")),
          ["Manual", "Edit automatically", "Auto", "Bypass permissions", "Plan", "Don't ask"], "every Claude Code mode, in the picker");
        // picking another mode is a what-if
        const modeRow = () => modeSel().selectedOptions[0].textContent.replace(/ \((its own|default)\)$/, "");
        const pick = (id: string) => { const sel = modeSel(); sel.value = id; sel.dispatchEvent(new w.Event("change", { bubbles: true })); };
        assert.equal(modeRow(), "Plan", "it starts in Plan");
        pick("default");
        assert.equal(modeRow(), "Manual", "a what-if mode");
        pick("plan");
        assert.equal(modeRow(), "Plan", "back to its own");
        // where you use it is behind a flag for now: no row for it, and the circle shows every piece
        assert.strictEqual(doc.querySelector('#v44drawer [data-fold80="ly:where"]'), null, "Where you use it is off for now");
        assert.match(doc.getElementById("v44drawer").textContent, /To see what a teammate gets, switch off both "just you" layers/, "how to see what a teammate gets");
        // how Free Rein knows: every check from the More menu, the words a rule matched marked; a piece says how it's counted
        click("#v44head [data-more]"); click("#v44head .mr86 [data-checks]");
        assert.match(doc.getElementById("v44drawer").textContent, /How Free Rein checks[\s\S]*No AI model[\s\S]*Rules in your instructions[\s\S]*Risky actions it plays out/, "every check, the diagnoses' first");
        click('#v44drawer [data-fold80="ck:prose:push"]');
        assert.deepEqual([...doc.querySelectorAll("#v44drawer .f80.on mark.mw86")].map((m: any) => m.textContent), ["Never", "push"], "the words that made it a rule, marked");
        click('#v44drawer [data-closetopic]');
        // Scans: both kinds named (the rules scan, no AI; the agent review, only started by you), from the More menu
        click("#v44head [data-more]"); click("#v44head .mr86 [data-scans]");
        assert.match(doc.getElementById("v44drawer").textContent, /Scans[\s\S]*Rules scan[\s\S]*no AI[\s\S]*Agent review[\s\S]*started by you/, "the two kinds of scan, by name");
        // a scan as it runs: a pill under the top bar with the current step, and the steps on the Scans page
        const msg = (data: any) => w.dispatchEvent(new w.MessageEvent("message", { data }));
        msg({ type: "reading", why: "A file changed", changed: ["CLAUDE.md"], at: Date.now() });
        msg({ type: "scanstep", id: "files", label: "Finding the files Claude Code reads, and reading them", detail: "86 parts found", at: Date.now() });
        msg({ type: "scanstep", id: "prose", label: "Reading your instructions, sentence by sentence", at: Date.now() });
        assert.match(doc.getElementById("v44scan").textContent, /Scanning your files[\s\S]*2 of 8[\s\S]*A file changed[\s\S]*Reading your instructions/, "a notification: what it's doing now, how far along, and why it started");
        assert.deepEqual([...doc.querySelectorAll("#v44drawer .sl87.live .ss87 li")].map((li: any) => li.className), ["ok", "cur"], "the Scans page: each step, the current one turning");
        msg({ type: "cancelled" });
        assert.match(doc.getElementById("v44scan").textContent, /Scan cancelled[\s\S]*still shows the last scan/, "cancelled: the board keeps the last scan");
        click('#v44drawer [data-closetopic]');
        assert.deepStrictEqual(errors, [], "Map to: no script errors");
        console.log("ok  the context button: the folder, program, model and layers, with their switches; one Draft chip; the mode in the Layers tab; modes in the agent's words, what-ifs in gold; Where you use it behind a flag");
        // Fix in one draft, last (it leaves the board waiting for the editor): two moves ask for one draft
        const cl = (el: any) => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        cl(doc.querySelector('[data-bview="has"]'));
        cl(doc.querySelector('#v44head [data-moves]'));
        const tk = doc.querySelectorAll("#v44drawer [data-mpick]") as any;
        for (const t of [tk[0], tk[1]]) if (!t.checked) { t.checked = true; t.dispatchEvent(new w.Event("change", { bubbles: true })); }
        cl(doc.querySelector("#v44drawer [data-fixmoves]"));
        assert.match(doc.getElementById("v44head").textContent, /Measuring 2 moves in one draft/, "one draft for both moves");
        console.log("ok  Fix in one draft: two moves, one measured draft");
      }
      close();
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
