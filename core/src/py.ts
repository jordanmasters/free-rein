// Python's behavior where it differs from JavaScript's, so ported code reads like the Python
// reference and gives the same answers. Covers what the Python version used:
//
// - regular expressions: Python's \w, \d, \s and \b are Unicode-aware, "." stops only at \n,
//   ^ and $ in multiline mode treat only \n as a line break, and $ also matches before a final \n
// - text: strip(), split(), splitlines() and slicing by code points, as str does
// - files: open() in text mode (universal newlines, errors="replace" or "ignore", read(n))
// - os.path and os.walk (sorted by name, so every file system gives the same order)
// - truthiness and sorting by code point
import * as fs from "fs";
import * as os from "os";

// ---- regular expressions ---------------------------------------------------------------------

const WORD = "\\p{L}\\p{N}_";
const SPACE = "\\t\\n\\x0b\\x0c\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const W = `[${WORD}]`;
const BOUND = `(?:(?<=${W})(?!${W})|(?<!${W})(?=${W}))`;
const NOT_BOUND = `(?:(?<=${W})(?=${W})|(?<!${W})(?!${W}))`;
const SYNTAX = "^$\\.*+?()[]{}|/";

export interface Flags { I?: boolean; M?: boolean; S?: boolean }

/** A Python regular expression's source, as an equivalent JavaScript one (always run with the u flag). */
export function translate(src: string, flags: Flags = {}): { source: string; flags: Flags } {
  const f = { ...flags };
  let i = 0, out = "";
  // inline flags at the start: (?i), (?s), (?m), (?is) ...
  const lead = /^\(\?([aiLmsux]+)\)/.exec(src);
  if (lead) {
    for (const c of lead[1]) { if (c === "i") f.I = true; if (c === "m") f.M = true; if (c === "s") f.S = true; }
    i = lead[0].length;
  }
  const cps = Array.from(src);
  // walk by code point from the code point index matching i
  let k = Array.from(src.slice(0, i)).length;
  const at = (n: number) => cps[n];
  while (k < cps.length) {
    const c = at(k);
    if (c === "\\") {
      const d = at(k + 1);
      k += 2;
      if (d === undefined) throw new Error("bad escape at end of pattern");
      if (d === "w") out += W;
      else if (d === "W") out += `[^${WORD}]`;
      else if (d === "d") out += "\\p{Nd}";
      else if (d === "D") out += "\\P{Nd}";
      else if (d === "s") out += `[${SPACE}]`;
      else if (d === "S") out += `[^${SPACE}]`;
      else if (d === "b") {
        // next to a plain word character in the pattern, only the other side needs checking: the same meaning, much faster
        const isWordLit = (x?: string) => !!x && /[A-Za-z0-9_]/.test(x);
        const next = at(k), after = at(k + 1), prev = at(k - 3), before = at(k - 4);
        if (isWordLit(next) && !(after && "?*{".includes(after))) out += `(?<!${W})`;
        else if (isWordLit(prev) && before !== "\\") out += `(?!${W})`;
        else out += BOUND;
      }
      else if (d === "B") out += NOT_BOUND;
      else if (d === "A") out += "^";
      else if (d === "Z") out += "$";
      else if ("ntrfv0".includes(d) || /[1-9]/.test(d)) out += "\\" + d;
      else if (d === "x" || d === "u") { const n = d === "x" ? 2 : 4; out += "\\" + d + cps.slice(k, k + n).join(""); k += n; }
      else if (SYNTAX.includes(d)) out += "\\" + d;
      else out += d;
      continue;
    }
    if (c === "[") {
      k++;
      let neg = false, items = "", extras: string[] = [];
      if (at(k) === "^") { neg = true; k++; }
      let first = true;
      while (k < cps.length && (at(k) !== "]" || first)) {
        const x = at(k);
        first = false;
        if (x === "\\") {
          const d = at(k + 1); k += 2;
          if (d === "w") items += WORD;
          else if (d === "d") items += "\\p{Nd}";
          else if (d === "s") items += SPACE;
          else if (d === "W") extras.push(`[^${WORD}]`);
          else if (d === "D") extras.push("\\P{Nd}");
          else if (d === "S") extras.push(`[^${SPACE}]`);
          else if (d === "b") items += "\\x08";
          else if ("ntrfv0".includes(d)) items += "\\" + d;
          else if (d === "x" || d === "u") { const n = d === "x" ? 2 : 4; items += "\\" + d + cps.slice(k, k + n).join(""); k += n; }
          else if (SYNTAX.includes(d) || d === "-") items += "\\" + d;
          else items += d;
          continue;
        }
        if (x === "]") items += "\\]";
        else if (x === "[" || x === "{" || x === "}" || x === "(" || x === ")" || x === "|" || x === "/") items += "\\" + x;
        else items += x;
        k++;
      }
      k++; // the closing ]
      if (!extras.length) out += `[${neg ? "^" : ""}${items}]`;
      else if (neg) throw new Error("unsupported: \\W, \\S or \\D inside a negated class");
      else out += `(?:${[...(items ? [`[${items}]`] : []), ...extras].join("|")})`;
      continue;
    }
    if (c === ".") { out += f.S ? "[\\s\\S]" : "[^\\n]"; k++; continue; }
    if (c === "^") { out += f.M ? "(?:^|(?<=\\n))" : "^"; k++; continue; }
    if (c === "$") { out += f.M ? "(?=\\n|$)" : "(?=\\n?$)"; k++; continue; }
    if (c === "{") {
      const rest = cps.slice(k).join("");
      const q = /^\{(\d*)(,?)(\d*)\}/.exec(rest);
      if (q && (q[1] || q[3])) { out += `{${q[1] || "0"}${q[2]}${q[3]}}`; k += Array.from(q[0]).length; }
      else { out += "\\{"; k++; }
      continue;
    }
    if (c === "}" || c === "]") { out += "\\" + c; k++; continue; }
    if (c === "(" && at(k + 1) === "?") {
      const rest = cps.slice(k).join("");
      if (rest.startsWith("(?P<")) { out += "(?<"; k += 4; continue; }
      const back = /^\(\?P=(\w+)\)/.exec(rest);
      if (back) { out += `\\k<${back[1]}>`; k += back[0].length; continue; }
      const comment = /^\(\?#[^)]*\)/.exec(rest);
      if (comment) { k += Array.from(comment[0]).length; continue; }
    }
    out += c;
    k++;
  }
  return { source: out, flags: f };
}

export class Match {
  constructor(private m: RegExpExecArray, private rx?: Re) {}
  get start() { return this.m.index; }
  get end() { return this.m.index + this.m[0].length; }
  /** group n, or null when it didn't take part (Python's None) */
  group(n = 0): string | null { const g = this.m[n]; return g === undefined ? null : g; }
  /** where group n starts, or -1 (matched again with group positions on: they slow every match down) */
  startOf(n: number): number {
    if (!this.rx) return -1;
    const r = new RegExp(this.rx.js.source, this.rx.js.flags + "dy");
    r.lastIndex = this.m.index;
    const ix = (r.exec(this.m.input) as any)?.indices?.[n];
    return ix ? ix[0] : -1;
  }
  get groups(): (string | null)[] { return this.m.slice(1).map(g => (g === undefined ? null : g)); }
}

const needStr = (s: unknown): string => {
  if (typeof s !== "string") throw new TypeError("expected string or bytes-like object");
  return s;
};

/** A compiled Python regular expression. */
export class Re {
  readonly js: RegExp;
  private groups?: number;
  constructor(readonly pattern: string, flags: Flags = {}) {
    const t = translate(pattern, flags);
    this.js = new RegExp(t.source, "gu" + (t.flags.I ? "i" : ""));
  }
  get groupCount(): number {
    return (this.groups ??= new RegExp(`(?:${this.js.source})|`, "u").exec("")!.length - 1);
  }
  private sticky?: RegExp;
  private run(s: string, pos: number, sticky: boolean): Match | null {
    const r = sticky ? (this.sticky ??= new RegExp(this.js.source, this.js.flags + "y")) : this.js;
    r.lastIndex = pos;
    const m = r.exec(s);
    return m ? new Match(m, this) : null;
  }
  search(s: string, pos = 0) { return this.run(needStr(s), pos, false); }
  private whole?: RegExp;
  /** re.fullmatch: the whole string */
  fullmatch(s: string): Match | null {
    needStr(s);
    const r = (this.whole ??= new RegExp(`^(?:${this.js.source})$`, this.js.flags.replace("g", "")));
    const m = r.exec(s);
    return m ? new Match(m, this) : null;
  }
  match(s: string, pos = 0) { return this.run(needStr(s), pos, true); }
  finditer(s: string): Match[] {
    needStr(s);
    const out: Match[] = [];
    const r = this.js;
    r.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = r.exec(s))) {
      out.push(new Match(m, this));
      if (m[0] === "") r.lastIndex += (s.codePointAt(r.lastIndex)! > 0xffff ? 2 : 1);
    }
    return out;
  }
  /** Python's findall: whole matches with no groups, group 1 with one, tuples ("" for a group that didn't match) with more */
  findall(s: string): any[] {
    return this.finditer(s).map(m => this.groupCount === 0 ? m.group(0) : this.groupCount === 1 ? (m.group(1) ?? "")
      : m.groups.map(g => g ?? ""));
  }
  sub(s: string, repl: string | ((m: Match) => string)): string {
    needStr(s);
    let out = "", last = 0;
    for (const m of this.finditer(s)) {
      out += s.slice(last, m.start) + (typeof repl === "string" ? repl : repl(m));
      last = m.end;
    }
    return out + s.slice(last);
  }
  split(s: string): string[] {
    needStr(s);
    const out: string[] = [];
    let last = 0;
    for (const m of this.finditer(s)) {
      if (m.end === m.start && (m.start === 0 || m.start === s.length)) continue;
      out.push(s.slice(last, m.start), ...m.groups.map(g => g as string));
      last = m.end;
    }
    out.push(s.slice(last));
    return out;
  }
}

