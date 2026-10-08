import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
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
          products: [],
          error: "catalog_unavailable",
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

    return NextResponse.json(
      { products },
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
        products: [],
        error: "catalog_unavailable",
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