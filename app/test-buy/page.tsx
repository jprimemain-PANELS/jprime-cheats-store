"use client";

export default function TestBuyPage() {

  async function handlePayment() {

    const response = await fetch(
      "/api/create-order",
      {
        method: "POST",
      }
    );

    const result = await response.json();

    console.log(result);

    const sessionId =
      result.data.payment_session_id;

    if (!sessionId) {
      alert("Session ID not found");
      return;
    }

    const script =
      document.createElement("script");

    script.src =
      "https://sdk.cashfree.com/js/v3/cashfree.js";

    script.onload = () => {

      // @ts-ignore
      const cashfree =
        window.Cashfree({
          mode: "sandbox",
        });

      cashfree.checkout({
        paymentSessionId:
          sessionId,

          redirectTarget: "_self",
      });
    };

    document.body.appendChild(script);
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">

      <div className="bg-zinc-900 p-10 rounded-2xl w-full max-w-md">

        <h1 className="text-3xl font-bold mb-6 text-center">
          Cashfree Checkout
        </h1>

        <button
          onClick={handlePayment}
          className="w-full bg-white text-black py-3 rounded-xl font-bold"
        >
          Pay Now
        </button>

      </div>

    </div>
  );
}