const cache = new Map<string, Re>();
/** re.compile, cached */
export function re(pattern: string, flags: Flags = {}): Re {
  const key = pattern + "\0" + (flags.I ? "i" : "") + (flags.M ? "m" : "") + (flags.S ? "s" : "");
  let r = cache.get(key);
  if (!r) cache.set(key, (r = new Re(pattern, flags)));
  return r;
}
export const I: Flags = { I: true }, M: Flags = { M: true }, S: Flags = { S: true };
export const flags = (...fs: Flags[]): Flags => Object.assign({}, ...fs);

// ---- text --------------------------------------------------------------------------------------

const SPACES = new Set(Array.from("\t\n\x0b\x0c\r\x1c\x1d\x1e\x1f \x85\xa0            \u2028\u2029  　"));
export const isspace = (c: string) => SPACES.has(c);

function stripWith(s: string, chars: string | undefined, left: boolean, right: boolean): string {
  const set = chars === undefined ? SPACES : new Set(Array.from(chars));
  const cs = Array.from(s);
  let a = 0, b = cs.length;
  if (left) while (a < b && set.has(cs[a])) a++;
  if (right) while (b > a && set.has(cs[b - 1])) b--;
  return cs.slice(a, b).join("");
}
export const strip = (s: string, chars?: string) => stripWith(s, chars, true, true);
export const lstrip = (s: string, chars?: string) => stripWith(s, chars, true, false);
export const rstrip = (s: string, chars?: string) => stripWith(s, chars, false, true);

