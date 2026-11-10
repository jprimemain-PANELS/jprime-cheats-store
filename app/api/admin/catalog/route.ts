import { NextRequest, NextResponse } from "next/server";
import { guardStoreTiers } from "@/lib/api-system";
import { tdb } from "@/lib/tenant-db";
import { requireTenantAdmin } from "@/lib/auth";
import { cleanProductId, cleanProductText } from "@/lib/text-clean";

export const dynamic = "force-dynamic";


/**
 * GET /api/admin/catalog
 * Admin-only raw catalog access.
 * Supplier fields are allowed here because this endpoint is admin-only.
 */
export async function GET(request: NextRequest) {
  const auth = await requireTenantAdmin(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { data, error } = await tdb(auth.tenant.id)
      .from("products_catalog")
      .select("id, product_id, name, data, created_at, updated_at")
      .order("id", { ascending: true });

    if (error) {
      console.error("ADMIN CATALOG GET ERROR:", error);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      products: data || [],
    });
  } catch (error: any) {
    console.error("ADMIN CATALOG GET EXCEPTION:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to load catalog",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/catalog
 * Creates or updates one catalog product.
 */
export async function POST(request: NextRequest) {
  const auth = await requireTenantAdmin(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const product = body?.product;

    if (!product || typeof product !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "Missing product",
        },
        { status: 400 }
      );
    }

    // A co-admin store may sell: its own LOCAL stock, JPRIME API stock (if the owner enabled it), or a seller
    // it was APPROVED for on the API SYSTEM page. Never trust the browser: enforce it here as well as in the form.
    if (auth.tenant.kind !== "owner") {
      const guard = await guardStoreTiers(auth.tenant.id, product as any);
      if (!guard.ok) return NextResponse.json({ success: false, error: guard.error }, { status: 400 });
    }

    let productId = String(product.id || "").trim();
    let productName = String(product.name || "").trim();

    // Product id / name / duration are matching KEYS (prices, stock, orders). Fancy-font text breaks them, so
    // NEW products (and everything in a co-admin store) are cleaned to plain text. An EXISTING product of the
    // owner store is saved exactly as before, so nothing already working can change.
    const existing = productId
      ? await tdb(auth.tenant.id).from("products_catalog").select("id").eq("product_id", productId).maybeSingle()
      : { data: null as any };
    if (auth.tenant.kind !== "owner" || !existing.data) {
      productId = cleanProductId(productId);
      productName = cleanProductText(productName);
      if (!productId) return NextResponse.json({ success: false, error: "Product ID must use plain letters, numbers and hyphens." }, { status: 400 });
      (product as any).id = productId;
      (product as any).name = productName;
      if (Array.isArray((product as any).prices)) {
        for (const t of (product as any).prices) if (t && typeof t.duration === "string") t.duration = cleanProductText(t.duration);
      }
    }

    if (!productId || !productName) {
      return NextResponse.json(
        {
          success: false,
          error: "Product id and name are required",
        },
        { status: 400 }
      );
    }

    const { data, error } = await tdb(auth.tenant.id)
      .from("products_catalog")
      .upsert(
        {
          product_id: productId,
          name: productName,
          data: product,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "tenant_id,product_id",
        }
      )
      .select("id, product_id, name, data, created_at, updated_at")
      .single();

    if (error) {
      console.error("ADMIN CATALOG SAVE ERROR:", error);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      product: data,
    });
  } catch (error: any) {
    console.error("ADMIN CATALOG SAVE EXCEPTION:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to save product",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/catalog
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireTenantAdmin(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const productId = String(body?.product_id || "").trim();

    if (!productId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing product_id",
        },
        { status: 400 }
      );
    }

    const { error } = await tdb(auth.tenant.id)
      .from("products_catalog")
      .delete()
      .eq("product_id", productId);

    if (error) {
      console.error("ADMIN CATALOG DELETE ERROR:", error);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("ADMIN CATALOG DELETE EXCEPTION:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to delete product",
      },
      { status: 500 }
    );
  }
}