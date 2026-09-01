import { supabase } from "@/lib/supabase";
import { allProducts, Product, PriceTier } from "@/lib/products";

interface ReleaseProductParams {
  username: string;
  product_name: string;
  duration: string;
}

function findProduct(productName: string): Product | undefined {
  return allProducts.find((product) => product.name === productName);
}

function findPriceTier(product: Product, duration: string): PriceTier | undefined {
  const priceList = product.pricing || product.prices;
  return priceList?.find((price) => price.duration === duration);
}

export async function releaseProduct({ username, product_name, duration }: ReleaseProductParams) {
  const product = findProduct(product_name);

  if (!product) {
    throw new Error(`Product "${product_name}" not found in catalog.`);
  }

  const priceTier = findPriceTier(product, duration);

  // ----------------------------------------------------
  // 1. RESELLER API FULFILLMENT (For supplier products)
  // ----------------------------------------------------
  if (product.fulfillmentType === "API" && product.sellerPid) {
    const targetDuration = priceTier?.sellerDuration || duration;
    const apiKey = process.env.RESELLER_API_KEY || process.env.ADMINPANELS_API_KEY || "";

    const targetUrl = new URL("https://adminpanels.shop/api/reseller_v1.php");
    targetUrl.searchParams.append("api_key", apiKey);
    targetUrl.searchParams.append("action", "buy");
    targetUrl.searchParams.append("product_id", String(product.sellerPid));
    targetUrl.searchParams.append("duration", targetDuration);

    console.log("Sending Supplier API Request:", targetUrl.toString());

    const response = await fetch(targetUrl.toString(), {
      method: "GET",
    });

    const rawResponseText = await response.text();
    console.log("Raw Supplier Response:", rawResponseText);

    let apiResult: any = {};
    try {
      apiResult = JSON.parse(rawResponseText);
    } catch {
      throw new Error(`Invalid response format from supplier: ${rawResponseText}`);
    }

    const key = apiResult.key || apiResult.license_key || apiResult.data?.key || apiResult.code;

    if ((apiResult.status === "success" || apiResult.status === true || apiResult.success) && key) {
      return {
        key,
        type: "API",
        message: apiResult.message || apiResult.msg || "Key generated successfully",
      };
    } else {
      const errorMsg = apiResult.msg || apiResult.message || apiResult.error || rawResponseText;
      throw new Error(`Supplier API error: ${errorMsg}`);
    }
  }

  // ----------------------------------------------------
  // 2. LOCAL SUPABASE STOCK FULFILLMENT (For your own products)
  // ----------------------------------------------------
  const { data: keyData, error: fetchError } = await supabase
    .from("stock_keys")
    .select("*")
    .eq("product_name", product_name)
    .eq("duration", duration)
    .eq("is_used", false)
    .limit(1)
    .maybeSingle();

  if (fetchError || !keyData) {
    throw new Error(`Product "${product_name}" (${duration}) is currently out of stock.`);
  }

  const licenseKey = keyData.license_key || keyData.key_code || keyData.key;

  // Remove used key from local stock table
  await supabase
    .from("stock_keys")
    .delete()
    .eq("id", keyData.id);

  return {
    key: licenseKey,
    type: "LOCAL",
    message: "Key issued from local database",
  };
}