/** str.split() with no separator: runs of whitespace, no empty parts */
export function splitWs(s: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (const c of s) {
    if (SPACES.has(c)) { if (cur) out.push(cur); cur = ""; } else cur += c;
  }
  if (cur) out.push(cur);
  return out;
}

const LINE_BREAK = /\r\n|[\n\r\x0b\x0c\x1c\x1d\x1e\x85\u2028\u2029]/g;
/** str.splitlines() */
export function splitlines(s: string): string[] {
  if (!s) return [];
  const parts = s.split(LINE_BREAK);
  if (parts[parts.length - 1] === "") parts.pop();
  return parts;
}

/** s[a:b], counting code points as Python does */
export function slice(s: string, a: number, b?: number): string {
  const cs = Array.from(s);
  return cs.slice(a, b).join("");
}
export const len = (s: string) => Array.from(s).length;
export const count = (s: string, sub: string, start = 0, end?: number) => {
  const t = s.slice(start, end);
  if (!sub) return t.length + 1;
  let n = 0, i = 0;
  while ((i = t.indexOf(sub, i)) !== -1) { n++; i += sub.length; }
  return n;
};

/** sorted(): strings by code point (JavaScript's default sort compares UTF-16 units) */
export function cmp(a: any, b: any): number {
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) { const c = cmp(a[i], b[i]); if (c) return c; }
    return a.length - b.length;
  }
  if (typeof a === "string" && typeof b === "string") {
    const x = Array.from(a), y = Array.from(b);
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      const d = x[i].codePointAt(0)! - y[i].codePointAt(0)!;
      if (d) return d;
    }
    return x.length - y.length;
  }
  if (typeof a === "boolean" || typeof b === "boolean") return Number(a) - Number(b);
  return a < b ? -1 : a > b ? 1 : 0;
}
export const sorted = <T>(xs: Iterable<T>, key: (x: T) => any = x => x, reverse = false): T[] =>
  [...xs].map((x, i) => ({ x, k: key(x), i })).sort((a, b) => (reverse ? -1 : 1) * cmp(a.k, b.k) || a.i - b.i).map(e => e.x);

