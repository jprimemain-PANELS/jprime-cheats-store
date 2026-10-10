import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { allProducts } from "@/lib/products";
import type { Product, PriceTier } from "@/lib/products";

export const dynamic = "force-dynamic";

function formatRupees(value: unknown): string | undefined {
  const s = String(value ?? "").trim();

  if (!s) {
    return undefined;
  }

  return s.startsWith("₹") ? s : `₹${s}`;
}

function toPublicProduct(
  row: {
    product_id: string;
    name: string;
    data: any;
  }
): Product | null {
  const d = row.data || {};

  const rawPrices: any[] = Array.isArray(d.prices)
    ? d.prices
    : [];

  const prices: PriceTier[] = rawPrices
    .map((p) => {
      const duration = String(
        p?.duration ?? ""
      ).trim();

      const priceINR = formatRupees(
        p?.priceINR
      );

      if (!duration || !priceINR) {
        return null;
      }

      const tier: PriceTier = {
        duration,
        priceINR,
      };

      const reseller = formatRupees(
        p?.resellerPrice
      );

      if (reseller) {
        tier.resellerPrice = reseller;
      }

      return tier;
    })
    .filter(
      (t): t is PriceTier =>
        t !== null
    );

  if (prices.length === 0) {
    return null;
  }

  const category: Product["category"] =
    d.category === "pc" ||
    d.category === "ios" ||
    d.category === "mobile"
      ? d.category
      : "mobile";

  const product: Product = {
    id: String(
      d.id || row.product_id
    ),

    name: String(
      d.name || row.name
    ),

    category,

    prices,

    updateChannel:
      typeof d.updateChannel === "string"
        ? d.updateChannel
        : "",

    features:
      Array.isArray(d.features)
        ? d.features.filter(
            (f: unknown) =>
              typeof f === "string" &&
              f.trim() !== ""
          )
        : [],

    status:
      String(d.status || "").toUpperCase() ===
      "MAINTENANCE"
        ? "MAINTENANCE"
        : "ONLINE",
  };

  if (
    d.fulfillmentType === "API" ||
    d.fulfillmentType === "LOCAL"
  ) {
    product.fulfillmentType =
      d.fulfillmentType;
  }

  if (
    typeof d.videoUrl === "string" &&
    d.videoUrl.trim() !== ""
  ) {
    product.videoUrl =
      d.videoUrl.trim();
  }

  return product;
}

// Server-side fallback (lib/products.ts) with every supplier field stripped,
// so supplier IDs/durations/variants never reach the browser.
function fallbackProducts(): Product[] {
  return allProducts.map((p) => {
    const safe: Product = {
      id: p.id,
      name: p.name,
      category: p.category,
      prices: p.prices.map((t) => {
        const tier: PriceTier = { duration: t.duration, priceINR: t.priceINR };
        if (t.resellerPrice) tier.resellerPrice = t.resellerPrice;
        return tier;
      }),
      updateChannel: p.updateChannel,
      features: [...p.features],
      status: p.status,
    };
    if (p.fulfillmentType) safe.fulfillmentType = p.fulfillmentType;
    if (p.videoUrl) safe.videoUrl = p.videoUrl;
    return safe;
  });
}

export async function GET() {
  try {
    const { data, error } =
      await supabaseAdmin
        .from("products_catalog")
        .select(
          "product_id, name, data"
        )
        .order("id", {
          ascending: true,
        });

    if (error) {
      console.error(
        "PUBLIC CATALOG ERROR:",
        error
      );

      return NextResponse.json(
        {
          products: fallbackProducts(),
          source: "fallback",
        },
        {
          status: 200,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    const products = (data || [])
      .map((row: any) =>
        toPublicProduct(row)
      )
      .filter(
        (p): p is Product =>
          p !== null
      );

    if (products.length === 0) {
      return NextResponse.json(
        { products: fallbackProducts(), source: "fallback" },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { products, source: "catalog" },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "PUBLIC CATALOG EXCEPTION:",
      error
    );

    return NextResponse.json(
      {
        products: fallbackProducts(),
        source: "fallback",
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
}