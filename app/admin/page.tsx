"use client";

import { useEffect, useState, useMemo } from "react";
import type { ReactNode } from "react";
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
  Calendar,
  Tag,
  DollarSign,
  LayoutDashboard,
  LayoutGrid,
  AlertTriangle,
  Info,
} from "lucide-react";

import { allProducts } from "@/lib/products";
import type { Product, PriceTier } from "@/lib/products";

interface ManagedUser {
  id?: string | number;
  username: string;
  email: string;
  mobile_number?: string;
  phone?: string;
  role: string;
  wallet_balance?: number;
}

type PriceOverride = { priceINR: number; resellerPrice?: number };
type Tab = "overview" | "inventory" | "pricing" | "purchases" | "users";

// ---------- helpers ----------

function parsePriceNumber(value?: string | number | null): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  return parseFloat(cleaned) || 0;
}

function resolvePrice(
  overrides: Record<string, PriceOverride>,
  productName: string,
  duration: string,
  baseTier?: { priceINR?: string; resellerPrice?: string }
) {
  const override = overrides[`${productName}::${duration}`];
  return {
    priceINR: override?.priceINR ?? parsePriceNumber(baseTier?.priceINR),
    resellerPrice: override?.resellerPrice ?? parsePriceNumber(baseTier?.resellerPrice),
  };
}

// Turns a raw Supabase/Postgres error into something an admin can actually act on.
function friendlyDbError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("column") && lower.includes("schema cache")) {
    return `${raw}

Your Supabase "product_prices" table doesn't have the columns this page expects (price_inr, reseller_price). Run this in the Supabase SQL editor, then try saving again:

alter table public.product_prices add column if not exists price_inr numeric not null default 0;
alter table public.product_prices add column if not exists reseller_price numeric;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'product_prices_product_duration_key') then
    alter table public.product_prices add constraint product_prices_product_duration_key unique (product_name, duration);
  end if;
end $$;`;
  }
  return raw;
}

// ---------- small reusable UI pieces ----------

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: any;
  label: string;
  value: ReactNode;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: any;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
            <Icon className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-bold text-white tracking-wide">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// Small stock "box" used in the redesigned Stock Matrix — one glanceable tile per duration.
function StockBox({ duration, count }: { duration: string; count: number }) {
  const tone =
    count === 0
      ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
      : count <= 3
      ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
      : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";

  return (
    <div className={`rounded-lg border px-3 py-2.5 flex flex-col items-center justify-center gap-1 text-center ${tone}`}>
      <span className="text-sm font-bold tabular-nums">{count}</span>
      <span className="text-[10px] font-medium text-slate-400 leading-tight">{duration}</span>
    </div>
  );
}

// ---------- main page ----------

