"use client";

import {
  useEffect,
  useState,
} from "react";

import { supabase }
from "@/lib/supabase";

import {
  Package,
  Users,
  ShoppingCart,
  Shield,
} from "lucide-react";

import {
  mobileProducts,
  pcProducts,
} from "@/lib/products";

export default function AdminPage() {

  const allProducts = [
    ...mobileProducts,
    ...pcProducts,
  ];

  const [keys, setKeys] =
    useState<any[]>([]);

  const [users, setUsers] =
    useState<any[]>([]);

  const [purchases,
  setPurchases] =
    useState<any[]>([]);

  const [selectedProduct,
  setSelectedProduct] =
    useState<any>(null);

  const [selectedDuration,
  setSelectedDuration] =
    useState("");

  const [availableStock,
  setAvailableStock] =
    useState(0);

  const [newKeys,
  setNewKeys] =
    useState("");

    const [loading,
      setLoading] =
        useState(true);

    useEffect(() => {

      checkAdmin();
    
    }, []);
    
    async function checkAdmin() {
    
      const user =
        JSON.parse(
          localStorage.getItem(
            "user"
          ) || "{}"
        );
    
      if (!user?.email) {
    
        window.location.href =
          "/login";
    
        return;
      }
    
      const {
        data,
      } = await supabase
        .from("users")
        .select("*")
        .eq(
          "email",
          user.email
        )
        .single();
    
      if (
        !data ||
        data.role !== "admin"
      ) {
        setLoading(false);
        window.location.href =
          "/";
    
        return;
      }
    
      loadDashboard();
      setLoading(false);
    }

  useEffect(() => {

    if (
      selectedProduct &&
      selectedDuration
    ) {
      loadStock();
    }

  }, [
    selectedProduct,
    selectedDuration,
  ]);

  async function loadDashboard() {

    const {
      data: stockData,
    } = await supabase
      .from("stock_keys")
      .select("*")
      .eq(
        "is_used",
        false
      );

    const {
      data: usersData,
    } = await supabase
      .from("users")
      .select("*");

    const {
      data: purchaseData,
    } = await supabase
      .from("purchase_history")
      .select("*")
      .order(
        "id",
        {
          ascending: false,
        }
      );

    setKeys(
      stockData || []
    );

    setUsers(
      usersData || []
    );

    setPurchases(
      purchaseData || []
    );
  }

  async function loadStock() {

    const { data } =
      await supabase
        .from("stock_keys")
        .select("*")
        .eq(
          "product_name",
          selectedProduct.name
        )
        .eq(
          "duration",
          selectedDuration
        )
        .eq(
          "is_used",
          false
        );

    setAvailableStock(
      data?.length || 0
    );
  }

  async function handleAddStock() {

    if (
      !selectedProduct ||
      !selectedDuration ||
      !newKeys
    ) {

      alert(
        "Fill all fields"
      );

      return;
    }

    const splitKeys =
      newKeys
        .split("\n")
        .map((key) =>
          key.trim()
        )
        .filter(Boolean);

    const rows =
      splitKeys.map((key) => ({
        product_name:
          selectedProduct.name,

        duration:
          selectedDuration,

        key_code:
          key,

        is_used:
          false,
      }));

    const { error } =
      await supabase
        .from("stock_keys")
        .insert(rows);

    if (error) {

      alert(error.message);

    } else {

      alert(
        "Stock Added Successfully"
      );

      setNewKeys("");

      loadDashboard();

      loadStock();
    }
  }

  async function deleteStock(
    id: number
  ) {
  
    const confirmDelete =
      confirm(
        "Delete this stock key?"
      );
  
    if (!confirmDelete)
      return;
  
    const { error } =
      await supabase
        .from("stock_keys")
        .delete()
        .eq(
          "id",
          id
        );
  
    if (error) {
  
      alert(error.message);
  
    } else {
  
      loadDashboard();
  
      if (
        selectedProduct &&
        selectedDuration
      ) {
        loadStock();
      }
    }
  }

  if (loading) {

    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white text-2xl font-bold">
  
        Loading...
  
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-10 overflow-hidden relative">

  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,200,255,0.12),transparent_40%)]" />

  <div className="relative z-10">
      <div className="max-w-7xl mx-auto">

        <div className="flex items-center justify-between mb-12">

          <div>

            <h1 className="text-5xl font-black mb-3">

              ADMIN PANEL

            </h1>

            <p className="text-zinc-400">

              JPRIME CHEATS STORE

            </p>

          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-3">

            <div className="flex items-center gap-2">

              <Shield className="text-cyan-400 h-5 w-5" />

              <span className="font-bold">

                ADMIN

              </span>

            </div>

          </div>

        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-10">

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">

            <div className="flex items-center justify-between mb-5">

              <Package className="h-10 w-10 text-cyan-400" />

              <span className="text-zinc-500">

                STOCK

              </span>

            </div>

            <h2 className="text-4xl font-black">

              {keys.length}

            </h2>

          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">

            <div className="flex items-center justify-between mb-5">

              <Users className="h-10 w-10 text-cyan-400" />

              <span className="text-zinc-500">

                USERS

              </span>

            </div>

            <h2 className="text-4xl font-black">

              {users.length}

            </h2>

          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">

            <div className="flex items-center justify-between mb-5">

              <ShoppingCart className="h-10 w-10 text-cyan-400" />

              <span className="text-zinc-500">

                SALES

              </span>

            </div>

            <h2 className="text-4xl font-black">

              {purchases.length}

            </h2>

          </div>

        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 mb-10">

          <h2 className="text-3xl font-black mb-8">

            ADD STOCK

          </h2>

          <div className="grid md:grid-cols-2 gap-4 mb-4">

            <select
              onChange={(e) => {

                const found =
                  allProducts.find(
                    (item) =>
                      item.name ===
                      e.target.value
                  );

                setSelectedProduct(
                  found
                );

                setSelectedDuration("");
              }}
              className="bg-zinc-800 rounded-2xl p-4"
            >

              <option value="">
                Select Product
              </option>

              {allProducts.map(
                (product) => (

                <option
                  key={product.id}
                  value={product.name}
                >
                  {product.name}
                </option>
              ))}

            </select>

            <select
              value={selectedDuration}
              onChange={(e) =>
                setSelectedDuration(
                  e.target.value
                )
              }
              className="bg-zinc-800 rounded-2xl p-4"
            >

              <option value="">
                Select Duration
              </option>

              {selectedProduct?.prices.map(
                (price: any) => (

                <option
                  key={price.duration}
                  value={price.duration}
                >
                  {price.duration}
                </option>
              ))}

            </select>

          </div>

          <div className="bg-black rounded-2xl p-4 mb-4">

            Available Stock:
            {" "}

            <span className="text-cyan-400 font-black">

              {availableStock}

            </span>

          </div>

          <textarea
            placeholder="One key per line"
            value={newKeys}
            onChange={(e) =>
              setNewKeys(
                e.target.value
              )
            }
            className="w-full h-48 bg-zinc-800 rounded-2xl p-4 mb-6 outline-none"
          />

          <button
            onClick={handleAddStock}
            className="w-full bg-cyan-400 text-black py-4 rounded-2xl font-black"
          >

            ADD STOCK

          </button>

        </div>

        <div className="grid lg:grid-cols-2 gap-8">

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">

            <h2 className="text-3xl font-black mb-8">

              RECENT PURCHASES

            </h2>

            <div className="space-y-4 max-h-[600px] overflow-auto">

              {purchases.map(
                (purchase) => (

                <div
                  key={purchase.id}
                  className="bg-zinc-800 rounded-2xl p-5"
                >

                  <div className="flex items-center justify-between mb-4">

                    <div>

                      <p className="font-bold text-lg">

                        {purchase.product_name}

                      </p>

                      <p className="text-zinc-400 text-sm">

                        {purchase.duration}

                      </p>

                    </div>

                    <div className="bg-cyan-400/10 border border-cyan-400/20 px-3 py-1 rounded-xl">

                      <p className="text-cyan-400 text-sm font-bold">

                        @{purchase.username}

                      </p>

                    </div>

                  </div>

                  <div className="bg-black rounded-xl p-3 break-all text-sm font-mono">

                    {purchase.key_code}

                  </div>

                </div>
              ))}

            </div>

          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">

            <h2 className="text-3xl font-black mb-8">

              AVAILABLE STOCK

            </h2>

            <div className="space-y-4 max-h-[600px] overflow-auto">

              {keys.map((key) => (

                <div
                  key={key.id}
                  className="bg-zinc-800 rounded-2xl p-5"
                >

                  <div className="flex items-start justify-between gap-4">

                    <div className="flex-1">

                      <p className="font-bold mb-2">

                        {key.product_name}

                      </p>

                      <p className="text-zinc-400 mb-3 text-sm">

                        {key.duration}

                      </p>

                      <div className="bg-black rounded-xl p-3 break-all text-sm font-mono">

                        {key.key_code}

                      </div>

                    </div>

                    <button
                      onClick={() =>
                        deleteStock(
                          key.id
                        )
                      }
                      className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-500/20 transition-all shrink-0"
                    >

                      DELETE

                    </button>

                  </div>

                </div>
              ))}

            </div>

          </div>

        </div>

      </div>

    </div>
    </div>
  );
}