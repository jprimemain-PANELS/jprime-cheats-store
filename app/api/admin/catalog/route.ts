import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";


/**
 * GET /api/admin/catalog
 * Admin-only raw catalog access.
 * Supplier fields are allowed here because this endpoint is admin-only.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { data, error } = await supabaseAdmin
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
  const auth = await requireAdmin(request);

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

    const productId = String(product.id || "").trim();
    const productName = String(product.name || "").trim();

    if (!productId || !productName) {
      return NextResponse.json(
        {
          success: false,
          error: "Product id and name are required",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("products_catalog")
      .upsert(
        {
          product_id: productId,
          name: productName,
          data: product,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "product_id",
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
  const auth = await requireAdmin(request);

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

    const { error } = await supabaseAdmin
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