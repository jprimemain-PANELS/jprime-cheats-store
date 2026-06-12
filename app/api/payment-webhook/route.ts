import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Connect using the Service Role Key to bypass any Row Level Security (RLS) locks
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Health check route - visit this in your browser to check if it's live
export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Webhook Working",
  });
}

// Main payment receiver route for MacroDroid
export async function POST(request: Request) {
  try {
    // Read the raw plain text incoming from MacroDroid
    const rawText = await request.text(); // Receives: "Mr JENITH P sent ₹95.07"

    if (!rawText || rawText.trim() === "") {
      return NextResponse.json({ error: "Notification text is empty." }, { status: 400 });
    }

    // RegEx to pull out the exact price digits following the ₹ symbol
    const amountMatch = rawText.match(/₹\s*(\d+\.\d{2})/);
    
    if (!amountMatch) {
      return NextResponse.json({ error: "Could not extract price amount from notification text." }, { status: 400 });
    }

    // Grabs the amount as a clean string text (e.g., "95.07") for your database text column
    const cleanAmountStr = amountMatch[1]; 

    // Execute the database transaction function we made in Step 1
    const { data, error } = await supabaseAdmin.rpc('process_payment_and_release_key', {
      payment_amount: cleanAmountStr
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Grab the first row returned by the function array
    const result = data[0];

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 404 });
    }

    // Success response back to MacroDroid
    return NextResponse.json({ 
      success: true, 
      message: "Payment verified and key linked successfully!" 
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}