/** dict.fromkeys(xs): the distinct items, first occurrence first */
export const unique = <T>(xs: Iterable<T>): T[] => [...new Set(xs)];

// ---- values ------------------------------------------------------------------------------------

/** Python's truthiness: None, False, 0, "", [] and {} are false */
export const truthy = (x: unknown): boolean =>
  x !== null && x !== undefined && x !== false && x !== 0 && x !== "" &&
  !(Array.isArray(x) && !x.length) && !(isDict(x) && !Object.keys(x as object).length);
/** a or b */
export const or = <A, B>(a: A, b: B): A | B => (truthy(a) ? a : b);
export const isDict = (x: unknown): x is Record<string, any> => typeof x === "object" && x !== null && !Array.isArray(x);
export const isList = Array.isArray;
export const isStr = (x: unknown): x is string => typeof x === "string";

/** d.get(k, default), raising as Python does when d isn't a dict */
export function get(d: unknown, k: string, dflt: any = null): any {
  if (!isDict(d)) throw new TypeError(`'${typeName(d)}' object has no attribute 'get'`);
  return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : dflt;
}
/** for x in v: a list's items, a dict's keys, a string's characters */
export function iter(v: unknown): any[] {
  if (isList(v)) return v;
  if (isDict(v)) return Object.keys(v);
  if (isStr(v)) return Array.from(v);
  throw new TypeError(`'${typeName(v)}' object is not iterable`);
}
/** d.items(), raising when d isn't a dict */
export function items(d: unknown): [string, any][] {
  if (!isDict(d)) throw new TypeError(`'${typeName(d)}' object has no attribute 'items'`);
  return Object.entries(d);
}
/** len(v) */
export function pylen(v: unknown): number {
  if (isList(v)) return v.length;
  if (isDict(v)) return Object.keys(v).length;
  if (isStr(v)) return len(v);
  throw new TypeError(`object of type '${typeName(v)}' has no len()`);
}
const typeName = (x: unknown) => x === null || x === undefined ? "NoneType" : isList(x) ? "list" : typeof x === "string" ? "str"
  : typeof x === "number" ? (Number.isInteger(x) ? "int" : "float") : typeof x === "boolean" ? "bool" : "dict";

/** json.loads; raises (ValueError in Python) on anything JSON.parse refuses */
export const loads = (s: string): any => JSON.parse(s);

// ---- files -------------------------------------------------------------------------------------

/** UTF-8 to text as Python decodes it, with errors="replace" (one U+FFFD per bad sequence) or "ignore" */
export function decode(buf: Uint8Array, errors: "replace" | "ignore" = "replace"): string {
  try { return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buf); } catch { /* has bad bytes */ }
  let out = "", i = 0;
  const bad = () => { if (errors === "replace") out += "�"; };
  while (i < buf.length) {
    const b = buf[i];
    if (b < 0x80) { out += String.fromCharCode(b); i++; continue; }
    let need = 0, cp = 0, lo = 0x80, hi = 0xbf;
    if (b >= 0xc2 && b <= 0xdf) { need = 1; cp = b & 0x1f; }
    else if (b >= 0xe0 && b <= 0xef) { need = 2; cp = b & 0x0f; if (b === 0xe0) lo = 0xa0; if (b === 0xed) hi = 0x9f; }
    else if (b >= 0xf0 && b <= 0xf4) { need = 3; cp = b & 0x07; if (b === 0xf0) lo = 0x90; if (b === 0xf4) hi = 0x8f; }
    else { bad(); i++; continue; }
    let j = i + 1, ok = true;
    for (let n = 0; n < need; n++, j++) {
      const c = buf[j];
      if (c === undefined || c < (n === 0 ? lo : 0x80) || c > (n === 0 ? hi : 0xbf)) { ok = false; break; }
      cp = (cp << 6) | (c & 0x3f);
    }
    if (!ok) { bad(); i = j; continue; }
    out += String.fromCodePoint(cp);
    i = j;
  }
  return out;
}

/** Files read during one reading, kept so a file read again isn't decoded again (withFileCache) */
let fileCache: Map<string, string> | null = null;
/** Run fn with files cached: one reading reads the same files many times (Python does too); they don't change during it. */
export function withFileCache<T>(fn: () => T): T {
  if (fileCache) return fn();
  fileCache = new Map();
  memo = new Map();
  try { return fn(); } finally { fileCache = null; memo = null; }
}
let memo: Map<string, any> | null = null;
/** Within one reading (withFileCache), the same work done once: make(), kept under key */
export function once<T>(key: string, make: () => T): T {
  if (!memo) return make();
  if (!memo.has(key)) memo.set(key, make());
  return memo.get(key);
}

