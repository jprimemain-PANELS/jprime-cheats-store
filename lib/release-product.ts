import { tdb, OWNER_TENANT_ID } from "@/lib/tenant-db";
import {
  allProducts,
  type Product,
  type PriceTier,
} from "@/lib/products";
import {
  inferSupplier,
  normalizeStockText,
  resolveCatalogSupplier,
  type Supplier,
} from "@/lib/delivery";
import { claimLocalStockKey } from "@/lib/stock";
import { creditWallet, debitWallet, logWalletTransaction } from "@/lib/wallet";
import { jprimeAccess, jprimeSource, sellerCredsForTenant } from "@/lib/api-system";

interface ReleaseProductParams {
  tenantId: string;
  username: string;
  product_name: string;
  duration: string;
}

interface CatalogPrice {
  duration?: unknown;
  priceINR?: unknown;
  resellerPrice?: unknown;

  supplier?: unknown;

  seller1Pid?: unknown;
  seller1Duration?: unknown;

  seller2VariantId?: unknown;

  // JPRIME API stock (co-admin stores): which OWNER product + duration this tier sells
  jprimeProductId?: unknown;
  jprimeDuration?: unknown;
}

interface CatalogProduct {
  id?: unknown;
  name?: unknown;
  category?: unknown;
  fulfillmentType?: unknown;
  prices?: CatalogPrice[];
  status?: unknown;
}

const SELLER1_API_URL =
  "https://bantibhaiya.to/api/reseller_v1.php";

const SELLER2_API_URL =
  "https://whitexmodz.store/api/v1/generate_key.php";

/* =========================================================
   CATALOG
   ========================================================= */

/*
 * A catalogue lookup has THREE outcomes and they must never be confused:
 *   found      -> use the catalogue configuration
 *   not_found  -> the product genuinely is not in products_catalog (legacy fallback allowed)
 *   error      -> the database/query failed or the data is ambiguous. We do NOT know what the
 *                 product is, so the purchase is stopped. It must never be treated as
 *                 "not found" and quietly served from local stock.
 */
type CatalogLookup =
  | { status: "found"; product: CatalogProduct }
  | { status: "not_found" }
  | { status: "error"; message: string };

function toCatalogProduct(row: any): CatalogProduct {
  const catalogData =
    row?.data && typeof row.data === "object" ? row.data : {};

  return {
    ...catalogData,
    id: catalogData.id || row?.product_id,
    name: catalogData.name || row?.name,
  };
}

async function findCatalogProduct(
  tenantId: string,
  productName: string
): Promise<CatalogLookup> {
  const wanted = normalizeStockText(productName);

  // 1) Exact name (the normal case).
  const exact = await tdb(tenantId)
    .from("products_catalog")
    .select("product_id, name, data")
    .eq("name", productName)
    .limit(2);

  if (exact.error) {
    console.error("CATALOG PRODUCT LOOKUP ERROR:", exact.error.message);
    return { status: "error", message: exact.error.message };
  }

  if ((exact.data || []).length > 1) {
    console.error("CATALOG DUPLICATE PRODUCT NAME:", productName);
    return {
      status: "error",
      message: "Duplicate catalogue entries for this product name.",
    };
  }

  if ((exact.data || []).length === 1) {
    return { status: "found", product: toCatalogProduct(exact.data![0]) };
  }

  // 2) Same name with different letter case / spacing. Read-only, tolerant match.
  if (!wanted) return { status: "not_found" };

  const loose = await tdb(tenantId)
    .from("products_catalog")
    .select("product_id, name, data");

  if (loose.error) {
    console.error("CATALOG LOOSE LOOKUP ERROR:", loose.error.message);
    return { status: "error", message: loose.error.message };
  }

  const matches = (loose.data || []).filter(
    (row: any) => normalizeStockText(row?.name) === wanted
  );

  if (matches.length > 1) {
    return {
      status: "error",
      message: "Duplicate catalogue entries for this product name.",
    };
  }

  if (matches.length === 1) {
    return { status: "found", product: toCatalogProduct(matches[0]) };
  }

  return { status: "not_found" };
}

