"use client";

import { Apple, MessageCircle, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ComingSoon() {
  return (
    <Card className="relative overflow-hidden border border-border/50 bg-card/50 backdrop-blur-sm p-8 md:p-12">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/5 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-lg mx-auto">
        {/* Icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 mb-6">
          <Apple className="h-10 w-10 text-primary" />
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50 border border-border/50 mb-4">
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="text-xs text-muted-foreground">Coming Soon</span>
        </div>

        {/* Title */}
        <h3 className="text-2xl font-semibold text-foreground mb-3">
          iOS Panel
        </h3>

        {/* Description */}
        <p className="text-muted-foreground mb-8">
          Premium iOS solutions are currently in development. Contact us for customized private panels.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => window.open("https://t.me/JPRIMEADMIN", "_blank")}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Contact for Custom iOS
          </Button>
          <Button
            variant="outline"
            className="border-border/50 text-foreground hover:bg-secondary"
            onClick={() => window.open("https://t.me/JPRIMEADMIN", "_blank")}
          >
            Custom PC Panel
          </Button>
        </div>
      </div>
    </Card>
  );
}
