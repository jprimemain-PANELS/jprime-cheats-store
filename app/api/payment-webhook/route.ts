import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Webhook Working",
  });
}

export async function POST(request: Request) {
  const body = await request.json();

  console.log("PAYMENT:", body);

  return NextResponse.json({
    success: true,
  });
}