export default function AdminPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Add-stock state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedDuration, setSelectedDuration] = useState("");
  const [availableStock, setAvailableStock] = useState(0);
  const [newKeys, setNewKeys] = useState("");

  // Pricing state
  const [priceOverrides, setPriceOverrides] = useState<Record<string, PriceOverride>>({});
  const [priceProduct, setPriceProduct] = useState<Product | null>(null);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, { priceINR: string; resellerPrice: string }>>({});
  const [isSavingPrices, setIsSavingPrices] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [priceSavedAt, setPriceSavedAt] = useState<number | null>(null);

  // Purchases tab filter
  const [purchaseFilter, setPurchaseFilter] = useState<"all" | "today">("all");

  // User search + modal state
  const [userSearchQuery, setUserSearchQuery] = useState("");
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
    const { data: stockData } = await supabase
      .from("stock_keys")
      .select("*")
      .eq("is_used", false);

    const { data: usersData } = await supabase.from("users").select("*");

    const { data: walletsData } = await supabase
      .from("wallets")
      .select("username, balance");

    const walletMap = new Map(walletsData?.map((w) => [w.username, w.balance]) || []);

    const enrichedUsers: ManagedUser[] = (usersData || []).map((u: any) => ({
      ...u,
      wallet_balance: walletMap.get(u.username) ?? 0,
    }));

    const { data: purchaseData } = await supabase
      .from("purchase_history")
      .select("*")
      .order("id", { ascending: false });

    // Price overrides — table is new, empty is fine, everything falls back to products.ts
    const { data: priceRows, error: priceRowsError } = await supabase.from("product_prices").select("*");
    if (priceRowsError) {
      console.error("Failed to load price overrides:", priceRowsError.message);
    }
    const overrideMap: Record<string, PriceOverride> = {};
    (priceRows || []).forEach((row: any) => {
      overrideMap[`${row.product_name}::${row.duration}`] = {
        priceINR: Number(row.price_inr),
        resellerPrice: row.reseller_price != null ? Number(row.reseller_price) : undefined,
      };
    });

    setKeys(stockData || []);
    setUsers(enrichedUsers);
    setPurchases(purchaseData || []);
    setPriceOverrides(overrideMap);
    return overrideMap;
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

    const { error } = await supabase.from("stock_keys").delete().eq("id", id);

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

  // ---- pricing ----

  function buildDraftsFromOverrides(product: Product, overrides: Record<string, PriceOverride>) {
    const drafts: Record<string, { priceINR: string; resellerPrice: string }> = {};
    product.prices.forEach((tier) => {
      const resolved = resolvePrice(overrides, product.name, tier.duration, tier);
      drafts[tier.duration] = {
        priceINR: String(resolved.priceINR),
        resellerPrice: String(resolved.resellerPrice),
      };
    });
    return drafts;
  }

  function handleSelectPriceProduct(name: string) {
    setPriceError(null);
    setPriceSavedAt(null);
    const found = allProducts.find((p) => p.name === name) || null;
    setPriceProduct(found);
    if (!found) {
      setPriceDrafts({});
      return;
    }
    // Always build the drafts from the latest known overrides, so the currently
    // saved price (not just the hard-coded base price) shows up immediately.
    setPriceDrafts(buildDraftsFromOverrides(found, priceOverrides));
  }

  async function handleSavePrices() {
    if (!priceProduct) return;
    setIsSavingPrices(true);
    setPriceError(null);
    setPriceSavedAt(null);

    try {
      const rows = Object.entries(priceDrafts)
        .map(([duration, draft]) => ({
          product_name: priceProduct.name,
          duration,
          price_inr: parseFloat(draft.priceINR),
          reseller_price: draft.resellerPrice ? parseFloat(draft.resellerPrice) : null,
        }))
        .filter((r) => !isNaN(r.price_inr));

      const { error } = await supabase
        .from("product_prices")
        .upsert(rows, { onConflict: "product_name,duration" });

      if (error) throw error;

      // Re-pull from the DB so what's on screen always matches what's actually saved,
      // instead of trusting local state alone.
      const freshOverrides = await loadDashboard();
      setPriceDrafts(buildDraftsFromOverrides(priceProduct, freshOverrides));
      setPriceSavedAt(Date.now());
    } catch (err: any) {
      setPriceError(friendlyDbError(err?.message || "Failed to update prices."));
    } finally {
      setIsSavingPrices(false);
    }
  }

  // ---- derived data ----

  const stockMatrix = useMemo(() => {
    return allProducts.map((product) => ({
      id: product.id,
      name: product.name,
      rows: product.prices.map((tier) => ({
        duration: tier.duration,
        count: keys.filter(
          (k) => k.product_name === product.name && k.duration === tier.duration
        ).length,
      })),
    }));
  }, [keys]);

  const lowStockAlerts = useMemo(() => {
    const threshold = 3;
    const list: { product: string; duration: string; count: number }[] = [];
    stockMatrix.forEach((p) =>
      p.rows.forEach((r) => {
        if (r.count <= threshold) list.push({ product: p.name, duration: r.duration, count: r.count });
      })
    );
    return list.sort((a, b) => a.count - b.count).slice(0, 8);
  }, [stockMatrix]);

  const todayPurchases = useMemo(() => {
    const todayStr = new Date().toDateString();
    return purchases.filter(
      (p) => p.created_at && new Date(p.created_at).toDateString() === todayStr
    );
  }, [purchases]);

  const todayRevenue = useMemo(() => {
    return todayPurchases.reduce((sum, p) => {
      const product = allProducts.find((x) => x.name === p.product_name);
      const tier = product?.prices.find((t) => t.duration === p.duration);
      const resolved = resolvePrice(priceOverrides, p.product_name, p.duration, tier);
      return sum + resolved.priceINR;
    }, 0);
  }, [todayPurchases, priceOverrides]);

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

  const TABS: { id: Tab; label: string; icon: any; count?: number }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "inventory", label: "Inventory", icon: Boxes, count: keys.length },
    { id: "pricing", label: "Pricing", icon: Tag },
    { id: "purchases", label: "Purchases", icon: History, count: purchases.length },
    { id: "users", label: "Users", icon: Users, count: users.length },
  ];

  return (
    <div className="min-h-screen bg-[#0A0E14] text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* HEADER + TABS (sticky together) */}
      <div className="sticky top-0 z-50">
        <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white tracking-tight">JPrimeCheats</h1>
                <p className="text-xs text-slate-400 font-medium">Admin Control Panel</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-xs text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 rounded-full">
                <Activity className="h-3.5 w-3.5" />
                <span className="font-medium">System Live</span>
              </div>
              <button
                onClick={handleExitAdminConsole}
                className="flex items-center gap-2 bg-slate-800 hover:bg-rose-600/20 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 text-slate-300 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Exit Console</span>
              </button>
            </div>
          </div>
        </header>

        <nav className="border-b border-slate-800 bg-[#0A0E14]/95 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                    active ? "border-indigo-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {tab.count !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        active ? "bg-indigo-500/20 text-indigo-300" : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Package} label="Available Stock" value={keys.length} accent="bg-blue-500/10 text-blue-400" sub="Unused keys across all products" />
              <StatCard icon={Users} label="Registered Users" value={users.length} accent="bg-violet-500/10 text-violet-400" sub="Managed active accounts" />
              <StatCard icon={ShoppingCart} label="Total Purchases" value={purchases.length} accent="bg-amber-500/10 text-amber-400" sub="All-time completed orders" />
              <StatCard icon={Calendar} label="Today's Sales" value={todayPurchases.length} accent="bg-emerald-500/10 text-emerald-400" sub={`₹${todayRevenue.toFixed(2)} revenue today`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard icon={AlertTriangle} title="Low Stock Alerts">
                {lowStockAlerts.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">All products are well stocked.</p>
                ) : (
                  <div className="space-y-2">
                    {lowStockAlerts.map((item) => (
                      <div key={`${item.product}-${item.duration}`} className="flex items-center justify-between bg-slate-950/50 border border-slate-800 rounded-lg px-3.5 py-2.5">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{item.product}</p>
                          <p className="text-[11px] text-slate-500">{item.duration}</p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${item.count === 0 ? "bg-rose-500/10 text-rose-400" : "bg-amber-500/10 text-amber-400"}`}>
                          {item.count} left
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard icon={History} title="Recent Purchases">
                {purchases.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No purchases recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {purchases.slice(0, 6).map((p, i) => (
                      <div key={p.id || i} className="flex items-center justify-between bg-slate-950/50 border border-slate-800 rounded-lg px-3.5 py-2.5">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{p.product_name}</p>
                          <p className="text-[11px] text-slate-500">{p.duration}</p>
                        </div>
                        <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                          @{p.username}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          </div>
        )}

        {/* INVENTORY */}
        {activeTab === "inventory" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5">
                <SectionCard icon={PackagePlus} title="Add Inventory Keys">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-400 block">Select Product</label>
                      <div className="relative">
                        <select
                          value={selectedProduct?.name || ""}
                          onChange={(e) => {
                            const found = allProducts.find((p) => p.name === e.target.value) || null;
                            setSelectedProduct(found);
                            setSelectedDuration("");
                          }}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-3.5 pr-9 text-xs text-slate-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer"
                        >
                          <option value="">Choose product…</option>
                          {allProducts.map((p) => (
                            <option key={p.id} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-400 block">Select Duration</label>
                      <div className="relative">
                        <select
                          value={selectedDuration}
                          onChange={(e) => setSelectedDuration(e.target.value)}
                          disabled={!selectedProduct}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-3.5 pr-9 text-xs text-slate-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer disabled:bg-slate-950/40 disabled:text-slate-600 disabled:cursor-not-allowed"
                        >
                          <option value="">Choose duration…</option>
                          {selectedProduct?.prices.map((tier: PriceTier) => (
                            <option key={tier.duration} value={tier.duration}>{tier.duration}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      </div>
                    </div>

                    <div className="bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between text-xs font-medium">
                      <span className="text-slate-400">Unused keys for selection</span>
                      <span className="font-bold text-indigo-400 text-sm tabular-nums">{availableStock}</span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-400 block">License Keys (One per line)</label>
                      <textarea
                        placeholder="Paste license keys here..."
                        value={newKeys}
                        onChange={(e) => setNewKeys(e.target.value)}
                        className="w-full h-32 bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-xs font-mono text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none custom-scrollbar"
                      />
                    </div>

                    <button
                      onClick={handleAddStock}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-3 rounded-xl transition-all shadow-md shadow-indigo-600/20 cursor-pointer active:scale-98"
                    >
                      Add Keys To Stock
                    </button>
                  </div>
                </SectionCard>
              </div>

              <div className="lg:col-span-7">
                <SectionCard icon={LayoutGrid} title="Stock Matrix — All Products & Durations">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto custom-scrollbar pr-1">
                    {stockMatrix.map((product) => (
                      <div key={product.id} className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                        <p className="text-xs font-bold text-white truncate">{product.name}</p>
                        <div className="grid grid-cols-3 gap-2">
                          {product.rows.map((row) => (
                            <StockBox key={row.duration} duration={row.duration} count={row.count} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>
            </div>

            <SectionCard icon={KeyRound} title={`Stock Keys (${keys.length})`}>
              <div className="max-h-[420px] overflow-y-auto custom-scrollbar space-y-2.5">
                {keys.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No keys in stock.</p>
                ) : (
                  keys.map((key, index) => (
                    <div key={key.id || index} className="flex items-center justify-between gap-3 bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white truncate">{key.product_name}</p>
                        <p className="text-[11px] text-slate-500">{key.duration}</p>
                        <p className="text-[11px] text-slate-400 font-mono mt-1 truncate">{key.key_code}</p>
                      </div>
                      <button
                        onClick={() => deleteStock(key.id)}
                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors shrink-0 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </SectionCard>
          </div>
        )}

        {/* PRICING */}
        {activeTab === "pricing" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4">
              <SectionCard icon={Tag} title="Select Product">
                <div className="relative">
                  <select
                    value={priceProduct?.name || ""}
                    onChange={(e) => handleSelectPriceProduct(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-3.5 pr-9 text-xs text-slate-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Choose product…</option>
                    {allProducts.map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
                <p className="text-[11px] text-slate-500 mt-3">
                  These prices are saved to the database. Your storefront checkout needs to read from the same table for customers to see the new price.
                </p>
                <div className="mt-3 flex items-start gap-2 bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2.5">
                  <Info className="h-3.5 w-3.5 text-slate-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Fields below always load the currently saved price for each duration, not just the code default. If you don't see your last edit, saving likely failed — check the error banner on the right.
                  </p>
                </div>
              </SectionCard>
            </div>

            <div className="lg:col-span-8">
              <SectionCard
                icon={DollarSign}
                title={priceProduct ? `Edit Prices — ${priceProduct.name}` : "Edit Prices"}
                action={
                  priceProduct && (
                    <button
                      onClick={handleSavePrices}
                      disabled={isSavingPrices}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
                    >
                      {isSavingPrices && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Save Changes
                    </button>
                  )
                }
              >
                {!priceProduct ? (
                  <p className="text-xs text-slate-500 py-8 text-center">Select a product on the left to edit its prices.</p>
                ) : (
                  <div className="space-y-3">
                    {priceError && (
                      <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3.5 py-3">
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-400 mt-0.5 shrink-0" />
                        <pre className="text-[11px] text-rose-300 whitespace-pre-wrap font-sans leading-relaxed">{priceError}</pre>
                      </div>
                    )}
                    {priceSavedAt && !priceError && (
                      <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3.5 py-2.5">
                        <span className="text-[11px] text-emerald-400 font-medium">Prices saved and reloaded from the database.</span>
                      </div>
                    )}

                    <div className="grid grid-cols-[1fr_100px_100px] gap-3 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <span>Duration</span>
                      <span className="text-right">Retail ₹</span>
                      <span className="text-right">Reseller ₹</span>
                    </div>
                    {priceProduct.prices.map((tier: PriceTier) => {
                      // What's actually live right now (saved override, or the
                      // products.ts default if nothing's been saved yet). This
                      // does NOT change as you type below — it only updates
                      // after a successful save, so you always know what
                      // customers are currently seeing.
                      const live = resolvePrice(priceOverrides, priceProduct.name, tier.duration, tier);
                      return (
                      <div key={tier.duration} className="grid grid-cols-[1fr_100px_100px] gap-3 items-center bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2.5">
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-slate-300 block">{tier.duration}</span>
                          <span className="text-[10px] text-slate-500">
                            Live now: <span className="text-emerald-400 font-semibold">₹{live.priceINR}</span>
                            {live.resellerPrice ? (
                              <> · reseller <span className="text-emerald-400 font-semibold">₹{live.resellerPrice}</span></>
                            ) : null}
                          </span>
                        </div>
                        <input
                          type="number"
                          value={priceDrafts[tier.duration]?.priceINR ?? ""}
                          onChange={(e) =>
                            setPriceDrafts((prev) => ({
                              ...prev,
                              [tier.duration]: { ...prev[tier.duration], priceINR: e.target.value },
                            }))
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2 text-xs text-slate-100 text-right outline-none focus:border-emerald-500"
                        />
                        <input
                          type="number"
                          value={priceDrafts[tier.duration]?.resellerPrice ?? ""}
                          onChange={(e) =>
                            setPriceDrafts((prev) => ({
                              ...prev,
                              [tier.duration]: { ...prev[tier.duration], resellerPrice: e.target.value },
                            }))
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2 text-xs text-slate-100 text-right outline-none focus:border-emerald-500"
                        />
                      </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            </div>
          </div>
        )}

        {/* PURCHASES */}
        {activeTab === "purchases" && (
          <SectionCard
            icon={History}
            title="Purchase Logs"
            action={
              <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                <button
                  onClick={() => setPurchaseFilter("all")}
                  className={`text-[11px] font-semibold px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                    purchaseFilter === "all" ? "bg-slate-800 text-white" : "text-slate-500"
                  }`}
                >
                  All ({purchases.length})
                </button>
                <button
                  onClick={() => setPurchaseFilter("today")}
                  className={`text-[11px] font-semibold px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                    purchaseFilter === "today" ? "bg-emerald-600 text-white" : "text-slate-500"
                  }`}
                >
                  Today ({todayPurchases.length})
                </button>
              </div>
            }
          >
            <div className="max-h-[560px] overflow-y-auto custom-scrollbar space-y-2.5">
              {(purchaseFilter === "today" ? todayPurchases : purchases).length === 0 ? (
                <p className="text-xs text-slate-500 py-8 text-center">No purchases to show.</p>
              ) : (
                (purchaseFilter === "today" ? todayPurchases : purchases).map((purchase, index) => (
                  <div key={purchase.id || index} className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-white text-xs truncate">{purchase.product_name}</h4>
                        <p className="text-slate-500 text-[11px] mt-0.5">{purchase.duration}</p>
                      </div>
                      <span className="text-amber-400 bg-amber-500/10 border border-amber-500/20 text-[11px] font-semibold px-2.5 py-0.5 rounded-md truncate max-w-[130px]">
                        @{purchase.username}
                      </span>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 font-mono text-slate-300 text-xs break-all select-all">
                      {purchase.key_code}
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        )}

        {/* USERS */}
        {activeTab === "users" && (
          <SectionCard
            icon={Users}
            title="User Management"
            action={
              <div className="relative w-full sm:w-64">
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
            }
          >
            <p className="text-xs text-slate-500">
              Showing {filteredUsers.length} of {users.length} registered accounts
            </p>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs text-slate-200">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
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
                      <td colSpan={6} className="py-8 text-center text-slate-500">No matching users found</td>
                    </tr>
                  ) : (
                    filteredUsers.map((u, index) => (
                      <tr key={u.id ? `${u.id}-${index}` : `${u.username}-${index}`} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-white">@{u.username}</td>
                        <td className="py-3.5 px-4 text-slate-400">{u.mobile_number || u.phone || "—"}</td>
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
                            className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
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
          </SectionCard>
        )}
      </main>

      {/* MANAGE USER MODAL */}
      {isManageModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">Manage Account (@{selectedUser.username})</h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedUser.email}</p>
              </div>
              <button onClick={() => setIsManageModalOpen(false)} className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
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
                  <option value="user">User</option>
                  <option value="reseller">Reseller</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Current Balance</span>
                <span className="text-sm font-bold text-emerald-400 tabular-nums">
                  ₹{(selectedUser.wallet_balance || 0).toFixed(2)}
                </span>
              </div>

              <div className="space-y-2.5">
                <label className="text-xs font-medium text-slate-400 block">Wallet Adjustment</label>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setBalanceAction("none")} className={`py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${balanceAction === "none" ? "bg-slate-800 text-white border-slate-700" : "bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/40"}`}>
                    No Action
                  </button>
                  <button type="button" onClick={() => setBalanceAction("add")} className={`flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${balanceAction === "add" ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/40" : "bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/40"}`}>
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                  <button type="button" onClick={() => setBalanceAction("remove")} className={`flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${balanceAction === "remove" ? "bg-rose-600/20 text-rose-400 border-rose-500/40" : "bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/40"}`}>
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
              <button disabled={isSavingUser} onClick={() => setIsManageModalOpen(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs py-2.5 rounded-xl transition-colors cursor-pointer">
                Cancel
              </button>
              <button disabled={isSavingUser} onClick={handleSaveUserChanges} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer">
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
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1E293B; border-radius: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
      `,
        }}
      />
    </div>
  );
}