/** open(path, errors=...).read(n) in text mode: decoded, \r\n and \r read as \n, at most n characters */
export function readText(path: string, errors: "replace" | "ignore" = "replace", n = -1): string {
  let text: string;
  const key = errors + "\0" + path;
  if (fileCache && fileCache.has(key)) text = fileCache.get(key)!;
  else {
    const buf = fs.readFileSync(path);
    text = decode(buf, errors);
    if (text.includes("\r")) text = text.replace(/\r\n?/g, "\n");
    if (fileCache) fileCache.set(key, text);
  }
  if (n < 0 || text.length <= n) return text;
  let i = 0, k = 0;
  while (k < n && i < text.length) { i += text.codePointAt(i)! > 0xffff ? 2 : 1; k++; }
  return text.slice(0, i);
}

// ---- os.path (posixpath) -----------------------------------------------------------------------

export function join(a: string, ...ps: string[]): string {
  let p = a;
  for (const b of ps) {
    if (b.startsWith("/")) p = b;
    else if (!p || p.endsWith("/")) p += b;
    else p += "/" + b;
  }
  return p;
}
export function split(p: string): [string, string] {
  const i = p.lastIndexOf("/") + 1;
  let head = p.slice(0, i);
  const tail = p.slice(i);
  if (head && head !== "/".repeat(head.length)) head = head.replace(/\/+$/, "");
  return [head, tail];
}
export const basename = (p: string) => p.slice(p.lastIndexOf("/") + 1);
export const dirname = (p: string) => split(p)[0];
export const isabs = (p: string) => p.startsWith("/");
export function normpath(p: string): string {
  if (!p) return ".";
  let initial = p.startsWith("/") ? 1 : 0;
  if (initial && p.startsWith("//") && !p.startsWith("///")) initial = 2;
  const out: string[] = [];
  for (const c of p.split("/")) {
    if (!c || c === ".") continue;
    if (c !== ".." || (!initial && !out.length) || (out.length && out[out.length - 1] === "..")) out.push(c);
    else if (out.length) out.pop();
  }
  const s = "/".repeat(initial) + out.join("/");
  return s || ".";
}
export const abspath = (p: string) => normpath(isabs(p) ? p : join(process.cwd(), p));
export function relpath(p: string, start = "."): string {
  const a = abspath(start).split("/").filter(Boolean), b = abspath(p).split("/").filter(Boolean);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const rel = [...Array(a.length - i).fill(".."), ...b.slice(i)];
  return rel.length ? rel.join("/") : ".";
}
export function expanduser(p: string): string {
  if (!p.startsWith("~")) return p;
  let i = p.indexOf("/", 1);
  if (i < 0) i = p.length;
  let home: string;
  if (i === 1) home = process.env.HOME ?? os.userInfo().homedir;
  else {
    const name = p.slice(1, i);
    try { if (os.userInfo().username !== name) return p; home = os.userInfo().homedir; } catch { return p; }
  }
  home = home.replace(/\/+$/, "");
  return home + p.slice(i) || "/";
}
/** os.path.realpath: links resolved as far as the path exists */
export function realpath(p: string): string {
  const abs = abspath(p);
  try { return fs.realpathSync.native(abs); } catch { /* resolve the part that exists */ }
  const [head, tail] = split(abs);
  return head === abs ? abs : join(realpath(head), tail);
}

const stat = (p: string, follow = true) => {
  try { return (follow ? fs.statSync : fs.lstatSync)(p, { throwIfNoEntry: false }) ?? null; } catch { return null; }
};
export const exists = (p: string) => !!p && !!stat(p);
export const isdir = (p: string) => !!p && !!stat(p)?.isDirectory();
export const isfile = (p: string) => !!p && !!stat(p)?.isFile();
export const islink = (p: string) => !!p && !!stat(p, false)?.isSymbolicLink();
export const getmtime = (p: string) => { const s = fs.statSync(p); return s.mtimeMs / 1000; };

/** os.listdir, sorted by name (not the directory's own order, which differs between file systems: macOS lists
 *  names alphabetically, Linux in the order they were made), so a reading is the same on every machine; raises
 *  when it can't be read */
