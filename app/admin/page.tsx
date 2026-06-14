"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Package, 
  Users, 
  ShoppingCart, 
  Shield, 
  Trash2, 
  Plus, 
  Terminal,
  Db,
  Activity,
  Layers
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
      <div className="min-h-screen bg-[#060709] flex flex-col items-center justify-center font-mono text-[11px] tracking-[0.3em] text-cyan-400 uppercase">
        <div className="w-12 h-[1px] bg-cyan-500/30 relative overflow-hidden mb-4">
          <div className="absolute top-0 left-0 h-full w-4 bg-cyan-400 animate-pulse-line" />
        </div>
        Initializing System Control Center...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080b] text-[#E4E4E7] font-sans antialiased selection:bg-cyan-500 selection:text-black relative overflow-x-hidden">
      
      {/* HEADER PROTOCOL BAR */}
      <header className="border-b border-white/[0.04] bg-[#0b0c10]/80 backdrop-blur-md sticky top-0 z-50 px-4 md:px-10 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-9 w-9 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.02] flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.05)]">
            <Terminal className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] text-white uppercase font-mono">
              JPRIMEGLOBAL <span className="text-cyan-400 font-normal">// MAIN SYSTEM</span>
            </h1>
            <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mt-0.5">
              Secure Central Registry & Inventory Dispatch
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 font-mono text-[9px] text-zinc-400 border border-white/[0.04] bg-white/[0.01] px-3 py-1.5 rounded-md uppercase tracking-wider">
            <Activity className="h-3 w-3 text-emerald-500 animate-pulse" />
            <span>Node: Active</span>
          </div>
          <div className="bg-[#101218] border border-white/[0.06] rounded-lg px-3 py-1.5 flex items-center gap-2">
            <Shield className="text-cyan-400 h-3 w-3" />
            <span className="font-mono text-[9px] uppercase font-bold tracking-[0.15em] text-zinc-300">
              Admin Mode
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-10 space-y-8 relative z-10">
        
        {/* TOP LEVEL COUNTER CHIPS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Item Box 1 */}
          <div className="bg-[#0b0c10] border border-white/[0.04] rounded-xl p-5 flex items-center justify-between shadow-lg relative overflow-hidden group">
            <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-cyan-500 group-hover:w-full transition-all duration-300" />
            <div>
              <p className="text-[9px] font-mono tracking-widest text-zinc-500 uppercase mb-1">Vault Inventory</p>
              <h3 className="text-3xl font-light font-mono text-white tracking-tight">
                {String(keys.length).padStart(2, "0")} <span className="text-[10px] text-zinc-600 uppercase font-sans tracking-wide">Available</span>
              </h3>
            </div>
            <div className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-lg group-hover:border-cyan-500/20 transition-colors">
              <Package className="h-4 w-4 text-zinc-400 group-hover:text-cyan-400 transition-colors" />
            </div>
          </div>

          {/* Item Box 2 */}
          <div className="bg-[#0b0c10] border border-white/[0.04] rounded-xl p-5 flex items-center justify-between shadow-lg relative overflow-hidden group">
            <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-cyan-500 group-hover:w-full transition-all duration-300" />
            <div>
              <p className="text-[9px] font-mono tracking-widest text-zinc-500 uppercase mb-1">User Base Index</p>
              <h3 className="text-3xl font-light font-mono text-white tracking-tight">
                {String(users.length).padStart(2, "0")} <span className="text-[10px] text-zinc-600 uppercase font-sans tracking-wide">Accounts</span>
              </h3>
            </div>
            <div className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-lg group-hover:border-cyan-500/20 transition-colors">
              <Users className="h-4 w-4 text-zinc-400 group-hover:text-cyan-400 transition-colors" />
            </div>
          </div>

          {/* Item Box 3 */}
          <div className="bg-[#0b0c10] border border-white/[0.04] rounded-xl p-5 flex items-center justify-between shadow-lg relative overflow-hidden group">
            <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-cyan-500 group-hover:w-full transition-all duration-300" />
            <div>
              <p className="text-[9px] font-mono tracking-widest text-zinc-500 uppercase mb-1">Sales Manifest</p>
              <h3 className="text-3xl font-light font-mono text-white tracking-tight">
                {String(purchases.length).padStart(2, "0")} <span className="text-[10px] text-zinc-600 uppercase font-sans tracking-wide">Invoices</span>
              </h3>
            </div>
            <div className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-lg group-hover:border-cyan-500/20 transition-colors">
              <ShoppingCart className="h-4 w-4 text-zinc-400 group-hover:text-cyan-400 transition-colors" />
            </div>
          </div>
        </div>

        {/* WORKSPACE OPERATIONS MATRIX */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT INTERFACE: STOCK DISPATCH MANIFEST CONTROLLER */}
          <div className="lg:col-span-5 bg-[#0b0c10] border border-white/[0.04] rounded-xl p-5 md:p-6 shadow-xl space-y-5">
            <div className="flex items-center gap-2 border-b border-white/[0.03] pb-3">
              <div className="w-1.5 h-1.5 bg-cyan-500 rounded-sm" />
              <h2 className="text-xs font-bold tracking-[0.2em] text-white uppercase font-mono">
                Stock Ingestion Core
              </h2>
            </div>

            {/* Selection Options Input 1 */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 block">Target Product System</label>
              <div className="relative">
                <select
                  onChange={(e) => {
                    const found = allProducts.find((item) => item.name === e.target.value);
                    setSelectedProduct(found);
                    setSelectedDuration("");
                  }}
                  className="w-full bg-[#111319] border border-white/[0.05] rounded-lg p-3.5 text-xs text-zinc-200 outline-none focus:border-cyan-500/40 transition-all appearance-none cursor-pointer font-mono"
                >
                  <option value="">Select Product...</option>
                  {allProducts.map((product) => (
                    <option key={product.id} value={product.name}>
                      {product.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-zinc-500 text-[10px]">▼</div>
              </div>
            </div>

            {/* Selection Options Input 2 */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 block">Target Lease Duration</label>
              <div className="relative">
                <select
                  value={selectedDuration}
                  onChange={(e) => setSelectedDuration(e.target.value)}
                  className="w-full bg-[#111319] border border-white/[0.05] rounded-lg p-3.5 text-xs text-zinc-200 outline-none focus:border-cyan-500/40 transition-all appearance-none cursor-pointer font-mono"
                  disabled={!selectedProduct}
                >
                  <option value="">Select Duration...</option>
                  {selectedProduct?.prices.map((price: any) => (
                    <option key={price.duration} value={price.duration}>
                      {price.duration}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-zinc-500 text-[10px]">▼</div>
              </div>
            </div>

            {/* Sync Cache Log Block */}
            <div className="bg-[#111319] border border-white/[0.02] rounded-lg px-4 py-3 flex items-center justify-between font-mono text-[10px]">
              <span className="text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-cyan-500" />
                Live Matching Balance:
              </span>
              <span className="text-cyan-400 font-bold tracking-widest">
                {availableStock} UNITS UNUSED
              </span>
            </div>

            {/* Key Inputs Arena Block */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 block">Secret Authorization Data Payload (Line Segment Split)</label>
              <textarea
                placeholder="Paste keys list context directly here..."
                value={newKeys}
                onChange={(e) => setNewKeys(e.target.value)}
                className="w-full h-36 bg-[#111319] border border-white/[0.05] rounded-lg p-3.5 text-xs font-mono text-cyan-400 placeholder-zinc-700 outline-none focus:border-cyan-500/20 transition-all resize-none shadow-inner custom-scrollbar"
              />
            </div>

            <button
              onClick={handleAddStock}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-[10px] tracking-[0.25em] uppercase py-4 rounded-lg transition-all shadow-[0_4px_20px_rgba(6,182,212,0.15)] active:translate-y-[1px]"
            >
              COMMIT INVENTORY INGESTION
            </button>
          </div>

          {/* RIGHT INTERFACE: TWIN DATA LOG CONSOLES */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5 h-auto lg:h-[570px]">
            
            {/* RECORD SUITE: HISTORIC DISPATCH INVOICES */}
            <div className="bg-[#0b0c10] border border-white/[0.04] rounded-xl p-5 flex flex-col h-[500px] lg:h-full shadow-lg">
              <div className="flex items-center justify-between border-b border-white/[0.03] pb-3 mb-4 font-mono">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1 h-1 bg-zinc-500 rounded-full" />
                  Sales Audit
                </span>
                <span className="text-[9px] font-semibold text-zinc-500 tracking-widest uppercase">
                  ARCHIVE_LOG
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                {purchases.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                    Manifest empty
                  </div>
                ) : (
                  purchases.map((purchase) => (
                    <div key={purchase.id} className="bg-[#111319] border border-white/[0.03] rounded-lg p-3.5 space-y-2.5 hover:border-white/[0.06] transition-colors group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-semibold text-zinc-100 text-xs tracking-wide truncate">
                            {purchase.product_name}
                          </h4>
                          <p className="text-zinc-500 font-mono text-[9px] uppercase mt-0.5">
                            Lease: {purchase.duration}
                          </p>
                        </div>
                        <span className="text-cyan-400 font-mono text-[9px] font-bold bg-cyan-500/5 border border-cyan-500/10 px-2 py-0.5 rounded-md truncate max-w-[100px]">
                          @{purchase.username}
                        </span>
                      </div>
                      <div className="bg-black/50 border border-white/[0.02] rounded-md p-2 font-mono text-zinc-400 text-[10px] break-all group-hover:text-cyan-400/80 transition-colors shadow-inner">
                        {purchase.key_code}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* RECORD SUITE: UNRELEASED LIVE STOCK VAULT */}
            <div className="bg-[#0b0c10] border border-white/[0.04] rounded-xl p-5 flex flex-col h-[500px] lg:h-full shadow-lg">
              <div className="flex items-center justify-between border-b border-white/[0.03] pb-3 mb-4 font-mono">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse" />
                  Vault Stock
                </span>
                <span className="text-[9px] font-semibold text-zinc-500 tracking-widest uppercase">
                  SECURE_POOL
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                {keys.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                    Vault is depleted
                  </div>
                ) : (
                  keys.map((key) => (
                    <div key={key.id} className="bg-[#111319] border border-white/[0.03] rounded-lg p-3.5 space-y-2.5 hover:border-white/[0.06] transition-colors relative group">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold text-zinc-100 text-xs tracking-wide truncate">
                            {key.product_name}
                          </h4>
                          <p className="text-zinc-500 font-mono text-[9px] uppercase mt-0.5">
                            Allocation: {key.duration}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteStock(key.id)}
                          className="text-zinc-500 hover:text-red-400 p-1.5 rounded-md hover:bg-red-500/5 border border-transparent hover:border-red-500/10 transition-all shrink-0"
                          title="Purge Entry Row"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="bg-black/50 border border-white/[0.02] rounded-md p-2 font-mono text-zinc-400 text-[10px] break-all shadow-inner">
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

      {/* CORE CONTROL FRAME CSS INJECTIONS */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 3px;
          height: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(6, 182, 212, 0.15);
        }
        @keyframes pulse-line {
          0% { left: -30%; }
          100% { left: 110%; }
        }
        .animate-pulse-line {
          animation: pulse-line 1.8s cubic-bezier(0.24, 1, 0.32, 1) infinite;
        }
      `}} />
    </div>
  );
}