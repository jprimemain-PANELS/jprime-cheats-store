"use client";

import { useState } from "react";
import { BookOpen, ExternalLink, Film, ImageIcon, CreditCard, ChevronDown } from "lucide-react";

type Guide = {
  id: string; icon: any; title: string; intro: string; link: string; linkLabel: string;
  steps: string[]; paste: string[]; tip?: string;
};

const GUIDES: Guide[] = [
  {
    id: "video", icon: Film, title: "1. Video link (for your product video)",
    intro: "Upload your video to Cloudinary (free). Then copy the video link and paste it in your product.",
    link: "https://console.cloudinary.com/", linkLabel: "Open Cloudinary",
    steps: [
      "Click the button above to open Cloudinary. Sign up (free) with your Google account, or log in if you have one.",
      "Cloudinary asks a few questions when you sign up. Choose anything (for example 'Developer' or 'Other'), then continue.",
      "On the left menu click Assets (also called Media Library).",
      "Click the Upload button (top right). Choose your video file from your phone or computer. Wait until it shows 100%.",
      "Click on your uploaded video to open it.",
      "Find the link (URL) on the right side. It starts with https://res.cloudinary.com/ . Click the copy button next to it.",
      "Come back here, and go to the Products tab. Open your product with Edit.",
      "Paste the link in the Video box. Press Save Product. Done.",
    ],
    paste: ["Products tab → Edit product → Video box"],
    tip: "Use a video under 100 MB so it opens fast for your customers. The link must start with https://",
  },
  {
    id: "image", icon: ImageIcon, title: "2. Image link (logo, banner, login picture)",
    intro: "Upload your picture to image2url. You do not need to sign up. It gives you a link you can paste in your store.",
    link: "https://www.image2url.com/", linkLabel: "Open image2url",
    steps: [
      "Click the button above to open image2url.",
      "Find the box 'Upload Your Image'. Click it and choose your picture, or drag the picture into the box. (JPG, PNG or GIF, up to 2 MB.)",
      "Click the Convert button.",
      "Wait for the link to appear, then copy it. It starts with https://",
      "Come back here and paste the link where you need it (see the list below). Press Save.",
    ],
    paste: [
      "Branding tab → Logo image link",
      "Branding tab → Banner picture link",
      "Branding tab → Login page character picture / pet picture (use a PNG with a transparent background)",
    ],
    tip: "Use a PNG with a transparent background for the login character and pet, so it looks clean.",
  },
  {
    id: "pay", icon: CreditCard, title: "3. Payment gateway (so customers can pay you)",
    intro: "Create a free account on the Gram UPI gateway. You connect your own UPI app, copy your API key, and paste it in your Payments tab. Customer money then goes to YOUR account.",
    link: "https://gateway.anujbots.in/", linkLabel: "Open the payment gateway",
    steps: [
      "Click the button above to open the gateway site.",
      "Choose Create account. Enter your name, your website (your store link), and your Gmail address. Only Gmail works.",
      "Choose a password and click 'Send code to Gmail'. Open your Gmail, copy the 6-digit code, paste it, and click 'Verify & create account'.",
      "Sign in. On the left, open Connect Apps.",
      "Connect your UPI app (for example FamPay, Paytm, BharatPe, Kotak, Slice or HDFC) by following the screen.",
      "After connecting, copy your API key from the page.",
      "Come back here and open the Payments tab.",
      "If you connected FamPay, use the card 'ANUJ (FamPay)'. If you connected Paytm, use 'PAYTM (ANUJ)'. Leave the two URL boxes as they are.",
      "Paste your API key in the 'API key' box and press Save.",
      "Press 'Use this' on that card so new payments use it. Then test with a small order.",
    ],
    paste: ["Payments tab → ANUJ (FamPay) or PAYTM (ANUJ) card → API key box"],
    tip: "Never share your API key with anyone. If you think someone saw it, create a new key on the gateway site and paste the new one here.",
  },
];

export default function SetupGuide() {
  const [open, setOpen] = useState<string | null>("video");
  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-indigo-400" /><h2 className="text-lg font-bold text-white">Setup Guide</h2></div>
      <p className="text-sm text-slate-400">Follow these easy steps. Click the button, finish the steps on that website, then come back and paste the link here.</p>
      {GUIDES.map((g) => {
        const Icon = g.icon; const isOpen = open === g.id;
        return (
          <div key={g.id} className="rounded-2xl border border-slate-800 bg-slate-900/60">
            <button onClick={() => setOpen(isOpen ? null : g.id)} className="w-full flex items-center gap-3 p-4 text-left cursor-pointer">
              <Icon className="h-5 w-5 text-indigo-300 shrink-0" />
              <span className="flex-1 text-sm font-semibold text-white">{g.title}</span>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <div className="px-4 pb-5 space-y-4">
                <p className="text-sm text-slate-300">{g.intro}</p>
                <a href={g.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-sm font-bold text-white">
                  {g.linkLabel}<ExternalLink className="h-4 w-4" />
                </a>
                <ol className="space-y-2.5">
                  {g.steps.map((s, i) => (
                    <li key={i} className="flex gap-3 text-sm text-slate-200">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-200">{i + 1}</span>
                      <span className="pt-0.5">{s}</span>
                    </li>
                  ))}
                </ol>
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                  <p className="text-xs font-semibold text-emerald-300 mb-1">Where to paste it</p>
                  <ul className="list-disc pl-5 space-y-0.5 text-xs text-slate-300">{g.paste.map((p) => <li key={p}>{p}</li>)}</ul>
                </div>
                {g.tip && <p className="text-xs text-amber-300">Tip: {g.tip}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
