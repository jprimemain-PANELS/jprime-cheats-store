import { normalizeCategory } from "@/lib/categories";
import { NextResponse } from "next/server";
import { tdb } from "@/lib/tenant-db";
import { currentTenant, OWNER_TENANT_ID } from "@/lib/tenant";
import { allProducts } from "@/lib/products";
import type { Product, PriceTier } from "@/lib/products";
import { deliveryModeForTier, summarizeFulfillment } from "@/lib/delivery";
import { jprimeLiveSources } from "@/lib/api-system";

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

      // Safe, public delivery flag only. The supplier, seller product ids and variant ids
      // are read here to decide it and are NEVER copied into the response.
      const tier: PriceTier = {
        duration,
        priceINR,
        deliveryMode: deliveryModeForTier(p ?? {}, d.fulfillmentType),
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

  const category: Product["category"] = normalizeCategory(d.category) ?? "mobile";

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

  // Product-level summary derived from the durations (kept for older code). The storefront
  // decides stock handling per duration using tier.deliveryMode.
  product.fulfillmentType = summarizeFulfillment(
    prices.map((t) => t.deliveryMode ?? "LOCAL")
  );

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
function legacyFallbackProducts(): Product[] {
  return allProducts.map((p) => {
    const safe: Product = {
      id: p.id,
      name: p.name,
      category: p.category,
      prices: p.prices.map((t) => {
        const tier: PriceTier = {
          duration: t.duration,
          priceINR: t.priceINR,
          deliveryMode: deliveryModeForTier(
            { seller1Pid: p.sellerPid, sellerDuration: t.sellerDuration, seller2VariantId: t.seller2VariantId },
            p.fulfillmentType
          ),
        };
        if (t.resellerPrice) tier.resellerPrice = t.resellerPrice;
        return tier;
      }),
      updateChannel: p.updateChannel,
      features: [...p.features],
      status: p.status,
    };
    safe.fulfillmentType = summarizeFulfillment(safe.prices.map((t) => t.deliveryMode ?? "LOCAL"));
    if (p.videoUrl) safe.videoUrl = p.videoUrl;
    return safe;
  });
}

export async function GET() {
  const tenant = await currentTenant();
  if (!tenant) {
    return NextResponse.json({ products: [], source: "none" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  // The built-in product list is the owner store's legacy catalog; other stores start empty.
  const isOwner = tenant.id === OWNER_TENANT_ID;
  const fallbackProducts = () => (isOwner ? legacyFallbackProducts() : []);

  try {
    const { data, error } =
      await tdb(tenant.id)
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

    let rows = (data || []) as any[];
    if (!isOwner) {
      // Owner deleted a product (or its delivery)? The co-admin's copy stops selling: hide it, history stays.
      const live = await jprimeLiveSources();
      rows = rows.flatMap((row: any) => {
        const prices: any[] = Array.isArray(row?.data?.prices) ? row.data.prices : [];
        const isJ = (t: any) => String(t?.supplier ?? "").toUpperCase() === "JPRIME";
        if (!prices.some(isJ)) return [row];
        const kept = prices.filter((t) => !isJ(t) || live.has(`${String(t.jprimeProductId ?? "")}|${String(t.jprimeDuration ?? "").trim()}`));
        return kept.length ? [{ ...row, data: { ...row.data, prices: kept } }] : [];
      });
    }
    const products = rows
      .map((row: any) =>
        toPublicProduct(row)
      )
      .filter(
        (p: Product | null): p is Product =>
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