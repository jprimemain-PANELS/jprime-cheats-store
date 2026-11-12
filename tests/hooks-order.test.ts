import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/** Cheap guard for React's "Rendered more hooks than during the previous render": a hook call after a top-level early return. */
function walk(dir: string, out: string[] = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", "tests"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}
const root = process.cwd();

describe("React hooks order", () => {
  it("no hook is called after an early return in a component body", () => {
    const bad: string[] = [];
    for (const f of [...walk(path.join(root, "app")), ...walk(path.join(root, "components"))]) {
      const lines = fs.readFileSync(f, "utf8").split("\n");
      let early = -1;
      lines.forEach((ln, i) => {
        if (/^(export default |export )?(async )?function [A-Z]/.test(ln) || /^(export )?const [A-Z]\w* = (\(|React)/.test(ln)) early = -1;
        else if (/^  if \(.*\) return\b/.test(ln) || /^  if \(.*\) \{ return\b/.test(ln)) { if (early < 0) early = i + 1; }
        else if (early > 0 && /^  (const \[?[\w, {}:]+\]? = )?use(State|Effect|Memo|Ref|Callback|Context|Router|Brand|SearchParams)\(/.test(ln)) bad.push(`${path.relative(root, f)}:${i + 1} (early return at ${early})`);
      });
    }
    expect(bad).toEqual([]);
  });
});
