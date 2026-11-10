"use client";

import { useEffect, useRef } from "react";

/**
 * Animated login backgrounds that follow the store's colors (CSS variables set by the branding theme).
 * Pure CSS / a tiny canvas. No image files, no network, nothing stored. Respects "reduce motion".
 */
export type LoginBgKind = "aurora" | "particles" | "beams" | "waves" | "stars";

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function cssColor(el: HTMLElement, name: string, fallback: string) {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

/** Canvas animations (particles network, star warp). */
function CanvasBg({ mode }: { mode: "particles" | "stars" }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const accent = cssColor(canvas, "--store-accent", "#c026d3");
    const primary = cssColor(canvas, "--store-primary", "#7c3aed");
    let w = 0, h = 0, raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const N = mode === "particles" ? (w < 640 ? 38 : 70) : (w < 640 ? 90 : 160);
    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * w, y: Math.random() * h, z: Math.random() * 1 + 0.2,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, r: Math.random() * 1.6 + 0.6,
    }));
    const mouse = { x: -999, y: -999 };
    const move = (e: PointerEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    window.addEventListener("pointermove", move);
    const still = reduceMotion();

    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      if (mode === "particles") {
        for (const p of pts) {
          if (!still) { p.x += p.vx; p.y += p.vy; }
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
          const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
          if (d < 110 && !still) { p.x += (dx / d) * 1.2; p.y += (dy / d) * 1.2; }
        }
        for (let i = 0; i < N; i++) {
          ctx.fillStyle = accent; ctx.globalAlpha = 0.8;
          ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, pts[i].r, 0, 6.283); ctx.fill();
          for (let j = i + 1; j < N; j++) {
            const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
            if (d < 120) { ctx.globalAlpha = (1 - d / 120) * 0.35; ctx.strokeStyle = primary; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke(); }
          }
        }
      } else {
        const cx = w / 2, cy = h / 2;
        for (const p of pts) {
          if (!still) p.z -= 0.004; if (p.z <= 0.02) { p.z = 1.2; p.x = (Math.random() - 0.5) * w; p.y = (Math.random() - 0.5) * h; }
          const sx = cx + (p.x / p.z) * 0.6, sy = cy + (p.y / p.z) * 0.6;
          const px = cx + (p.x / (p.z + 0.05)) * 0.6, py = cy + (p.y / (p.z + 0.05)) * 0.6;
          ctx.globalAlpha = Math.min(1, (1.2 - p.z)); ctx.strokeStyle = p.r > 1.5 ? accent : "#ffffff"; ctx.lineWidth = p.r * (1.3 - p.z);
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(sx, sy); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    frame();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); window.removeEventListener("pointermove", move); };
  }, [mode]);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

export function LoginBackground({ kind }: { kind: LoginBgKind }) {
  return (
    <div className="lgbg absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {kind === "aurora" && (<><i className="lgbg-blob b1" /><i className="lgbg-blob b2" /><i className="lgbg-blob b3" /></>)}
      {kind === "particles" && <CanvasBg mode="particles" />}
      {kind === "stars" && <CanvasBg mode="stars" />}
      {kind === "beams" && (<><div className="lgbg-grid" /><i className="lgbg-beam c1" /><i className="lgbg-beam c2" /><i className="lgbg-beam c3" /><i className="lgbg-beam c4" /></>)}
      {kind === "waves" && (
        <>
          {[1, 2, 3].map((n) => (
            <svg key={n} className={`lgbg-wave w${n}`} viewBox="0 0 2400 300" preserveAspectRatio="none">
              <path d="M0 150 C 200 60, 400 60, 600 150 S 1000 240, 1200 150 S 1600 60, 1800 150 S 2200 240, 2400 150 V300 H0 Z" />
            </svg>
          ))}
        </>
      )}
      <style>{`
        .lgbg-blob{position:absolute;border-radius:50%;filter:blur(90px);opacity:.55;animation:lgFloat 14s ease-in-out infinite alternate}
        .lgbg-blob.b1{width:60vmax;height:60vmax;left:-15vmax;top:-20vmax;background:var(--store-primary,#7c3aed)}
        .lgbg-blob.b2{width:50vmax;height:50vmax;right:-15vmax;top:5vmax;background:var(--store-accent,#c026d3);animation-duration:18s;animation-delay:-4s}
        .lgbg-blob.b3{width:45vmax;height:45vmax;left:20vmax;bottom:-25vmax;background:color-mix(in srgb,var(--store-primary,#7c3aed) 55%,var(--store-accent,#c026d3));animation-duration:22s;animation-delay:-8s}
        @keyframes lgFloat{0%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(6vmax,4vmax,0) scale(1.12)}100%{transform:translate3d(-4vmax,8vmax,0) scale(.95)}}
        .lgbg-grid{position:absolute;inset:0;background-image:linear-gradient(color-mix(in srgb,var(--store-accent,#c026d3) 22%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--store-accent,#c026d3) 22%,transparent) 1px,transparent 1px);background-size:56px 56px;mask-image:radial-gradient(ellipse at center,#000 30%,transparent 78%);-webkit-mask-image:radial-gradient(ellipse at center,#000 30%,transparent 78%)}
        .lgbg-beam{position:absolute;top:-40%;width:2px;height:60%;background:linear-gradient(to bottom,transparent,var(--store-accent,#c026d3),transparent);box-shadow:0 0 18px var(--store-accent,#c026d3);animation:lgBeam 6s linear infinite}
        .lgbg-beam.c1{left:14%;animation-delay:0s}.lgbg-beam.c2{left:38%;animation-delay:-2.2s;animation-duration:8s}.lgbg-beam.c3{left:63%;animation-delay:-4s;animation-duration:7s}.lgbg-beam.c4{left:86%;animation-delay:-1s;animation-duration:9s}
        @keyframes lgBeam{from{transform:translateY(0)}to{transform:translateY(300%)}}
        .lgbg-wave{position:absolute;left:0;bottom:0;width:200%;height:46%;animation:lgWave 18s linear infinite}
        .lgbg-wave.w1{fill:color-mix(in srgb,var(--store-primary,#7c3aed) 38%,transparent)}
        .lgbg-wave.w2{fill:color-mix(in srgb,var(--store-accent,#c026d3) 30%,transparent);animation-duration:26s;height:38%;animation-direction:reverse}
        .lgbg-wave.w3{fill:color-mix(in srgb,var(--store-primary,#7c3aed) 22%,transparent);animation-duration:34s;height:30%}
        @keyframes lgWave{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @media (prefers-reduced-motion:reduce){.lgbg-blob,.lgbg-beam,.lgbg-wave{animation:none}}
      `}</style>
    </div>
  );
}
