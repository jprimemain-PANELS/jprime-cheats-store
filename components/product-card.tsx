"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Play,
  ShoppingCart,
  Bell,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { supabase } from "@/lib/supabase";

import type {
  Product,
  PriceTier,
} from "@/lib/products";

interface ProductCardProps {
  product: Product;
  index: number;
}

export function ProductCard({
  product,
  index,
}: ProductCardProps) {

  const [selectedPrice,
  setSelectedPrice] =
    useState<PriceTier>(
      product.prices[0]
    );

  const [isHovered,
  setIsHovered] =
    useState(false);

  const [availableStock,
  setAvailableStock] =
    useState<number | null>(
      null
    );

  useEffect(() => {

    loadStock();

  }, [selectedPrice]);

  async function loadStock() {

    const { data } =
      await supabase
        .from("stock_keys")
        .select("*")
        .eq(
          "product_name",
          product.name
        )
        .eq(
          "duration",
          selectedPrice.duration
        )
        .eq(
          "is_used",
          false
        );

    if (data) {

      setAvailableStock(
        data.length
      );
    }
  }

  return (
    <Card
      className="group relative overflow-hidden border border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-500 hover:border-primary/30 hover:shadow-[0_0_40px_rgba(0,200,255,0.08)]"
      style={{
        animationDelay:
          `${index * 100}ms`,
      }}
      onMouseEnter={() =>
        setIsHovered(true)
      }
      onMouseLeave={() =>
        setIsHovered(false)
      }
    >

<div className="relative aspect-video overflow-hidden bg-secondary/50">

{product.videoUrl ? (

  <video
    controls
    className="w-full h-full object-cover"
  >
    <source
      src={product.videoUrl}
      type="video/mp4"
    />
  </video>

) : (

  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">

    <div
      className={`flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 border border-primary/30 transition-all duration-300 ${
        isHovered
          ? "scale-110 bg-primary/30"
          : ""
      }`}
    >

      <Play className="h-6 w-6 text-primary ml-1" />

    </div>

    <span className="text-xs text-muted-foreground">
      Demo Video
    </span>

  </div>

)}

</div>

      <div className="p-5 space-y-5">

        <div>

          <h3 className="text-lg font-semibold text-foreground tracking-tight leading-tight">
            {product.name}
          </h3>

          <Badge
            variant="secondary"
            className="mt-2 text-xs bg-secondary/80 text-muted-foreground border-0"
          >
            {product.category.toUpperCase()}
          </Badge>

        </div>

        <div className="space-y-2">

          {product.features.map(
            (feature, i) => (

            <div
              key={i}
              className="flex items-center gap-2"
            >

              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10">

                <Check className="h-2.5 w-2.5 text-primary" />

              </div>

              <span className="text-sm text-muted-foreground">
                {feature}
              </span>

            </div>
          ))}

        </div>

        <div className="space-y-2">

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Select Duration
          </p>

          <div className="grid grid-cols-2 gap-2">

            {product.prices.map(
              (price, i) => (

              <button
                key={i}
                onClick={() =>
                  setSelectedPrice(
                    price
                  )
                }
                className={`flex flex-col items-start p-3 rounded-lg border transition-all duration-200 ${
                  selectedPrice.duration ===
                  price.duration
                    ? "border-primary/50 bg-primary/10"
                    : "border-border/50 bg-secondary/30 hover:border-border hover:bg-secondary/50"
                }`}
              >

                <span className="text-xs text-muted-foreground">
                  {price.duration}
                </span>

                <div className="flex items-baseline gap-1.5 mt-0.5">

                  <span className="text-sm font-semibold text-foreground">
                    {price.priceINR}
                  </span>

                </div>

              </button>
            ))}

          </div>

        </div>

        <div className="bg-secondary/30 rounded-lg p-3 text-sm">

          Available Stock:
          {" "}
          <span className="font-bold text-primary">
            {availableStock === null
              ? "Loading..."
              : availableStock}
          </span>

        </div>

        <div className="flex gap-2 pt-2">

          <Button
            disabled={
              availableStock === 0
            }
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 disabled:opacity-50"
            onClick={async () => {

              if (
                availableStock === 0
              ) {
                return;
              }

              const response =
                await fetch(
                  "/api/create-order",
                  {
                    method: "POST",

                    headers: {
                      "Content-Type":
                        "application/json",
                    },

                    body: JSON.stringify({

                      product:
                        product.name,

                      duration:
                        selectedPrice.duration,

                      price:
                        selectedPrice.priceINR.replace(
                          "₹",
                          ""
                        ),
                    }),
                  }
                );

              const result =
                await response.json();

              const sessionId =
                result.data
                  .payment_session_id;

              const script =
                document.createElement(
                  "script"
                );

              script.src =
                "https://sdk.cashfree.com/js/v3/cashfree.js";

              script.onload = () => {

                // @ts-ignore
                const cashfree =
                  window.Cashfree({
                    mode:
                      "sandbox",
                  });

                cashfree.checkout({
                  paymentSessionId:
                    sessionId,

                  redirectTarget:
                    "_self",
                });
              };

              document.body.appendChild(
                script
              );
            }}
          >

            <ShoppingCart className="h-4 w-4 mr-2" />

            {availableStock === 0
              ? "OUT OF STOCK"
              : "BUY"}

          </Button>

          <Button
            variant="outline"
            className="flex-1 border-border/50 text-foreground hover:bg-secondary hover:border-border transition-all duration-300"
            onClick={() =>
              window.open(
                product.updateChannel,
                "_blank"
              )
            }
          >

            <Bell className="h-4 w-4 mr-2" />

            UPDATES

          </Button>

        </div>

      </div>

    </Card>
  );
}