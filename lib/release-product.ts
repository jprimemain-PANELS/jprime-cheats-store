import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  allProducts,
  type Product,
  type PriceTier,
} from "@/lib/products";

interface ReleaseProductParams {
  username: string;
  product_name: string;
  duration: string;
}

type Supplier =
  | "LOCAL"
  | "SELLER1"
  | "SELLER2";

interface CatalogPrice {
  duration?: unknown;
  priceINR?: unknown;
  resellerPrice?: unknown;

  supplier?: unknown;

  seller1Pid?: unknown;
  seller1Duration?: unknown;

  seller2VariantId?: unknown;
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

async function findCatalogProduct(
  productName: string
): Promise<CatalogProduct | null> {
  const { data, error } =
    await supabaseAdmin
      .from("products_catalog")
      .select("product_id, name, data")
      .eq("name", productName)
      .maybeSingle();

  if (error) {
    console.error(
      "CATALOG PRODUCT LOOKUP ERROR:",
      error
    );

    return null;
  }

  if (!data) {
    return null;
  }

  const catalogData =
    data.data &&
    typeof data.data === "object"
      ? data.data
      : {};

  return {
    ...catalogData,
    id:
      catalogData.id ||
      data.product_id,
    name:
      catalogData.name ||
      data.name,
  };
}

function findCatalogPrice(
  product: CatalogProduct,
  duration: string
): CatalogPrice | null {
  const prices = Array.isArray(
    product.prices
  )
    ? product.prices
    : [];

  const found = prices.find(
    (price) =>
      String(
        price?.duration ?? ""
      ).trim() === duration
  );

  return found || null;
}

/* =========================================================
   SELLER 1
   ========================================================= */

async function purchaseFromSeller1(
  price: CatalogPrice,
  productName: string,
  duration: string
) {
  const apiKey =
    process.env.RESELLER_API_KEY;

  const masterKey =
    process.env.RESELLER_MASTER_KEY;

  if (!apiKey || !masterKey) {
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

            "x-master-key":
              masterKey,
          },

          body:
            params.toString(),

          cache: "no-store",
        }
      );

    const responseText =
      await response.text();

    let result: any;

    try {
      result =
        JSON.parse(
          responseText
        );
    } catch {
      console.error(
        "SELLER 1 INVALID RESPONSE:",
        responseText
      );

      return {
        success: false,
        error:
          "Seller 1 returned invalid data.",
      };
    }

    console.log(
      "SELLER 1 BUY RESPONSE:",
      result
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
      console.error(
        "SELLER 1 SUCCESS BUT NO KEY:",
        result
      );

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
  duration: string
) {
  const apiToken =
    process.env.SELLER2_API_TOKEN;

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

    const responseText =
      await response.text();

    let result: any;

    try {
      result =
        JSON.parse(
          responseText
        );
    } catch {
      console.error(
        "SELLER 2 INVALID RESPONSE:",
        responseText
      );

      return {
        success: false,
        error:
          "Seller 2 returned invalid data.",
      };
    }

    console.log(
      "SELLER 2 BUY RESPONSE:",
      result
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

    const key =
      result?.key ??
      result?.key_code ??
      result?.data?.key ??
      result?.data?.key_code ??
      result?.data?.license_key ??
      result?.license_key ??
      result?.access_key;

    if (!key) {
      console.error(
        "SELLER 2 SUCCESS BUT NO KEY:",
        result
      );

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

async function getLocalStockKey(
  productName: string,
  duration: string
) {
  const { data, error } =
    await supabase
      .from("stock_keys")
      .select("*")
      .eq(
        "product_name",
        productName
      )
      .eq(
        "duration",
        duration
      )
      .eq(
        "is_used",
        false
      )
      .order("id", {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

  if (error) {
    console.error(
      "LOCAL STOCK LOOKUP ERROR:",
      error
    );

    return {
      success: false,
      stockKey: null,
    };
  }

  if (!data) {
    return {
      success: false,
      stockKey: null,
    };
  }

  return {
    success: true,
    stockKey: data,
  };
}

async function reserveLocalStockKey(
  id: number
) {
  const { data, error } =
    await supabase
      .from("stock_keys")
      .update({
        is_used: true,
      })
      .eq("id", id)
      .eq("is_used", false)
      .select("id")
      .maybeSingle();

  if (error) {
    console.error(
      "LOCAL STOCK RESERVE ERROR:",
      error
    );

    return false;
  }

  return Boolean(data);
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

/*
 * Backward-compatible Seller 1
 * fallback for products that haven't
 * been moved/configured in catalog yet.
 */

async function oldSeller1Fallback(
  product: Product,
  price: PriceTier
) {
  const apiKey =
    process.env.RESELLER_API_KEY;

  const masterKey =
    process.env.RESELLER_MASTER_KEY;

  if (!apiKey || !masterKey) {
    return {
      success: false,
      error:
        "Seller 1 is not configured.",
    };
  }

  if (!product.sellerPid) {
    return {
      success: false,
      error:
        "Product has no supplier configuration.",
    };
  }

  if (!price.sellerDuration) {
    return {
      success: false,
      error:
        "Seller duration is not configured.",
    };
  }

  try {
    const params =
      new URLSearchParams({
        api_key: apiKey,
        action: "buy",
        product_id:
          String(
            product.sellerPid
          ),
        duration:
          price.sellerDuration,
      });

    const response =
      await fetch(
        SELLER1_API_URL,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
            "x-master-key":
              masterKey,
          },
          body:
            params.toString(),
          cache: "no-store",
        }
      );

    const text =
      await response.text();

    let result: any;

    try {
      result =
        JSON.parse(text);
    } catch {
      return {
        success: false,
        error:
          "Seller 1 returned invalid data.",
      };
    }

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
          "Seller 1 purchase failed.",
      };
    }

    const key =
      result?.data?.key ??
      result?.data?.key_code ??
      result?.key ??
      result?.key_code;

    if (!key) {
      return {
        success: false,
        error:
          "Seller 1 returned no key.",
      };
    }

    return {
      success: true,
      key: String(key),
    };
  } catch (error) {
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
   MAIN RELEASE FUNCTION
   ========================================================= */

export async function releaseProduct({
  username,
  product_name,
  duration,
}: ReleaseProductParams) {
  console.log(
    "================================="
  );

  console.log(
    "RELEASE PRODUCT:",
    product_name,
    duration
  );

  console.log(
    "================================="
  );

  /*
   * First use products_catalog.
   */

  let catalogProduct:
    | CatalogProduct
    | null = null;

  try {
    catalogProduct =
      await findCatalogProduct(
        product_name
      );
  } catch (error) {
    console.error(
      "CATALOG READ FAILED:",
      error
    );
  }

  if (catalogProduct) {
    const catalogPrice =
      findCatalogPrice(
        catalogProduct,
        duration
      );

    if (!catalogPrice) {
      return {
        success: false,
        error:
          `Duration "${duration}" is not configured for "${product_name}" in Product Catalog.`,
      };
    }

    const supplier =
      String(
        catalogPrice.supplier ??
          ""
      )
        .trim()
        .toUpperCase() as Supplier;

    console.log(
      "CATALOG SUPPLIER:",
      supplier
    );

    /*
     * SELLER 1
     */

    if (
      supplier === "SELLER1"
    ) {
      const result =
        await purchaseFromSeller1(
          catalogPrice,
          product_name,
          duration
        );

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        key: result.key,
      };
    }

    /*
     * SELLER 2
     */

    if (
      supplier === "SELLER2"
    ) {
      const result =
        await purchaseFromSeller2(
          catalogPrice,
          product_name,
          duration
        );

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        key: result.key,
      };
    }

    /*
     * LOCAL
     */

    if (
      supplier === "LOCAL"
    ) {
      const stock =
        await getLocalStockKey(
          product_name,
          duration
        );

      if (
        !stock.success ||
        !stock.stockKey
      ) {
        return {
          success: false,
          error:
            "Payment received, but no stock key is currently available.",
        };
      }

      const reserved =
        await reserveLocalStockKey(
          stock.stockKey.id
        );

      if (!reserved) {
        return {
          success: false,
          error:
            "Stock key was taken by another purchase. Please try again.",
        };
      }

      return {
        success: true,
        key: String(
          stock.stockKey.key_code
        ),
      };
    }

    return {
      success: false,
      error:
        `Invalid supplier configuration for "${product_name}" - "${duration}".`,
    };
  }

  /*
   * =======================================================
   * LEGACY FALLBACK
   * =======================================================
   *
   * If the catalog has not been configured for a product yet,
   * preserve the old behavior so the existing store does not
   * suddenly stop working.
   */

  console.warn(
    "CATALOG PRODUCT NOT FOUND. USING LEGACY PRODUCT CONFIG:",
    product_name
  );

  const oldProduct =
    findOldProduct(
      product_name
    );

  if (!oldProduct) {
    return {
      success: false,
      error:
        "Product not found in Product Catalog.",
    };
  }

  const oldPrice =
    findOldPrice(
      oldProduct,
      duration
    );

  if (!oldPrice) {
    return {
      success: false,
      error:
        `Duration "${duration}" is not available for this product.`,
    };
  }

  if (
    oldProduct.sellerPid
  ) {
    const result =
      await oldSeller1Fallback(
        oldProduct,
        oldPrice
      );

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      key: result.key,
    };
  }

  const stock =
    await getLocalStockKey(
      product_name,
      duration
    );

  if (
    !stock.success ||
    !stock.stockKey
  ) {
    return {
      success: false,
      error:
        "Payment received, but no stock key is currently available.",
    };
  }

  const reserved =
    await reserveLocalStockKey(
      stock.stockKey.id
    );

  if (!reserved) {
    return {
      success: false,
      error:
        "Stock key was taken by another purchase. Please try again.",
    };
  }

  return {
    success: true,
    key: String(
      stock.stockKey.key_code
    ),
  };
}