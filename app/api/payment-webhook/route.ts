import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Webhook Working",
  });
}

export async function POST(request: Request) {

  const rawText = await request.text();

  console.log("RAW PAYMENT:", rawText);

  return NextResponse.json({
    success: true,
  });
}