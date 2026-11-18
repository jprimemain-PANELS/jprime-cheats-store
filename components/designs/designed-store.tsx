"use client";

import type { DesignId } from "@/lib/store-designs";
import { designCss } from "./design-css";
import type { DesignProps } from "./shared";
import { Folio } from "./folio";
import { Neon } from "./neon";
import { Pixel95 } from "./pixel95";
import { Editorial } from "./editorial";
import { FloatGlass } from "./floatglass";

const VIEWS = { folio: Folio, neon: Neon, pixel95: Pixel95, editorial: Editorial, floatglass: FloatGlass } as const;

/** Picks the owner-chosen design. The wrapper carries data-design so the design's CSS (and colours for the product cards) apply only inside it. */
export function DesignedStore({ design, ...props }: DesignProps & { design: Exclude<DesignId, "classic"> }) {
  const View = VIEWS[design];
  if (!View) return null;
  return (
    <div data-design={design} className="min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: designCss(design) }} />
      <View {...props} />
    </div>
  );
}
