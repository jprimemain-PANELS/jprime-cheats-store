"use client";

import { useEffect, useState, useMemo } from "react";
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
  Settings,
  Plus,
  Minus,
  X,
  Loader2,
  History,
  Boxes,
  LogOut,
  Search,
} from "lucide-react";

import { mobileProducts, pcProducts } from "@/lib/products";

interface ManagedUser {
  id?: string | number;
  username: string;
  email: string;
  mobile_number?: string;
  phone?: string;
  role: string;
  wallet_balance?: number;
}

export default function AdminPage() {
  const allProducts = useMemo(() => [...mobileProducts, ...pcProducts], []);

  const [keys, setKeys] = useState<any[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedDuration, setSelectedDuration] = useState("");
  const [availableStock, setAvailableStock] = useState(0);
  const [newKeys, setNewKeys] = useState("");
  const [loading, setLoading] = useState(true);

  // VIEW SELECTION STATE
  const [activeTab, setActiveTab] = useState<"purchases" | "stock" | null>("purchases");

  // USER SEARCH FILTER STATE
  const [userSearchQuery, setUserSearchQuery] = useState("");

  // USER MANAGEMENT MODAL STATES
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [editRole, setEditRole] = useState("user");
  const [balanceAction, setBalanceAction] = useState<"add" | "remove" | "none">("none");
  const [amountInput, setAmountInput] = useState("");
  const [isSavingUser, setIsSavingUser] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    try {
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

      await loadDashboard();
    } catch (err) {
      console.error("Auth check error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedProduct && selectedDuration) {
      loadStock();
    }
  }, [selectedProduct, selectedDuration]);

  async function loadDashboard() {
    // 1. Fetch available stock
    const { data: stockData } = await supabase
      .from("stock_keys")
      .select("*")
      .eq("is_used", false);

    // 2. Fetch users
    const { data: usersData } = await supabase
      .from("users")
      .select("*");

    // 3. Fetch wallets to join balances
    const { data: walletsData } = await supabase
      .from("wallets")
      .select("username, balance");

    // Map wallets balance to users
    const walletMap = new Map(walletsData?.map((w) => [w.username, w.balance]) || []);

    const enrichedUsers: ManagedUser[] = (usersData || []).map((u: any) => ({
      ...u,
      wallet_balance: walletMap.get(u.username) ?? 0,
    }));

    // 4. Fetch purchase history
    const { data: purchaseData } = await supabase
      .from("purchase_history")
      .select("*")
      .order("id", { ascending: false });

    setKeys(stockData || []);
    setUsers(enrichedUsers);
    setPurchases(purchaseData || []);
  }

  async function loadStock() {
    if (!selectedProduct?.name || !selectedDuration) return;
    const { data } = await supabase
      .from("stock_keys")
      .select("*")
      .eq("product_name", selectedProduct.name)
      .eq("duration", selectedDuration)
      .eq("is_used", false);

    setAvailableStock(data?.length || 0);
  }

  async function handleAddStock() {
    if (!selectedProduct || !selectedDuration || !newKeys.trim()) {
      alert("Please fill all product details and paste at least one key.");
      return;
    }

    const splitKeys = newKeys
      .split("\n")
      .map((key) => key.trim())
      .filter(Boolean);

    if (splitKeys.length === 0) return;

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
    if (!confirm("Delete this stock key?")) return;

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

  const handleExitAdminConsole = () => {
    window.location.href = "/";
  };

  // SAFE SEARCH FILTERING LOGIC
  const filteredUsers = useMemo(() => {
    if (!userSearchQuery.trim()) return users;
    const query = userSearchQuery.trim().toLowerCase();

    return users.filter((u) => {
      const usernameMatch = String(u.username || "").toLowerCase().includes(query);
      const emailMatch = String(u.email || "").toLowerCase().includes(query);
      const mobileMatch = String(u.mobile_number || u.phone || "").toLowerCase().includes(query);

      return usernameMatch || emailMatch || mobileMatch;
    });
  }, [users, userSearchQuery]);

  const handleOpenManageModal = (user: ManagedUser) => {
    setSelectedUser(user);
    setEditRole(user.role || "user");
    setBalanceAction("none");
    setAmountInput("");
    setIsManageModalOpen(true);
  };

  const handleSaveUserChanges = async () => {
    if (!selectedUser) return;
    setIsSavingUser(true);

    try {
      if (editRole !== selectedUser.role) {
        const { error: roleError } = await supabase
          .from("users")
          .update({ role: editRole })
          .eq("username", selectedUser.username);

        if (roleError) throw roleError;
      }

      const numericAmount = parseFloat(amountInput);
      if (balanceAction !== "none" && !isNaN(numericAmount) && numericAmount > 0) {
        const currentBalance = selectedUser.wallet_balance || 0;
        const newBalance =
          balanceAction === "add"
            ? currentBalance + numericAmount
            : Math.max(0, currentBalance - numericAmount);

        const { error: walletError } = await supabase
          .from("wallets")
          .update({ balance: newBalance })
          .eq("username", selectedUser.username);

        if (walletError) throw walletError;

        await supabase.from("wallet_transactions").insert({
          username: selectedUser.username,
          type: balanceAction === "add" ? "credit" : "debit",
          amount: numericAmount,
          description: `Admin ${balanceAction === "add" ? "added" : "removed"} funds`,
          created_at: new Date().toISOString(),
        });
      }

      alert("User updated successfully");
      setIsManageModalOpen(false);
      loadDashboard();
    } catch (err: any) {
      alert(err?.message || "Failed to update user");
    } finally {
      setIsSavingUser(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3">
        <div className="h-9 w-9 rounded-full border-2 border-slate-800 border-t-indigo-500 animate-spin" />
        <p className="text-xs font-medium tracking-wide text-slate-400 animate-pulse">
          Loading admin console…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* HEADER */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">
                JPrimeCheats
              </h1>
              <p className="text-xs text-slate-400 font-medium">Admin Control Panel</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 rounded-full backdrop-blur-sm">
              <Activity className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
              <span className="font-medium">System Live</span>
            </div>

            <button
              onClick={handleExitAdminConsole}
              className="flex items-center gap-2 bg-slate-800 hover:bg-rose-600/20 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 text-slate-300 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all duration-200 cursor-pointer shadow-sm hover:shadow-rose-500/10 active:scale-95"
              title="Exit Admin Console & Return to Main Site"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Exit Console</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        {/* STAT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <button
            onClick={() => setActiveTab(activeTab === "stock" ? null : "stock")}
            className={`group text-left bg-gradient-to-br from-slate-900/90 to-slate-900/40 border rounded-2xl p-6 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-blue-500/10 hover:-translate-y-0.5 relative overflow-hidden ${
              activeTab === "stock"
                ? "border-blue-500 ring-2 ring-blue-500/30"
                : "border-slate-800 hover:border-blue-500/50"
            }`}
          >
            <div className="absolute top-0 right-0 h-24 w-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all duration-500 pointer-events-none" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Available Stock
              </span>
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 text-blue-400 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all duration-300">
                <Package className="h-5 w-5" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-white tracking-tight tabular-nums">
              {keys.length}
            </p>
            <p className="text-xs text-blue-400 font-medium mt-2 flex items-center gap-1">
              <span>{activeTab === "stock" ? "Click to collapse view" : "Click to view keys"}</span>
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </p>
          </button>

          <div className="group text-left bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800 rounded-2xl p-6 transition-all duration-300 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 h-24 w-24 bg-violet-500/10 rounded-full blur-2xl group-hover:bg-violet-500/20 transition-all duration-500 pointer-events-none" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Registered Users
              </span>
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0 text-violet-400 group-hover:scale-110 group-hover:bg-violet-500/20 transition-all duration-300">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-white tracking-tight tabular-nums">
              {users.length}
            </p>
            <p className="text-xs text-slate-500 font-medium mt-2">
              Managed active accounts
            </p>
          </div>

          <button
            onClick={() => setActiveTab(activeTab === "purchases" ? null : "purchases")}
            className={`group text-left bg-gradient-to-br from-slate-900/90 to-slate-900/40 border rounded-2xl p-6 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-amber-500/10 hover:-translate-y-0.5 relative overflow-hidden ${
              activeTab === "purchases"
                ? "border-amber-500 ring-2 ring-amber-500/30"
                : "border-slate-800 hover:border-amber-500/50"
            }`}
          >
            <div className="absolute top-0 right-0 h-24 w-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all duration-500 pointer-events-none" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Purchases
              </span>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-400 group-hover:scale-110 group-hover:bg-amber-500/20 transition-all duration-300">
                <ShoppingCart className="h-5 w-5" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-white tracking-tight tabular-nums">
              {purchases.length}
            </p>
            <p className="text-xs text-amber-400 font-medium mt-2 flex items-center gap-1">
              <span>{activeTab === "purchases" ? "Click to collapse view" : "Click to view logs"}</span>
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </p>
          </button>
        </div>

        {/* WORKSPACE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ADD STOCK PANEL */}
          <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800/80 rounded-2xl p-6 space-y-5 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <div className="h-7 w-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <PackagePlus className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-white tracking-wide">Add Inventory Keys</h2>
            </div>

            {/* PRODUCT SELECT BOX (FIXED WHITE BACKGROUND) */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 block">Select Product</label>
              <div className="relative">
                <select
                  value={selectedProduct?.name || ""}
                  onChange={(e) => {
                    const found = allProducts.find((item) => item.name === e.target.value);
                    setSelectedProduct(found || null);
                    setSelectedDuration("");
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-3.5 pr-9 text-xs text-slate-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer"
                >
                  <option value="" className="bg-slate-900 text-slate-300">
                    Choose product…
                  </option>
                  {allProducts.map((product) => (
                    <option
                      key={product.id || product.name}
                      value={product.name}
                      className="bg-slate-900 text-slate-100 py-1"
                    >
                      {product.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
            </div>

            {/* DURATION SELECT BOX (FIXED WHITE BACKGROUND) */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 block">Select Duration</label>
              <div className="relative">
                <select
                  value={selectedDuration}
                  onChange={(e) => setSelectedDuration(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-3.5 pr-9 text-xs text-slate-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer disabled:bg-slate-950/40 disabled:text-slate-600 disabled:cursor-not-allowed"
                  disabled={!selectedProduct}
                >
                  <option value="" className="bg-slate-900 text-slate-300">
                    Choose duration…
                  </option>
                  {selectedProduct?.prices?.map((price: any) => (
                    <option
                      key={price.duration}
                      value={price.duration}
                      className="bg-slate-900 text-slate-100 py-1"
                    >
                      {price.duration}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
            </div>

            <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl px-4 py-3 flex items-center justify-between text-xs font-medium">
              <span className="text-slate-400">Unused keys for selection</span>
              <span className="font-bold text-indigo-400 text-sm tabular-nums">{availableStock}</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 block">
                License Keys (One per line)
              </label>
              <textarea
                placeholder="Paste license keys here..."
                value={newKeys}
                onChange={(e) => setNewKeys(e.target.value)}
                className="w-full h-36 bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-xs font-mono text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none custom-scrollbar"
              />
            </div>

            <button
              onClick={handleAddStock}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-3 rounded-xl transition-all duration-200 shadow-md shadow-indigo-600/20 cursor-pointer active:scale-98"
            >
              Add Keys To Stock
            </button>
          </div>

          {/* DYNAMIC VIEW PANEL */}
          <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800/80 rounded-2xl p-6 flex flex-col h-[525px] shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab("purchases")}
                  className={`flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all duration-200 cursor-pointer ${
                    activeTab === "purchases"
                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm shadow-amber-500/10"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <History className="h-3.5 w-3.5" />
                  Purchase Logs ({purchases.length})
                </button>
                <button
                  onClick={() => setActiveTab("stock")}
                  className={`flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all duration-200 cursor-pointer ${
                    activeTab === "stock"
                      ? "bg-blue-500/15 text-blue-400 border border-blue-500/30 shadow-sm shadow-blue-500/10"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <Boxes className="h-3.5 w-3.5" />
                  Stock Keys ({keys.length})
                </button>
              </div>

              {activeTab && (
                <button
                  onClick={() => setActiveTab(null)}
                  className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800/80 transition-colors"
                  title="Close current view"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
              {!activeTab ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                  <KeyRound className="h-10 w-10 text-slate-700 animate-bounce" />
                  <p className="text-sm font-semibold text-slate-400">No View Selected</p>
                  <p className="text-xs text-slate-500 max-w-xs">
                    Click <strong>Stock Keys</strong> or <strong>Purchase Logs</strong> above to display the detailed list.
                  </p>
                </div>
              ) : activeTab === "purchases" ? (
                purchases.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-slate-500">
                    No purchases recorded
                  </div>
                ) : (
                  purchases.map((purchase, index) => (
                    <div
                      key={purchase.id || `purchase-${index}`}
                      className="bg-slate-950/60 border border-slate-800/90 hover:border-slate-700 rounded-xl p-4 space-y-2.5 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-semibold text-white text-xs truncate">
                            {purchase.product_name}
                          </h4>
                          <p className="text-slate-400 text-[11px] mt-0.5">{purchase.duration}</p>
                        </div>
                        <span className="text-amber-400 bg-amber-500/10 border border-amber-500/20 text-[11px] font-semibold px-2.5 py-0.5 rounded-md truncate max-w-[130px]">
                          @{purchase.username}
                        </span>
                      </div>
                      <div className="bg-slate-900 border border-slate-800/80 rounded-lg px-3 py-2 font-mono text-slate-300 text-xs break-all select-all">
                        {purchase.key_code}
                      </div>
                    </div>
                  ))
                )
              ) : keys.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-500">
                  No keys in stock
                </div>
              ) : (
                keys.map((key, index) => (
                  <div
                    key={key.id || `key-${index}`}
                    className="bg-slate-950/60 border border-slate-800/90 hover:border-slate-700 rounded-xl p-4 space-y-2.5 transition-all duration-200 group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-white text-xs truncate">
                          {key.product_name}
                        </h4>
                        <p className="text-slate-400 text-[11px] mt-0.5">{key.duration}</p>
                      </div>
                      <button
                        onClick={() => deleteStock(key.id)}
                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors shrink-0 cursor-pointer"
                        title="Delete Stock Key"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="bg-slate-900 border border-slate-800/80 rounded-lg px-3 py-2 font-mono text-slate-300 text-xs break-all select-all">
                      {key.key_code}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* USER MANAGEMENT SECTION */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-6 space-y-5 shadow-xl backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide">User Management</h2>
                <p className="text-xs text-slate-500">
                  Showing {filteredUsers.length} of {users.length} registered accounts
                </p>
              </div>
            </div>

            {/* LIVE USER SEARCH BAR */}
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search username, email, phone..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-8 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
              />
              {userSearchQuery && (
                <button
                  onClick={() => setUserSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5 rounded-md"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs text-slate-200">
              <thead>
                <tr className="border-b border-slate-800/80 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Wallet Balance</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No matching users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u, index) => (
                    /* FIXED UNIQUE KEY ISSUE HERE */
                    <tr
                      key={u.id ? `${u.id}-${index}` : `${u.username}-${index}`}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-semibold text-white">@{u.username}</td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {u.mobile_number || u.phone || "—"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">{u.email}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                            u.role === "admin"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              : u.role === "reseller"
                              ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                              : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                          }`}
                        >
                          {u.role || "user"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold tabular-nums text-emerald-400">
                        ₹{(u.wallet_balance || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenManageModal(u)}
                          className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer shadow-sm active:scale-95"
                        >
                          <Settings className="h-3.5 w-3.5" />
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* MANAGE USER MODAL */}
      {isManageModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Manage Account (@{selectedUser.username})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedUser.email}</p>
              </div>
              <button
                onClick={() => setIsManageModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 block">User Access Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-100 outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="user" className="bg-slate-900 text-slate-100">User</option>
                  <option value="reseller" className="bg-slate-900 text-slate-100">Reseller</option>
                  <option value="admin" className="bg-slate-900 text-slate-100">Admin</option>
                </select>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Current Balance</span>
                <span className="text-sm font-bold text-emerald-400 tabular-nums">
                  ₹{(selectedUser.wallet_balance || 0).toFixed(2)}
                </span>
              </div>

              <div className="space-y-2.5">
                <label className="text-xs font-medium text-slate-400 block">
                  Wallet Adjustment
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBalanceAction("none")}
                    className={`py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                      balanceAction === "none"
                        ? "bg-slate-800 text-white border-slate-700"
                        : "bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/40"
                    }`}
                  >
                    No Action
                  </button>
                  <button
                    type="button"
                    onClick={() => setBalanceAction("add")}
                    className={`flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                      balanceAction === "add"
                        ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/40"
                        : "bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/40"
                    }`}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setBalanceAction("remove")}
                    className={`flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                      balanceAction === "remove"
                        ? "bg-rose-600/20 text-rose-400 border-rose-500/40"
                        : "bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/40"
                    }`}
                  >
                    <Minus className="h-3.5 w-3.5" /> Deduct
                  </button>
                </div>

                {balanceAction !== "none" && (
                  <div className="pt-1">
                    <input
                      type="number"
                      placeholder="Enter amount (e.g. 500)"
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-100 outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                disabled={isSavingUser}
                onClick={() => setIsManageModalOpen(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isSavingUser}
                onClick={handleSaveUserChanges}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20"
              >
                {isSavingUser && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1E293B;
          border-radius: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
      `,
        }}
      />
    </div>
  );
}