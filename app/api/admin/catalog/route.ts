import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase server credentials are not configured.");
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function verifyAdmin(request: Request) {
  const body = await request.json().catch(() => ({}));

  const email =
    String(
      body?.email ||
        request.headers.get("x-admin-email") ||
        ""
    ).trim();

  if (!email) {
    return {
      ok: false,
      error: "Admin email is required.",
      body,
    };
  }

  const supabase = getAdminClient();

  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, role")
    .eq("email", email)
    .single();

  if (error || !user || user.role !== "admin") {
    return {
      ok: false,
      error: "Admin access required.",
      body,
    };
  }

  return {
    ok: true,
    user,
    body,
  };
}

export async function GET(request: Request) {
  try {
    const email = request.headers.get("x-admin-email")?.trim();

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Admin email is required." },
        { status: 401 }
      );
    }

    const supabase = getAdminClient();

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, role")
      .eq("email", email)
      .single();

    if (userError || !user || user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Admin access required." },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from("products_catalog")
      .select("id, product_id, name, data, created_at, updated_at")
      .order("id", { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      products: data || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to load catalog.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await verifyAdmin(request);

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 403 }
      );
    }

    const body = auth.body;
    const product = body?.product;

    if (!product || typeof product !== "object") {
      return NextResponse.json(
        { success: false, error: "Product data is required." },
        { status: 400 }
      );
    }

    const productId = String(product.id || "").trim();
    const name = String(product.name || "").trim();

    if (!productId || !name) {
      return NextResponse.json(
        { success: false, error: "Product ID and name are required." },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    const row = {
      product_id: productId,
      name,
      data: product,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("products_catalog")
      .upsert(row, {
        onConflict: "product_id",
      })
      .select("id, product_id, name, data, created_at, updated_at")
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      product: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to save product.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await verifyAdmin(request);

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 403 }
      );
    }

    const productId = String(auth.body?.product_id || "").trim();

    if (!productId) {
      return NextResponse.json(
        { success: false, error: "Product ID is required." },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    const { error } = await supabase
      .from("products_catalog")
      .delete()
      .eq("product_id", productId);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to delete product.",
      },
      { status: 500 }
    );
  }
}