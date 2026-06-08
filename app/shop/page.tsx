"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ShopPage() {

  const [user, setUser] =
  useState<any>(null);

  const [products, setProducts] =
    useState<any[]>([]);

  const [stockKeys, setStockKeys] =
    useState<any[]>([]);

  const [selectedProduct, setSelectedProduct] =
    useState("");

  const [selectedDuration, setSelectedDuration] =
    useState("");

  const [selectedPrice, setSelectedPrice] =
    useState("");

  useEffect(() => {

  const savedUser =
    localStorage.getItem("user");

  if (savedUser) {
    setUser(
      JSON.parse(savedUser)
    );
  }

  loadProducts();
  loadStock();

}, []);

  async function loadProducts() {

    const { data } = await supabase
      .from("products")
      .select("*");

    if (data) {
      setProducts(data);
    }
  }

  async function loadStock() {

    const { data } = await supabase
      .from("stock_keys")
      .select("*")
      .eq("is_used", false);

    if (data) {
      setStockKeys(data);
    }
  }

  const uniqueProducts = Array.from(
    new Set(
      products.map(
        (item) => item.product_name
      )
    )
  );

  const durations = products.filter(
    (item) =>
      item.product_name ===
      selectedProduct
  );

  const selectedStock =
    stockKeys.filter(
      (item) =>
        item.product_name ===
          selectedProduct &&
        item.duration ===
          selectedDuration
    );

  const availableStock =
    selectedStock.length;
  
    async function handlePayment() {

      console.log("PAY BUTTON CLICKED");
    
      if (availableStock === 0) {
        alert("Out Of Stock");
        return;
      }
    
      const response = await fetch(
        "/api/create-order",
        {
          method: "POST",
        }
      );
    
      ...
    }

    const result = await response.json();

    const sessionId =
      result.data.payment_session_id;

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
    <div className="min-h-screen bg-black text-white p-10">

      <div className="max-w-xl mx-auto bg-zinc-900 p-8 rounded-2xl">

        <h1 className="text-4xl font-bold mb-8 text-center">
          Purchase Product
        </h1>

        <select
          value={selectedProduct}
          onChange={(e) => {

            setSelectedProduct(
              e.target.value
            );

            setSelectedDuration("");
            setSelectedPrice("");
          }}
          className="w-full p-3 rounded-xl bg-zinc-800 mb-4"
        >
          <option value="">
            Select Product
          </option>

          {uniqueProducts.map((product) => (
            <option
              key={product}
              value={product}
            >
              {product}
            </option>
          ))}
        </select>

        <select
          value={selectedDuration}
          onChange={(e) => {

            setSelectedDuration(
              e.target.value
            );

            const found =
              durations.find(
                (item) =>
                  item.duration ===
                  e.target.value
              );

            if (found) {

  if (user?.role === "reseller") {

    setSelectedPrice(
      found.reseller_price
    );

  } else {

    setSelectedPrice(
      found.price
    );

  }
}
          }}
          className="w-full p-3 rounded-xl bg-zinc-800 mb-6"
        >
          <option value="">
            Select Duration
          </option>

          {durations.map((item) => (
            <option
              key={item.id}
              value={item.duration}
            >
              {item.duration}
            </option>
          ))}
        </select>

        {selectedDuration && (
          <div className="bg-zinc-800 p-4 rounded-xl mb-4 text-center">

            <p className="text-zinc-400">
              Available Stock
            </p>

            <h2 className="text-2xl font-bold">
              {availableStock}
            </h2>
            </div>
        )}

        {selectedPrice && (
          <div className="bg-zinc-800 p-4 rounded-xl mb-6 text-center">

            <p className="text-zinc-400">
              Price
            </p>

            <h2 className="text-3xl font-bold">
              ₹{selectedPrice}
            </h2>

          </div>
        )}

        <button
          onClick={handlePayment}
          disabled={
            !selectedProduct ||
            !selectedDuration ||
            availableStock === 0
          }
          className="w-full bg-white text-black py-3 rounded-xl font-bold disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {selectedProduct &&
           selectedDuration &&
           availableStock === 0
            ? "Out Of Stock"
            : "Pay Now"}
        </button>

      </div>

    </div>
  );
}