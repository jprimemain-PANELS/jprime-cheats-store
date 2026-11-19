"use client";

import type { DesignId } from "@/lib/store-designs";
import type { DesignProps } from "./shared";
import { Folio } from "./folio";
import { Neon } from "./neon";
import { Editorial } from "./editorial";
import { FloatGlass } from "./floatglass";
import { Arena } from "./arena";
import { Console } from "./console";
import { Retrowave } from "./retrowave";

const VIEWS = { folio: Folio, neon: Neon, editorial: Editorial, floatglass: FloatGlass, arena: Arena, console: Console, retrowave: Retrowave } as const;

/** Picks the owner-chosen design. The site-wide look (colours, backdrop, fonts) comes from html[data-design] (see design-css.ts); these views are only the home page layout. */
export function DesignedStore({ design, ...props }: DesignProps & { design: Exclude<DesignId, "classic"> }) {
  const View = VIEWS[design];
  if (!View) return null;
  return (
    <div className="min-h-screen">
      <View {...props} />
    </div>
  );
}
