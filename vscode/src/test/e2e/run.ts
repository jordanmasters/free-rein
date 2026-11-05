// Runs the extension inside a real editor on a fresh scratch copy of a harness, and reports.
// npm run e2e   (FREE_REIN_EDITOR=<VS Code or Cursor binary> to use an installed editor)
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { execFileSync, spawn } from "child_process";
import { runTests, downloadAndUnzipVSCode } from "@vscode/test-electron";

async function main() {
  const ext = path.resolve(__dirname, "..", "..", "..");
  // the solo sample: Blocking hooks starts at level 1, so its template has a level to raise
  execFileSync(process.execPath, [path.join(ext, "scripts", "scratch.mjs"), path.join(ext, "..", "samples", "solo")], { stdio: "inherit" });
  const scratch = "/tmp/free-rein-scratch/solo";
  const exe = process.env.FREE_REIN_EDITOR;
  delete process.env.ELECTRON_RUN_AS_NODE;   // set when this runs from inside VS Code; the editor would start as plain Node
  // each run in a fresh profile; settings: the editor's settings.json for it
  const inEditor = async (suite: string, withTrust: boolean, settings: object = {}) => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "free-rein-e2e-"));
    fs.mkdirSync(path.join(profile, "User"));
    fs.writeFileSync(path.join(profile, "User", "settings.json"), JSON.stringify(settings));
    const tests = path.resolve(__dirname, suite);
    try {
      if (!withTrust) await runTests({
        ...(exe ? { vscodeExecutablePath: exe } : {}),
        extensionDevelopmentPath: ext,
        extensionTestsPath: tests,
        launchArgs: [scratch, "--disable-extensions", `--user-data-dir=${profile}`],
      });
      // runTests always turns workspace trust off, so with trust on the editor is started here, with its other flags
      else await new Promise<void>(async (ok, fail) => {
        const args = [scratch, "--no-sandbox", "--disable-gpu-sandbox", "--disable-updates", "--skip-welcome", "--skip-release-notes",
          "--no-cached-data", "--disable-extensions", `--user-data-dir=${profile}`, `--extensionTestsPath=${tests}`, `--extensionDevelopmentPath=${ext}`];
        spawn(exe ?? await downloadAndUnzipVSCode(), args, { stdio: "inherit" })
          .on("error", fail).on("exit", code => code === 0 ? ok() : fail(new Error(`${suite} failed (exit ${code})`)));
      });
    } finally { fs.rmSync(profile, { recursive: true, force: true }); }
  };
  await inEditor("suite", false);
  // workspace trust on, and no prompt: a folder never trusted opens in Restricted Mode
  await inEditor("restricted", true, { "security.workspace.trust.startupPrompt": "never", "security.workspace.trust.untrustedFiles": "open" });
}
main().catch(e => { console.error("e2e failed:", e); process.exit(1); });
