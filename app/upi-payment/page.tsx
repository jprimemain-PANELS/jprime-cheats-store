"use client";

import { useSearchParams } from "next/navigation";

export default function UpiPaymentPage() {

  const params =
    useSearchParams();

  const amount =
    params.get("amount");

  const upiLink =
    `upi://pay?pa=7200817883@fam&pn=Jenith&am=${amount}&cu=INR`;

  return (

    <div className="min-h-screen flex items-center justify-center bg-black text-white">

      <div className="max-w-md w-full p-6 rounded-2xl border border-cyan-500">

        <h1 className="text-2xl font-bold text-cyan-400 mb-4">

          Complete Payment

        </h1>

        <p className="mb-4">

          Amount: ₹{amount}

        </p>

        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiLink)}`}
          className="w-full rounded-xl"
        />

        <a
          href={upiLink}
          className="block text-center mt-5 bg-cyan-500 text-black font-bold py-3 rounded-xl"
        >

          PAY NOW

        </a>

      </div>

    </div>
  );
}