function findCatalogPrice(
  product: CatalogProduct,
  duration: string
): CatalogPrice | null {
  const prices = Array.isArray(product.prices) ? product.prices : [];
  const wanted = String(duration ?? "").trim();

  const exact = prices.find(
    (price) => String(price?.duration ?? "").trim() === wanted
  );
  if (exact) return exact;

  const loose = prices.filter(
    (price) =>
      normalizeStockText(price?.duration) === normalizeStockText(wanted)
  );

  return loose.length === 1 ? loose[0] : null;
}

/* =========================================================
   SELLER 1
   ========================================================= */

type SellerCreds = { apiKey: string; masterKey: string };

async function purchaseFromSeller1(
  price: CatalogPrice,
  productName: string,
  duration: string,
  creds?: SellerCreds
) {
  // A co-admin store passes ITS OWN key (master key optional). The owner uses the environment keys, as before.
  const apiKey = creds ? creds.apiKey : process.env.RESELLER_API_KEY;

  const masterKey = creds ? creds.masterKey : process.env.RESELLER_MASTER_KEY;

  if (!apiKey || (!creds && !masterKey)) {
    console.error(
      "SELLER 1 API credentials are missing."
    );

    return {
      success: false,
      error:
        "Seller 1 is not configured.",
    };
  }

  const productId =
    String(
      price.seller1Pid ?? ""
    ).trim();

  const sellerDuration =
    String(
      price.seller1Duration ?? ""
    ).trim();

  if (!productId) {
    return {
      success: false,
      error:
        `Seller 1 product ID is not configured for "${productName}" - "${duration}".`,
    };
  }

  if (!sellerDuration) {
    return {
      success: false,
      error:
        `Seller 1 duration is not configured for "${productName}" - "${duration}".`,
    };
  }

  try {
    const params =
      new URLSearchParams({
        api_key: apiKey,
        action: "buy",
        product_id: productId,
        duration:
          sellerDuration,
      });

    const response =
      await fetch(
        SELLER1_API_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",

            ...(masterKey ? { "x-master-key": masterKey } : {}),
          },

          body:
            params.toString(),

          cache: "no-store",
        }
      );

    const rawResponseText =
      await response.text();

    // Handle a possible UTF-8 BOM and harmless surrounding whitespace.
    const responseText = rawResponseText
      .replace(/^\uFEFF/, "")
      .trim();

    let result: any;

    try {
      result = JSON.parse(responseText);
    } catch {
      // Never log the raw supplier body: it may contain a generated key.
      console.error("SELLER 1 NON-JSON RESPONSE:", {
        httpStatus: response.status,
        ok: response.ok,
        contentType:
          response.headers.get("content-type") || "(missing)",
        bodyLength: rawResponseText.length,
      });

      return {
        success: false,
        error: "Seller 1 returned invalid data.",
      };
    }

    console.log(
      "SELLER 1 BUY RESPONSE STATUS:",
      response.status,
      result?.status
    );

    if (
      !response.ok ||
      result?.status !==
        "success"
    ) {
      return {
        success: false,
        error:
          result?.msg ||
          result?.message ||
          "Seller 1 rejected the purchase.",
      };
    }

    const key =
      result?.data?.key ??
      result?.data?.key_code ??
      result?.key ??
      result?.key_code ??
      result?.access_key;

    if (!key) {
      console.error("SELLER 1 SUCCESS BUT NO KEY:", {
        httpStatus: response.status,
        topLevelFields:
          result && typeof result === "object"
            ? Object.keys(result).slice(0, 20)
            : [],
        dataFields:
          result?.data && typeof result.data === "object"
            ? Object.keys(result.data).slice(0, 20)
            : [],
      });

      return {
        success: false,
        error:
          "Seller 1 completed the purchase but returned no key.",
      };
    }

    return {
      success: true,
      key: String(key),
    };
  } catch (error) {
    console.error(
      "SELLER 1 REQUEST ERROR:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Seller 1 request failed.",
    };
  }
}

/* =========================================================
   SELLER 2
   ========================================================= */

