import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function tryTs(base) {
  for (const candidate of [base, `${base}.ts`, path.join(base, "index.ts")]) {
    if (path.extname(candidate) === ".ts" && existsSync(candidate)) return pathToFileURL(candidate).href;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  // Tests never touch a real database: swap the Supabase client for an in-memory double.
  if (specifier === "@/lib/supabase-admin") {
    return { url: pathToFileURL(path.join(root, "tests/stubs/supabase-admin.mjs")).href, shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    const hit = tryTs(path.join(root, specifier.slice(2)));
    if (hit) return { url: hit, shortCircuit: true };
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL && !path.extname(specifier)) {
    const hit = tryTs(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
    if (hit) return { url: hit, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
