// The webview page: the board's markup, styles and script, with a strict CSP.
import * as fs from "fs";
import * as path from "path";
import { randomBytes } from "crypto";

export interface PageUris {
  css: string;
  lucide: string;
  board: string;
  cspSource: string;
}

export function page(mediaDir: string, uris: PageUris, data: unknown, prefs: unknown = {}, compact = false): string {
  const nonce = randomBytes(16).toString("base64");
  const body = fs.readFileSync(path.join(mediaDir, "board.html"), "utf8");
  // JSON inside a <script>: keep "</script>" and line separators from closing or breaking it
  const json = JSON.stringify(data).replace(/</g, "\\u003c").split(String.fromCharCode(0x2028)).join("\\u2028").split(String.fromCharCode(0x2029)).join("\\u2029");
  const csp = [
    "default-src 'none'",
    `img-src ${uris.cspSource} data:`,
    `style-src ${uris.cspSource} 'unsafe-inline'`,
    `font-src ${uris.cspSource}`,   // Geist, bundled (media/fonts): no network
    `script-src 'nonce-${nonce}'`,
  ].join("; ");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${uris.css}">
<style>[hidden]{display:none!important}</style>
<title>Free Rein</title></head>
<body>
${body}
<script nonce="${nonce}">window.FREE_REIN_DATA=${json};window.FREE_REIN_PREFS=${JSON.stringify(prefs).replace(/</g, "\\u003c")};window.FREE_REIN_COMPACT=${compact};</script>
<script nonce="${nonce}" src="${uris.lucide}"></script>
<script nonce="${nonce}" src="${uris.board}"></script>
</body></html>`;
}