async function purchaseFromSeller2(
  price: CatalogPrice,
  productName: string,
  duration: string,
  creds?: SellerCreds
) {
  const apiToken = creds ? creds.apiKey : process.env.SELLER2_API_TOKEN;

  if (!apiToken) {
    console.error(
      "SELLER2_API_TOKEN is missing."
    );

    return {
      success: false,
      error:
        "Seller 2 is not configured.",
    };
  }

  const variantId =
    String(
      price.seller2VariantId ??
        ""
    ).trim();

  if (!variantId) {
    return {
      success: false,
      error:
        `Seller 2 variant ID is not configured for "${productName}" - "${duration}".`,
    };
  }

  try {
    const response =
      await fetch(
        SELLER2_API_URL,
        {
          method: "POST",

          headers: {
            "X-API-Token":
              apiToken,

            "Content-Type":
              "application/x-www-form-urlencoded",
          },

          body:
            new URLSearchParams({
              variant_id:
                variantId,

              quantity: "1",
            }).toString(),

          cache: "no-store",
        }
      );

    const rawResponseText =
      await response.text();

    // Handle a possible UTF-8 BOM and harmless surrounding whitespace.
    const responseText = rawResponseText
      .replace(/^\uFEFF/, "")
      .trim();

    let result: any;

    try {
      result = JSON.parse(responseText);
    } catch {
      // Log diagnostic metadata only; never print a supplier body/key.
      console.error("SELLER 2 NON-JSON RESPONSE:", {
        httpStatus: response.status,
        ok: response.ok,
        contentType:
          response.headers.get("content-type") || "(missing)",
        bodyLength: rawResponseText.length,
      });

      return {
        success: false,
        error: "Seller 2 returned invalid data.",
      };
    }

    console.log(
      "SELLER 2 BUY RESPONSE STATUS:",
      response.status,
      result?.success
    );

    /*
     * Seller 2 documentation says:
     * check JSON `success`, not HTTP status alone.
     */

    if (
      result?.success !== true
    ) {
      return {
        success: false,
        error:
          result?.error ||
          result?.message ||
          "Seller 2 rejected the purchase.",
      };
    }

    const keysArray = Array.isArray(result?.keys)
      ? result.keys
      : Array.isArray(result?.data?.keys)
        ? result.data.keys
        : [];

    const keyFromArray = keysArray.find(
      (item: unknown) =>
        typeof item === "string" && item.trim().length > 0
    );

    const key =
      keyFromArray ??
      result?.key ??
      result?.key_code ??
      result?.data?.key ??
      result?.data?.key_code ??
      result?.data?.license_key ??
      result?.license_key ??
      result?.access_key;

    if (!key) {
      console.error("SELLER 2 SUCCESS BUT NO KEY:", {
        httpStatus: response.status,
        topLevelFields:
          result && typeof result === "object"
            ? Object.keys(result).slice(0, 20)
            : [],
        dataFields:
          result?.data && typeof result.data === "object"
            ? Object.keys(result.data).slice(0, 20)
            : [],
        keysIsArray: Array.isArray(result?.keys),
        dataKeysIsArray: Array.isArray(result?.data?.keys),
      });

      return {
        success: false,
        error:
          "Seller 2 completed the purchase but returned no key.",
      };
    }

    return {
      success: true,
      key: String(key),
    };
  } catch (error) {
    console.error(
      "SELLER 2 REQUEST ERROR:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Seller 2 request failed.",
    };
  }
}

/* =========================================================
   LOCAL STOCK
   ========================================================= */

/*
 * Local delivery: one shared implementation (lib/stock.ts) used by catalogue and legacy paths.
 */
async function deliverFromLocalStock(
  tenantId: string,
  productName: string,
  duration: string
) {
  const claimed = await claimLocalStockKey(tenantId, productName, duration);

  if (claimed.status === "ok") {
    return { success: true as const, key: claimed.key };
  }

  if (claimed.status === "error") {
    return {
      success: false as const,
      error: "Stock could not be checked right now. Please contact support.",
    };
  }

  return {
    success: false as const,
    error: "Payment received, but no stock key is currently available.",
  };
}

/* =========================================================
   OLD CATALOG FALLBACK
   ========================================================= */

