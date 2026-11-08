"use client";

import { createContext, useContext } from "react";

import { OWNER_BRAND, type Brand } from "@/lib/brand";

const Ctx = createContext<Brand>(OWNER_BRAND);

export function BrandProvider({ brand, children }: { brand: Brand; children: React.ReactNode }) {
  return <Ctx.Provider value={brand}>{children}</Ctx.Provider>;
}

export const useBrand = () => useContext(Ctx);