export function listdir(p: string): string[] {
  let d: fs.Dir;
  try { d = fs.opendirSync(p); } catch (e: any) {   // Node's opendir error names no path; Python's does
    if (e && !e.path) { e.path = p; e.message = `${e.message} '${p}'`; if (e.stack && !e.stack.includes(p)) e.stack = e.stack.replace(/^(.*?)(\n|$)/, `$1 '${p}'$2`); }
    throw e;
  }
  const out: string[] = [];
  try {
    let e: fs.Dirent | null;
    while ((e = d.readSync())) out.push(e.name);
  } finally { d.closeSync(); }
  return out.sort();
}

/** os.walk(top), top-down: prune edits the folder list in place to skip folders, as dirs[:] = ... does */
export function* walk(top: string, prune?: (dirs: string[], dp: string) => string[]): Generator<[string, string[], string[]]> {
  let names: string[];
  try { names = listdir(top); } catch { return; }
  let dirs: string[] = [];
  const files: string[] = [];
  for (const n of names) (isdir(join(top, n)) ? dirs : files).push(n);
  if (prune) dirs = prune(dirs, top);
  yield [top, dirs, files];
  for (const d of dirs) {
    const np = join(top, d);
    if (!islink(np)) yield* walk(np, prune);
  }
}

// ---- numbers -----------------------------------------------------------------------------------

/** The exact decimal digits of a double: [sign, digits, exponent] with value = digits * 10^exponent. */
function exactDecimal(x: number): [number, bigint, number] {
  const buf = new DataView(new ArrayBuffer(8));
  buf.setFloat64(0, x);
  const hi = buf.getUint32(0), lo = buf.getUint32(4);
  const sign = hi >>> 31 ? -1 : 1;
  const expBits = (hi >>> 20) & 0x7ff;
  let mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  let e2: number;
  if (expBits === 0) e2 = -1074;
  else { mant |= 1n << 52n; e2 = expBits - 1075; }
  if (e2 >= 0) return [sign, mant << BigInt(e2), 0];
  // m / 2^k = m * 5^k / 10^k
  const k = -e2;
  return [sign, mant * 5n ** BigInt(k), -k];
}

/** round(x, n): Python rounds the exact value, halves to even (round(0.125, 2) is 0.12, round(2.5) is 2) */
export function round(x: number, n = 0): number {
  if (!Number.isFinite(x)) return x;
  const [sign, digits, exp] = exactDecimal(x);
  const drop = -n - exp;                      // how many decimal digits to drop
  let q: bigint;
  if (drop <= 0) return x;                    // already exact at this precision
  const p = 10n ** BigInt(drop);
  q = digits / p;
  const r = digits % p, half = p / 2n;
  if (r > half || (r === half && p % 2n === 0n && q % 2n === 1n)) q += 1n;
  const s = (sign < 0 ? "-" : "") + q.toString() + "e" + (-n);
  const v = Number(s);
  return v === 0 ? 0 * sign : v;
}

/** repr(s) for a string */
export function repr(s: string): string {
  const q = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const c of s) {
    const cp = c.codePointAt(0)!;
    if (c === "\\") out += "\\\\";
    else if (c === q) out += "\\" + q;
    else if (c === "\n") out += "\\n";
    else if (c === "\r") out += "\\r";
    else if (c === "\t") out += "\\t";
    else if (cp < 0x20 || cp === 0x7f) out += "\\x" + cp.toString(16).padStart(2, "0");
    else out += c;
  }
  return q + out + q;
}

/** re.escape (3.7+): only the characters special in a pattern */
export const escape = (s: string) => Array.from(s).map(c => "()[]{}?*+-|^$\\.&~# \t\n\r\v\f".includes(c) ? "\\" + c : c).join("");

// ---- fnmatch and glob --------------------------------------------------------------------------

/** fnmatch.translate: a shell pattern as a JavaScript regular expression matching the whole name */
function fnTranslate(pat: string): RegExp {
  const cs = Array.from(pat);
  let i = 0, out = "";
  while (i < cs.length) {
    const c = cs[i++];
    if (c === "*") { out += "[\\s\\S]*"; while (cs[i] === "*") i++; }
    else if (c === "?") out += "[\\s\\S]";
    else if (c === "[") {
      let j = i;
      if (cs[j] === "!") j++;
      if (cs[j] === "]") j++;
      while (j < cs.length && cs[j] !== "]") j++;
      if (j >= cs.length) out += "\\[";
      else {
        let stuff = cs.slice(i, j).join("");
        i = j + 1;
        stuff = stuff.replace(/\\/g, "\\\\");
        if (stuff.startsWith("!")) stuff = "^" + stuff.slice(1);
        else if (stuff.startsWith("^")) stuff = "\\" + stuff;
        out += `[${stuff.replace(/[\[\]{}()|/]/g, m => "\\" + m)}]`;
      }
    } else out += c.replace(/[.*+?^${}()|[\]\\\/]/g, m => "\\" + m);
  }
  return new RegExp(`^(?:${out})$`, "u");
}
const fnCache = new Map<string, RegExp>();
/** fnmatch.fnmatch (posix: case matters) */
export function fnmatch(name: string, pat: string): boolean {
  let r = fnCache.get(pat);
  if (!r) fnCache.set(pat, (r = fnTranslate(pat)));
  return r.test(name);
}