function findOldProduct(
  productName: string
): Product | undefined {
  return allProducts.find(
    (product) =>
      product.name ===
      productName
  );
}

function findOldPrice(
  product: Product,
  duration: string
): PriceTier | undefined {
  return product.prices.find(
    (price) =>
      price.duration ===
      duration
  );
}

/* =========================================================
   MAIN RELEASE FUNCTION
   ========================================================= */

const NOT_CONFIGURED = {
  success: false as const,
  error: "Inventory is not configured for this store yet.",
};

export async function releaseProduct({
  tenantId,
  username,
  product_name,
  duration,
}: ReleaseProductParams) {
  console.log("RELEASE PRODUCT:", product_name, duration);

  /*
   * TENANT SAFETY: the Seller 1 / Seller 2 credentials in the environment belong to the OWNER
   * store. A co-admin store may only deliver from its OWN stock_keys until per-tenant seller
   * credentials / shared stock exist. Fail closed.
   */
  const isOwner = tenantId === OWNER_TENANT_ID;

  const lookup = await findCatalogProduct(tenantId, product_name);

  /*
   * A failed catalogue read is NOT "product not found". We do not know how this product is
   * supplied, so we stop here instead of guessing (and possibly handing out a local key for a
   * Seller product, or buying from the wrong supplier).
   */
  if (lookup.status === "error") {
    return {
      success: false,
      error:
        "Product catalogue could not be read right now. Please contact support.",
    };
  }

  /* ---------------------------------------------------------
     PRODUCT FOUND IN THE CATALOGUE
     --------------------------------------------------------- */
  if (lookup.status === "found") {
    const catalogProduct = lookup.product;

    const catalogPrice = findCatalogPrice(catalogProduct, duration);

    if (!catalogPrice) {
      return {
        success: false,
        error: `Duration "${duration}" is not configured for "${product_name}" in Product Catalog.`,
      };
    }

    const resolved = resolveCatalogSupplier(catalogPrice);

    if (!resolved.ok) {
      console.error("CATALOG SUPPLIER NOT USABLE:", {
        product: product_name,
        duration,
        reason: resolved.reason,
      });

      return {
        success: false,
        error: `Supplier is not configured for "${product_name}" - "${duration}". Set it in Product Manager.`,
      };
    }

    return deliverBySupplier(
      tenantId,
      resolved.supplier,
      catalogPrice,
      product_name,
      duration
    );
  }

  /* ---------------------------------------------------------
     NOT IN THE CATALOGUE (genuinely missing) -> legacy list
     --------------------------------------------------------- */
  console.warn(
    "CATALOG PRODUCT NOT FOUND. USING LEGACY PRODUCT CONFIG:",
    product_name
  );

  // The built-in legacy product list belongs to the owner store only.
  if (!isOwner) {
    return { success: false, error: "Product not found in Product Catalog." };
  }

  const oldProduct = findOldProduct(product_name);

  if (!oldProduct) {
    return {
      success: false,
      error: "Product not found in Product Catalog.",
    };
  }

  const oldPrice = findOldPrice(oldProduct, duration);

  if (!oldPrice) {
    return {
      success: false,
      error: `Duration "${duration}" is not available for this product.`,
    };
  }

  // Express the old configuration in the catalogue shape so both paths share one implementation.
  const legacyPrice: CatalogPrice = {
    duration: oldPrice.duration,
    seller1Pid: oldProduct.sellerPid,
    seller1Duration: oldPrice.sellerDuration,
    seller2VariantId: (oldPrice as any).seller2VariantId,
  };

  const legacySupplier = inferSupplier(legacyPrice, {
    fulfillmentType: oldProduct.fulfillmentType,
    sellerPid: oldProduct.sellerPid,
  });

  if (!legacySupplier) {
    return {
      success: false,
      error: "Product has no supplier configuration.",
    };
  }

  return deliverBySupplier(
    tenantId,
    legacySupplier,
    legacyPrice,
    product_name,
    duration
  );
}

/**
 * One switch for all deliveries. LOCAL is only reached when the supplier really is LOCAL.
 */
