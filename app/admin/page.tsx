"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Package,
  Users,
  ShoppingCart,
  Shield,
  Trash2,
  PackagePlus,
  KeyRound,
  Activity,
  ChevronDown,
} from "lucide-react";

import { mobileProducts, pcProducts } from "@/lib/products";

export default function AdminPage() {
  const allProducts = [...mobileProducts, ...pcProducts];

  const [keys, setKeys] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedDuration, setSelectedDuration] = useState("");
  const [availableStock, setAvailableStock] = useState(0);
  const [newKeys, setNewKeys] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    if (!user?.email) {
      window.location.href = "/login";
      return;
    }

    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("email", user.email)
      .single();

    if (!data || data.role !== "admin") {
      setLoading(false);
      window.location.href = "/";
      return;
    }

    loadDashboard();
    setLoading(false);
  }

  useEffect(() => {
    if (selectedProduct && selectedDuration) {
      loadStock();
    }
  }, [selectedProduct, selectedDuration]);

  async function loadDashboard() {
    const { data: stockData } = await supabase
      .from("stock_keys")
      .select("*")
      .eq("is_used", false);

    const { data: usersData } = await supabase
      .from("users")
      .select("*");

    const { data: purchaseData } = await supabase
      .from("purchase_history")
      .select("*")
      .order("id", { ascending: false });

    setKeys(stockData || []);
    setUsers(usersData || []);
    setPurchases(purchaseData || []);
  }

  async function loadStock() {
    const { data } = await supabase
      .from("stock_keys")
      .select("*")
      .eq("product_name", selectedProduct.name)
      .eq("duration", selectedDuration)
      .eq("is_used", false);

    setAvailableStock(data?.length || 0);
  }

  async function handleAddStock() {
    if (!selectedProduct || !selectedDuration || !newKeys) {
      alert("Fill all fields");
      return;
    }

    const splitKeys = newKeys
      .split("\n")
      .map((key) => key.trim())
      .filter(Boolean);

    const rows = splitKeys.map((key) => ({
      product_name: selectedProduct.name,
      duration: selectedDuration,
      key_code: key,
      is_used: false,
    }));

    const { error } = await supabase.from("stock_keys").insert(rows);

    if (error) {
      alert(error.message);
    } else {
      alert("Stock Added Successfully");
      setNewKeys("");
      loadDashboard();
      loadStock();
    }
  }

  async function deleteStock(id: number) {
    const confirmDelete = confirm("Delete this stock key?");
    if (!confirmDelete) return;

    const { error } = await supabase
      .from("stock_keys")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
    } else {
      loadDashboard();
      if (selectedProduct && selectedDuration) {
        loadStock();
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-[#E6E7EB] border-t-[#14213D] animate-spin" />
        <p className="text-xs font-medium tracking-wide text-[#6B7280]">
          Loading admin console…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8] text-[#12141A] font-sans antialiased">

      {/* HEADER */}
      <header className="border-b border-[#E6E7EB] bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#14213D] flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-[#12141A] leading-none">
                JPrimeCheats
              </h1>
              <p className="text-xs text-[#6B7280] mt-1">
                Admin Console
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#6B7280] border border-[#E6E7EB] bg-[#FAFAFB] px-3 py-1.5 rounded-full">
              <Activity className="h-3 w-3 text-emerald-600" />
              <span>System active</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#14213D] text-white text-xs font-medium px-3 py-1.5 rounded-full">
              <Shield className="h-3 w-3" />
              <span>Admin</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">

        {/* STAT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-[#E6E7EB] rounded-xl p-5 flex items-center gap-4 border-l-4 border-l-blue-500">
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Package className="h-4.5 w-4.5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[#6B7280]">Available keys</p>
              <p className="text-2xl font-semibold text-[#12141A] tabular-nums">
                {keys.length}
              </p>
            </div>
          </div>

          <div className="bg-white border border-[#E6E7EB] rounded-xl p-5 flex items-center gap-4 border-l-4 border-l-violet-500">
            <div className="h-10 w-10 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
              <Users className="h-4.5 w-4.5 text-violet-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[#6B7280]">Registered users</p>
              <p className="text-2xl font-semibold text-[#12141A] tabular-nums">
                {users.length}
              </p>
            </div>
          </div>

          <div className="bg-white border border-[#E6E7EB] rounded-xl p-5 flex items-center gap-4 border-l-4 border-l-amber-500">
            <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <ShoppingCart className="h-4.5 w-4.5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[#6B7280]">Total purchases</p>
              <p className="text-2xl font-semibold text-[#12141A] tabular-nums">
                {purchases.length}
              </p>
            </div>
          </div>
        </div>

        {/* WORKSPACE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ADD STOCK PANEL */}
          <div className="lg:col-span-5 bg-white border border-[#E6E7EB] rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-[#E6E7EB]">
              <PackagePlus className="h-4 w-4 text-[#14213D]" />
              <h2 className="text-sm font-semibold text-[#12141A]">
                Add stock
              </h2>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#6B7280] block">
                Product
              </label>
              <div className="relative">
                <select
                  onChange={(e) => {
                    const found = allProducts.find((item) => item.name === e.target.value);
                    setSelectedProduct(found);
                    setSelectedDuration("");
                  }}
                  className="w-full bg-white border border-[#E6E7EB] rounded-lg py-2.5 pl-3.5 pr-9 text-sm text-[#12141A] outline-none focus:border-[#14213D] focus:ring-2 focus:ring-[#14213D]/10 transition-all appearance-none cursor-pointer"
                >
                  <option value="">Select a product…</option>
                  {allProducts.map((product) => (
                    <option key={product.id} value={product.name}>
                      {product.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9CA3AF]" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#6B7280] block">
                Duration
              </label>
              <div className="relative">
                <select
                  value={selectedDuration}
                  onChange={(e) => setSelectedDuration(e.target.value)}
                  className="w-full bg-white border border-[#E6E7EB] rounded-lg py-2.5 pl-3.5 pr-9 text-sm text-[#12141A] outline-none focus:border-[#14213D] focus:ring-2 focus:ring-[#14213D]/10 transition-all appearance-none cursor-pointer disabled:bg-[#FAFAFB] disabled:text-[#9CA3AF] disabled:cursor-not-allowed"
                  disabled={!selectedProduct}
                >
                  <option value="">Select a duration…</option>
                  {selectedProduct?.prices.map((price: any) => (
                    <option key={price.duration} value={price.duration}>
                      {price.duration}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9CA3AF]" />
              </div>
            </div>

            <div className="bg-[#FAFAFB] border border-[#E6E7EB] rounded-lg px-4 py-3 flex items-center justify-between text-sm">
              <span className="text-[#6B7280]">Unused stock for this selection</span>
              <span className="font-semibold text-[#12141A] tabular-nums">
                {availableStock}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#6B7280] block">
                Keys (one per line)
              </label>
              <textarea
                placeholder="Paste license keys here, one per line…"
                value={newKeys}
                onChange={(e) => setNewKeys(e.target.value)}
                className="w-full h-36 bg-white border border-[#E6E7EB] rounded-lg p-3.5 text-sm font-mono text-[#12141A] placeholder-[#9CA3AF] outline-none focus:border-[#14213D] focus:ring-2 focus:ring-[#14213D]/10 transition-all resize-none custom-scrollbar"
              />
            </div>

            <button
              onClick={handleAddStock}
              className="w-full bg-[#14213D] hover:bg-[#1c2c52] text-white font-medium text-sm py-3 rounded-lg transition-colors"
            >
              Add to inventory
            </button>
          </div>

          {/* LISTS */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5 h-auto lg:h-[600px]">

            {/* PURCHASE HISTORY */}
            <div className="bg-white border border-[#E6E7EB] rounded-xl p-5 flex flex-col h-[500px] lg:h-full">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E6E7EB]">
                <span className="text-sm font-semibold text-[#12141A]">
                  Purchase history
                </span>
                <span className="text-xs text-[#9CA3AF]">
                  {purchases.length} total
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                {purchases.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-[#9CA3AF]">
                    No purchases yet
                  </div>
                ) : (
                  purchases.map((purchase) => (
                    <div key={purchase.id} className="bg-[#FAFAFB] border border-[#E6E7EB] rounded-lg p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-medium text-[#12141A] text-sm truncate">
                            {purchase.product_name}
                          </h4>
                          <p className="text-[#6B7280] text-xs mt-0.5">
                            {purchase.duration}
                          </p>
                        </div>
                        <span className="text-[#14213D] bg-white border border-[#E6E7EB] text-xs font-medium px-2 py-0.5 rounded-md truncate max-w-[110px]">
                          @{purchase.username}
                        </span>
                      </div>
                      <div className="bg-white border border-[#E6E7EB] rounded-md px-2.5 py-1.5 font-mono text-[#6B7280] text-xs break-all">
                        {purchase.key_code}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* AVAILABLE STOCK */}
            <div className="bg-white border border-[#E6E7EB] rounded-xl p-5 flex flex-col h-[500px] lg:h-full">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E6E7EB]">
                <span className="text-sm font-semibold text-[#12141A] flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-[#6B7280]" />
                  Available stock
                </span>
                <span className="text-xs text-[#9CA3AF]">
                  {keys.length} total
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                {keys.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-[#9CA3AF]">
                    No stock available
                  </div>
                ) : (
                  keys.map((key) => (
                    <div key={key.id} className="bg-[#FAFAFB] border border-[#E6E7EB] rounded-lg p-3.5 space-y-2 group">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-[#12141A] text-sm truncate">
                            {key.product_name}
                          </h4>
                          <p className="text-[#6B7280] text-xs mt-0.5">
                            {key.duration}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteStock(key.id)}
                          className="text-[#9CA3AF] hover:text-rose-600 p-1.5 rounded-md hover:bg-rose-50 transition-colors shrink-0"
                          title="Delete key"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="bg-white border border-[#E6E7EB] rounded-md px-2.5 py-1.5 font-mono text-[#6B7280] text-xs break-all">
                        {key.key_code}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #D8DAE0;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #B8BCC4;
        }
      `}} />
    </div>
  );
}