import { supabase } from "@/lib/supabase";

interface ReleaseProductParams {
  username: string;
  product_name: string;
  duration: string;
}

export async function releaseProduct({
  username,
  product_name,
  duration,
}: ReleaseProductParams) {
  // Find one unused stock key
  const { data: stockKey, error: stockError } = await supabase
    .from("stock_keys")
    .select("*")
    .eq("product_name", product_name)
    .eq("duration", duration)
    .eq("is_used", false)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (stockError || !stockKey) {
    return {
      success: false,
      error:
        "Payment received, but no stock key is currently available.",
    };
  }

  // Reserve key
  const { error: keyUpdateError } = await supabase
    .from("stock_keys")
    .update({
      is_used: true,
    })
    .eq("id", stockKey.id)
    .eq("is_used", false);

  if (keyUpdateError) {
    return {
      success: false,
      error: "Unable to reserve stock key.",
    };
  }

  // Save purchase history
  const { error: historyError } = await supabase
    .from("purchase_history")
    .insert([
      {
        username,
        product_name,
        duration,
        key_code: stockKey.key_code,
      },
    ]);

  if (historyError) {
    // Rollback
    await supabase
      .from("stock_keys")
      .update({
        is_used: false,
      })
      .eq("id", stockKey.id);

    return {
      success: false,
      error: "Unable to save purchase history.",
    };
  }

  return {
    success: true,
    key: stockKey.key_code,
  };
}