// Lets `node --test` load the project's TypeScript helpers directly (no new dependencies):
//  - "@/lib/x"          -> <project>/lib/x.ts
//  - "./x" / "../lib/x" -> the .ts file when no extension is given
import { register } from "node:module";
register("./ts-hooks.mjs", import.meta.url);