async function deliverBySupplier(
  tenantId: string,
  supplier: Supplier,
  price: CatalogPrice,
  productName: string,
  duration: string
) {
  console.log("DELIVERY SUPPLIER:", supplier);

  if (supplier === "JPRIME") {
    return tenantId === OWNER_TENANT_ID ? NOT_CONFIGURED : deliverFromJprime(tenantId, price, productName);
  }

  if (supplier !== "LOCAL" && tenantId !== OWNER_TENANT_ID) {
    // A co-admin store may only use a seller it was APPROVED for, with ITS OWN key. Never the owner's key.
    if (supplier !== "SELLER1" && supplier !== "SELLER2") return NOT_CONFIGURED;
    const creds = await sellerCredsForTenant(tenantId, supplier);
    if (!creds) return NOT_CONFIGURED;
    return supplier === "SELLER1"
      ? purchaseFromSeller1(price, productName, duration, creds)
      : purchaseFromSeller2(price, productName, duration, creds);
  }

  if (supplier === "SELLER1") {
    return purchaseFromSeller1(price, productName, duration);
  }

  if (supplier === "SELLER2") {
    return purchaseFromSeller2(price, productName, duration);
  }

  return deliverFromLocalStock(tenantId, productName, duration);
}


/**
 * JPRIME API stock for a CO-ADMIN store.
 * The owner's reseller price is taken from the store's wallet (the reseller wallet on the main site) FIRST, in one
 * atomic step. If the seller then fails, the same amount is returned. If the wallet is too low, nothing is bought
 * and the customer simply sees "out of stock". The customer never sees supplier names or the owner's product ids.
 */
export const LOW_CREDIT_MESSAGE = "Out of stock. The store admin's credit is low, please contact the admin.";

async function deliverFromJprime(tenantId: string, price: CatalogPrice, storeProductName: string) {
  const access = await jprimeAccess(tenantId);
  if (!access.allowed || !access.payer) return NOT_CONFIGURED;

  const src = await jprimeSource(price.jprimeProductId, price.jprimeDuration, access.payer);
  if (!src.ok) return { success: false as const, error: "This product is not available right now." };

  const debit = await debitWallet(OWNER_TENANT_ID, access.payer, src.cost);
  if (!debit.ok) {
    return debit.reason === "insufficient"
      ? { success: false as const, error: LOW_CREDIT_MESSAGE }
      : { success: false as const, error: "This product is not available right now." };
  }

  const note = `JPRIME API stock: ${src.productName} (${src.duration}) for store ${tenantId.slice(0, 8)}`;
  await logWalletTransaction({ tenantId: OWNER_TENANT_ID, username: access.payer, type: "debit", amount: src.cost, balance_after: debit.balance, description: note });

  let delivered: { success: boolean; key?: string; error?: string };
  try {
    if (src.supplier === "LOCAL") {
      // the owner's own key stock: claimed atomically by the same function the owner store uses
      const got: any = await deliverFromLocalStock(OWNER_TENANT_ID, src.productName, src.duration);
      delivered = got?.success && got.key ? { success: true, key: got.key } : { success: false };
    } else {
      delivered = src.supplier === "SELLER1"
        ? await purchaseFromSeller1(src.tier as CatalogPrice, src.productName, src.duration)
        : await purchaseFromSeller2(src.tier as CatalogPrice, src.productName, src.duration);
    }
  } catch {
    delivered = { success: false };
  }

  if (delivered.success && delivered.key) return { success: true as const, key: delivered.key };

  // Seller failed: give the credit back exactly once.
  const refund = await creditWallet(OWNER_TENANT_ID, access.payer, src.cost);
  if (refund.ok) {
    await logWalletTransaction({ tenantId: OWNER_TENANT_ID, username: access.payer, type: "refund", amount: src.cost, balance_after: refund.balance, description: `Refund: ${note}` });
  } else {
    console.error("JPRIME API REFUND FAILED - needs manual review:", { store: tenantId, payer: access.payer, amount: src.cost });
  }
  console.error("JPRIME API DELIVERY FAILED:", storeProductName);
  return { success: false as const, error: "This product is not available right now. Please try again later." };
}