const MAGIC = /[*?[]/;
const lexists = (p: string) => { try { fs.lstatSync(p); return true; } catch { return false; } };
/** os.path.lexists: there, even as a broken link */
export const lexistsOf = lexists;

/** glob.glob, not recursive: hidden names match only a pattern that starts with "." */
export function glob(pat: string, dironly = false): string[] {
  const [dir, base] = split(pat);
  if (!MAGIC.test(pat)) {
    if (base) return lexists(pat) ? [pat] : [];
    return isdir(dir) ? [pat] : [];
  }
  const inDir = (d: string): string[] => {
    if (MAGIC.test(base)) {
      let names: string[];
      try { names = listdir(d || "."); } catch { return []; }
      if (dironly) names = names.filter(n => isdir(join(d || ".", n)));
      if (!base.startsWith(".")) names = names.filter(n => !n.startsWith("."));
      return names.filter(n => fnmatch(n, base));
    }
    if (!base) return isdir(d) ? [base] : [];
    return lexists(join(d, base)) ? [base] : [];
  };
  if (!dir) return inDir("");
  const dirs = dir !== pat && MAGIC.test(dir) ? glob(dir, true) : [dir];
  const out: string[] = [];
  for (const d of dirs) for (const n of inDir(d)) out.push(join(d, n));
  return out;
}

/** json.dumps(s) for a string: non-ASCII escaped as \\uXXXX, as Python does by default */
export function dumpsStr(s: string): string {
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const c = s[i], u = s.charCodeAt(i);
    if (c === '"') out += '\\"';
    else if (c === "\\") out += "\\\\";
    else if (c === "\n") out += "\\n";
    else if (c === "\r") out += "\\r";
    else if (c === "\t") out += "\\t";
    else if (c === "\b") out += "\\b";
    else if (c === "\f") out += "\\f";
    else if (u < 0x20 || u > 0x7e) out += "\\u" + u.toString(16).padStart(4, "0");
    else out += c;
  }
  return out + '"';
}

/** x in container: a substring for a string, a key for a dict, an item for a list */
export function pyIn(x: any, c: any): boolean {
  if (isStr(c)) { if (!isStr(x)) throw new TypeError("'in <string>' requires string as left operand"); return c.includes(x); }
  if (isList(c)) return c.some(v => v === x);
  if (isDict(c)) return Object.prototype.hasOwnProperty.call(c, x);
  throw new TypeError("argument of type is not iterable");
}

/** glob.glob(pattern, recursive=True) for a pattern of the form DIR/**\/BASE with BASE a plain glob: files in DIR
 * and every folder below it (not hidden), depth first in each folder's own order, as Python's glob gives them */
export function globRecursive(dir: string, base: string): string[] {
  const dirs: string[] = [join(dir, "")];
  const rl = (d: string, prefix: string) => {
    let names: string[];
    try { names = listdir(d); } catch { return; }
    for (const n of names.filter(x => isdir(join(d, x)))) {
      if (n.startsWith(".")) continue;
      dirs.push(join(dir, prefix + n));
      rl(join(d, n), prefix + n + "/");
    }
  };
  if (isdir(dir)) rl(dir, "");
  else return [];
  const out: string[] = [];
  for (const d of dirs) {
    let names: string[];
    try { names = listdir(d); } catch { continue; }
    if (!base.startsWith(".")) names = names.filter(n => !n.startsWith("."));
    for (const n of names) if (fnmatch(n, base)) out.push(join(d, n));
  }
  return out;
}

// ---- json, as Python reads and writes it -------------------------------------------------------

/** A number JavaScript can't carry the way Python does: a float (Python writes 1.0, not 1) or a big integer */
export class PyNum {
  constructor(readonly text: string, readonly float: boolean) {}
  valueOf() { return Number(this.text); }
}

/** json.loads, keeping what a rewrite needs: floats stay floats, big integers stay exact. Raises (SyntaxError)
 * wherever Python's raises ValueError. Objects keep their keys in order, except keys that look like array
 * indexes, which JavaScript puts first (a settings file rarely has those). */
