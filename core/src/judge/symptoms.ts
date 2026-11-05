// A way in from a problem: each symptom, its view, and how many of the pieces that answer it are in place.
import * as fs from "fs";
import * as path from "path";
import { modelDir } from "../read/spec";

export function symptoms(items: Record<string, any>): any[] {
  let doc: any; try { doc = JSON.parse(fs.readFileSync(path.join(modelDir(), "symptoms.json"), "utf8")); } catch { return []; }
  const on = (id: string) => !!items[id] && (items[id].state === "yes" || items[id].state === "partial");
  return (doc.symptoms || []).map((s: any) => ({ ...s, have: s.pieces.filter(on), missing: s.pieces.filter((id: string) => !on(id)) }));
}