export function loadsKeep(text: string): any {
  let i = 0;
  const ws = () => { while (i < text.length && " \t\n\r".includes(text[i])) i++; };
  const fail = (): never => { throw new SyntaxError(`Expecting value: char ${i}`); };
  const str = (): string => {
    i++;
    let out = "";
    for (;;) {
      if (i >= text.length) fail();
      const c = text[i++];
      if (c === '"') return out;
      if (c === "\\") {
        const e = text[i++];
        const m: Record<string, string> = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
        if (e in m) out += m[e];
        else if (e === "u") { const h = text.slice(i, i + 4); if (!/^[0-9a-fA-F]{4}$/.test(h)) fail(); out += String.fromCharCode(parseInt(h, 16)); i += 4; }
        else fail();
      } else if (c.charCodeAt(0) < 0x20) fail();
      else out += c;
    }
  };
  const val = (): any => {
    ws();
    const c = text[i];
    if (c === "{") {
      i++; const o: any = {}; ws();
      if (text[i] === "}") { i++; return o; }
      for (;;) {
        ws(); if (text[i] !== '"') fail();
        const k = str(); ws(); if (text[i++] !== ":") fail();
        o[k] = val(); ws();
        if (text[i] === ",") { i++; continue; }
        if (text[i] === "}") { i++; return o; }
        fail();
      }
    }
    if (c === "[") {
      i++; const a: any[] = []; ws();
      if (text[i] === "]") { i++; return a; }
      for (;;) {
        a.push(val()); ws();
        if (text[i] === ",") { i++; continue; }
        if (text[i] === "]") { i++; return a; }
        fail();
      }
    }
    if (c === '"') return str();
    for (const [w, v] of [["true", true], ["false", false], ["null", null], ["NaN", NaN], ["Infinity", Infinity], ["-Infinity", -Infinity]] as [string, any][])
      if (text.startsWith(w, i)) { i += w.length; return v; }
    const m = /^-?(?:0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i));
    if (!m) fail();
    i += m![0].length;
    const isFloat = !!(m![1] || m![2]);
    if (isFloat) return new PyNum(m![0], true);
    const n = Number(m![0]);
    return Number.isSafeInteger(n) ? n : new PyNum(m![0], false);
  };
  const v = val();
  ws();
  if (i < text.length) throw new SyntaxError(`Extra data: char ${i}`);
  return v;
}

/** repr(float), as Python writes it */
export function floatRepr(x: number): string {
  if (Number.isNaN(x)) return "NaN";
  if (!Number.isFinite(x)) return x > 0 ? "Infinity" : "-Infinity";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const [mant, e] = x.toExponential().split("e");
  const exp = Number(e);
  const digits = mant.replace("-", "").replace(".", "");
  const sign = x < 0 ? "-" : "";
  if (exp < -4 || exp >= 16) {
    const m = digits.length > 1 ? digits[0] + "." + digits.slice(1) : digits;
    return `${sign}${m}e${exp < 0 ? "-" : "+"}${String(Math.abs(exp)).padStart(2, "0")}`;
  }
  if (exp < 0) return `${sign}0.${"0".repeat(-exp - 1)}${digits}`;
  const intPart = digits.slice(0, exp + 1).padEnd(exp + 1, "0"), frac = digits.slice(exp + 1);
  return `${sign}${intPart}.${frac || "0"}`;
}

/** json.dumps(v, indent=n), with Python's defaults: non-ASCII escaped, ", " and ": " separators */
export function dumps(v: any, indent: number | null = null, level = 0): string {
  const nl = indent === null ? "" : "\n" + " ".repeat(indent * (level + 1)), end = indent === null ? "" : "\n" + " ".repeat(indent * level);
  const sep = indent === null ? ", " : ",";
  if (v === null || v === undefined) return "null";
  if (v === true) return "true";
  if (v === false) return "false";
  if (v instanceof PyNum) return v.float ? floatRepr(Number(v.text)) : BigInt(v.text).toString();
  if (typeof v === "number") return Number.isInteger(v) ? (Object.is(v, -0) ? "0" : String(v)) : floatRepr(v);
  if (typeof v === "string") return dumpsStr(v);
  if (Array.isArray(v)) return v.length ? "[" + v.map(x => nl + dumps(x, indent, level + 1)).join(sep) + end + "]" : "[]";
  const ks = Object.keys(v);
  return ks.length ? "{" + ks.map(k => nl + dumpsStr(k) + ": " + dumps(v[k], indent, level + 1)).join(sep) + end + "}" : "{}";
}
