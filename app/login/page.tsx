"use client";

/* ====================================================================
 *  JPRIME STORE - LOGIN PAGE (v2)
 *
 *  1. CONFIG        asset paths, sizes, theme colors
 *  2. SHADER LAYER  WebGL helpers + <Ferrofluid /> background
 *  3. MASCOT LAYER  <KellyBackdrop /> (big, behind card) + <PetMascot />
 *  4. UI KIT        <Field />, <BrandHeader />, <SubmitButton />,
 *                   <SwitchBar />, <TutorialCard />
 *  5. AUTH LAYER    useAuthForm() hook
 *  6. PAGE          <LoginPage />
 *  7. STYLES        <LoginStyles />
 * ==================================================================== */

import { useState, useEffect, useRef, useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import { User, Lock, Phone, Mail, ArrowRight, Sparkles, UserPlus, LogIn, Play, ChevronRight } from "lucide-react";
import { Renderer, Program, Mesh, Triangle } from "ogl";

/* ------------------------------------------------------------------ */
/*  1. CONFIG                                                          */
/* ------------------------------------------------------------------ */

// IMPORTANT: put these two PNG files (transparent background) inside /public
const KELLY_IMAGE = "/kelly.png"; // yellow jacket girl
const PET_IMAGE = "/pet.png"; // red jelly pet
const TUTORIAL_URL = "https://youtu.be/F0UKQlnyXE4?si=n6qZtG91u6nddqSa";

// Change these to resize things.
const SIZES = {
  cardMaxWidth: 340, // px  - login card width (was 448)
  petWidth: 96, // px  - pet sitting on the card
};

const SHADER_COLORS = ["#c026d3", "#7c3aed", "#e879f9"];

/* ------------------------------------------------------------------ */
/*  2. SHADER LAYER                                                    */
/* ------------------------------------------------------------------ */

const MAX_COLORS = 8;

const hexToRGB = (hex: string) => {
  const c = hex.replace("#", "").padEnd(6, "0");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  return [r, g, b];
};

const prepColors = (input: string[]) => {
  const base = (input && input.length ? input : ["#c026d3", "#7c3aed", "#9333ea"]).slice(0, MAX_COLORS);
  const count = base.length;
  const arr: number[][] = [];
  for (let i = 0; i < MAX_COLORS; i++) arr.push(hexToRGB(base[Math.min(i, base.length - 1)]));
  const avg = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    avg[0] += arr[i][0];
    avg[1] += arr[i][1];
    avg[2] += arr[i][2];
  }
  avg[0] /= count;
  avg[1] /= count;
  avg[2] /= count;
  return { arr, count, avg };
};

const flowVec = (d: string) => {
  switch (d) {
    case "up":
      return [0, 1];
    case "down":
      return [0, -1];
    case "left":
      return [-1, 0];
    case "right":
      return [1, 0];
    default:
      return [0, -1];
  }
};

const vertex = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `
precision highp float;

uniform vec3  iResolution;
uniform vec2  iMouse;
uniform float iTime;

uniform vec3  uColor0;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;
uniform vec3  uColor4;
uniform vec3  uColor5;
uniform vec3  uColor6;
uniform vec3  uColor7;
uniform int   uColorCount;

uniform vec3  uMouseColor;
uniform vec2  uFlow;
uniform float uSpeed;
uniform float uScale;
uniform float uTurbulence;
uniform float uFluidity;
uniform float uRimWidth;
uniform float uSharpness;
uniform float uShimmer;
uniform float uGlow;
uniform float uOpacity;
uniform float uMouseEnabled;
uniform float uMouseStrength;
uniform float uMouseRadius;

varying vec2 vUv;

#define PI 3.14159265

vec3 palette(float h) {
  int count = uColorCount;
  if (count < 1) count = 1;
  int idx = int(floor(clamp(h, 0.0, 0.999999) * float(count)));
  if (idx <= 0) return uColor0;
  if (idx == 1) return uColor1;
  if (idx == 2) return uColor2;
  if (idx == 3) return uColor3;
  if (idx == 4) return uColor4;
  if (idx == 5) return uColor5;
  if (idx == 6) return uColor6;
  return uColor7;
}

float hash(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float smin(float a, float b, float k) {
  float r = exp2(-a / k) + exp2(-b / k);
  return -k * log2(r);
}

float sinlerp(float a, float b, float w) {
  return mix(a, b, (sin(w * PI - PI / 2.0) + 1.0) / 2.0);
}

float vn(vec2 p, float s, float seed) {
  vec2 cellp = floor(p / s);
  vec2 relp = mod(p, s);
  float g1 = hash(vec3(cellp, seed));
  float g2 = hash(vec3(cellp.x + 1.0, cellp.y, seed));
  float g3 = hash(vec3(cellp.x + 1.0, cellp.y + 1.0, seed));
  float g4 = hash(vec3(cellp.x, cellp.y + 1.0, seed));
  float bx = sinlerp(g1, g2, relp.x / s);
  float tx = sinlerp(g4, g3, relp.x / s);
  return sinlerp(bx, tx, relp.y / s);
}

float dbn(vec2 p, float s, float seed) {
  float o = s / 2.0;
  float n0 = vn(p, s, seed);
  float n1 = vn(p + vec2(o, o), s, seed + 0.1);
  float n2 = vn(p + vec2(-o, o), s, seed + 0.2);
  float n3 = vn(p + vec2(o, -o), s, seed + 0.3);
  float n4 = vn(p + vec2(-o, -o), s, seed + 0.4);
  return (2.0 * n0 + 1.5 * n1 + 1.25 * n2 + 1.125 * n3 + n4) / 7.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float ref = 700.0 / max(uScale, 0.05);
  vec2 p = fragCoord / iResolution.y * ref;

  float spd = 200.0 * uSpeed;
  float t = iTime;

  vec2 dir = uFlow;
  vec2 perp = vec2(-dir.y, dir.x);

  float distort1 = vn(p + perp * (t * spd), 60.0, 10.0) * 50.0 * uTurbulence;
  float distort2 = vn(p - perp * (t * spd), 120.0, 15.0) * 100.0 * uTurbulence;

  float peaks = dbn(p + distort1 + dir * (t * spd * 0.5), 40.0, 1.0);
  float peaks2 = dbn(p + distort2 - dir * (t * spd * 0.5), 40.0, 0.0);

  float mapeaks = smin(peaks, peaks2, max(uFluidity, 0.001));

  float mGlow = 0.0;
  if (uMouseEnabled > 0.5) {
    vec2 mp = iMouse / iResolution.y * ref;
    float md = length(p - mp) / ref;
    float rr = max(uMouseRadius, 0.02);
    mGlow = exp(-md * md / (rr * rr)) * uMouseStrength;
  }

  float band = (uRimWidth - abs((mapeaks - 0.4) * 2.0)) * 5.0;
  float ltn = clamp(band - vn(p + dir * (t * spd * 0.5), 60.0, 12.0) * uShimmer, 0.0, 1.0);
  ltn = pow(ltn, uSharpness) * uGlow;
  ltn *= clamp(1.0 - mGlow, 0.0, 1.0);

  float h = clamp(0.5 + (peaks - peaks2) * 0.8, 0.0, 1.0);
  vec3 col = palette(h);

  vec3 outc = col * ltn;
  float a = clamp(max(outc.r, max(outc.g, outc.b)), 0.0, 1.0);
  fragColor = vec4(outc, a * uOpacity);
}

void main() {
  vec4 color;
  mainImage(color, vUv * iResolution.xy);
  gl_FragColor = color;
}
`;

const Ferrofluid = ({
  className,
  dpr,
  paused = false,
  colors = ["#c026d3", "#7c3aed", "#e879f9"],
  speed = 0.5,
  scale = 1.6,
  turbulence = 1,
  fluidity = 0.1,
  rimWidth = 0.2,
  sharpness = 2.5,
  shimmer = 1.5,
  glow = 2,
  flowDirection = "down",
  opacity = 1,
  mouseInteraction = true,
  mouseStrength = 1,
  mouseRadius = 0.35,
  mouseDampening = 0.15,
  mixBlendMode,
}: any) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const programRef = useRef<any>(null);
  const meshRef = useRef<any>(null);
  const geometryRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const mouseTargetRef = useRef([0, 0]);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const getSafeDPR = () => {
      if (typeof window === "undefined") return 1;
      const baseDPR = window.devicePixelRatio || 1;
      const isMobile = window.innerWidth < 768;
      return dpr ?? (isMobile ? Math.min(baseDPR, 1.5) : baseDPR);
    };

    let renderer: any;
    try {
      renderer = new Renderer({
        dpr: getSafeDPR(),
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch (err) {
      console.warn("WebGL fallback activated:", err);
      return;
    }

    rendererRef.current = renderer;
    const gl = renderer.gl;
    const canvas = gl.canvas;
    gl.clearColor(0, 0, 0, 0);

    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const { arr, count, avg } = prepColors(colors);

    const uniforms = {
      iResolution: { value: [gl.drawingBufferWidth, gl.drawingBufferHeight, 1] },
      iMouse: { value: [0, 0] },
      iTime: { value: 0 },
      uColor0: { value: arr[0] },
      uColor1: { value: arr[1] },
      uColor2: { value: arr[2] },
      uColor3: { value: arr[3] },
      uColor4: { value: arr[4] },
      uColor5: { value: arr[5] },
      uColor6: { value: arr[6] },
      uColor7: { value: arr[7] },
      uColorCount: { value: count },
      uMouseColor: { value: avg },
      uFlow: { value: flowVec(flowDirection) },
      uSpeed: { value: speed },
      uScale: { value: scale },
      uTurbulence: { value: turbulence },
      uFluidity: { value: fluidity },
      uRimWidth: { value: rimWidth },
      uSharpness: { value: sharpness },
      uShimmer: { value: shimmer },
      uGlow: { value: glow },
      uOpacity: { value: opacity },
      uMouseEnabled: { value: mouseInteraction ? 1 : 0 },
      uMouseStrength: { value: mouseStrength },
      uMouseRadius: { value: mouseRadius },
    };

    const program = new Program(gl, { vertex, fragment, uniforms });
    programRef.current = program;

    const geometry = new Triangle(gl);
    geometryRef.current = geometry;
    const mesh = new Mesh(gl, { geometry, program });
    meshRef.current = mesh;

    const resize = () => {
      if (!container || !renderer) return;
      const rect = container.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height);
      uniforms.iResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight, 1];
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const onPointerMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleF = renderer.dpr || 1;
      const x = (e.clientX - rect.left) * scaleF;
      const y = (rect.height - (e.clientY - rect.top)) * scaleF;
      mouseTargetRef.current = [x, y];
      if (mouseDampening <= 0) {
        uniforms.iMouse.value = [x, y];
      }
    };
    if (mouseInteraction) {
      canvas.addEventListener("pointermove", onPointerMove);
    }

    const loop = (t: number) => {
      rafRef.current = requestAnimationFrame(loop);
      uniforms.iTime.value = t * 0.001;
      if (mouseDampening > 0) {
        if (!lastTimeRef.current) lastTimeRef.current = t;
        const dt = (t - lastTimeRef.current) / 1000;
        lastTimeRef.current = t;
        const tau = Math.max(1e-4, mouseDampening);
        let factor = 1 - Math.exp(-dt / tau);
        if (factor > 1) factor = 1;
        const target = mouseTargetRef.current;
        const cur = uniforms.iMouse.value;
        cur[0] += (target[0] - cur[0]) * factor;
        cur[1] += (target[1] - cur[1]) * factor;
      } else {
        lastTimeRef.current = t;
      }
      if (!paused && programRef.current && meshRef.current) {
        try {
          renderer.render({ scene: meshRef.current });
        } catch (e) {
          console.error(e);
        }
      }
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (mouseInteraction) canvas.removeEventListener("pointermove", onPointerMove);
      ro.disconnect();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
      const callIfFn = (obj: any, key: string) => {
        const fn = obj && obj[key];
        if (typeof fn === "function") {
          fn.call(obj);
        }
      };
      callIfFn(programRef.current, "remove");
      callIfFn(geometryRef.current, "remove");
      callIfFn(meshRef.current, "remove");
      callIfFn(rendererRef.current, "destroy");
      programRef.current = null;
      geometryRef.current = null;
      meshRef.current = null;
      rendererRef.current = null;
    };
  }, [
    dpr,
    paused,
    colors,
    speed,
    scale,
    turbulence,
    fluidity,
    rimWidth,
    sharpness,
    shimmer,
    glow,
    flowDirection,
    opacity,
    mouseInteraction,
    mouseStrength,
    mouseRadius,
    mouseDampening,
  ]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 w-full h-full overflow-hidden ${className ?? ""}`}
      style={{
        ...(mixBlendMode && { mixBlendMode }),
      }}
    />
  );
};

/* Background = shader + two soft glow blobs */
const BackgroundLayer = () => (
  <>
    <div className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-violet-600/30 blur-[120px]" />
    <div className="pointer-events-none absolute top-40 -right-24 h-[260px] w-[260px] rounded-full bg-fuchsia-500/20 blur-[100px]" />
    <div className="absolute inset-0 pointer-events-none z-0">
      <Ferrofluid
        colors={SHADER_COLORS}
        speed={0.5}
        scale={1.8}
        turbulence={1.1}
        fluidity={0.15}
        rimWidth={0.25}
        sharpness={2.5}
        shimmer={1.5}
        glow={2.2}
        flowDirection="down"
        opacity={0.85}
        mouseInteraction={true}
        mouseStrength={0.9}
        mouseRadius={0.4}
      />
    </div>
  </>
);

/* ------------------------------------------------------------------ */
/*  3. MASCOT LAYER                                                    */
/* ------------------------------------------------------------------ */

/* One copy of the Kelly image. Each copy is masked to a body region
   (legs / torso / head / arms / clothing) so the regions can move
   independently while the feet stay anchored. */
const KellyLayer = ({ className, nested = false }: { className: string; nested?: boolean }) => (
  <div className={`k-layer ${className}`}>
    {nested ? (
      <div className="k-nod">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={KELLY_IMAGE} alt="" draggable={false} />
      </div>
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={KELLY_IMAGE} alt="" draggable={false} />
    )}
  </div>
);

/* Kelly: big, stands BEHIND the card on the RIGHT side. The PNG already
   faces the right direction, so it is NOT mirrored in code any more.
   Idle animation = layered body parts (see styles), looping forever. */
const KellyBackdrop = () => (
  <div className="kelly-stage pointer-events-none z-[5] select-none" aria-hidden="true">
    {/* soft purple glow behind her */}
    <div className="absolute inset-x-[10%] bottom-[8%] top-[18%] rounded-full bg-fuchsia-600/25 blur-[90px]" />
    <div className="kelly-rig relative h-full w-full">
      {/* hips + legs: tiny counter-sway, pivots at the bottom so the feet never move */}
      <KellyLayer className="k-hips" />

      {/* upper body: slow weight shift around the waist */}
      <div className="k-upper absolute inset-0">
        {/* chest rises and falls gently (breathing) */}
        <div className="k-breath absolute inset-0">
          <KellyLayer className="k-torso" />
          <KellyLayer className="k-sh-l" />
          <KellyLayer className="k-sh-r" />
          <KellyLayer className="k-arm-l" />
          <KellyLayer className="k-arm-r" />
          <KellyLayer className="k-head" nested />
        </div>
      </div>
    </div>
  </div>
);

/* Pet: sits on the top edge of the card, mirrored, jumping + shaking. */
const PetMascot = () => (
  <div
    className="pet-spot pointer-events-none absolute z-30 select-none"
    style={{ width: SIZES.petWidth, left: 22, top: -Math.round(SIZES.petWidth * 0.62) }}
    aria-hidden="true"
  >
    {/* ground shadow that squeezes while the pet is in the air */}
    <div className="pet-shadow absolute -bottom-1 left-[12%] right-[12%] h-2.5 rounded-full bg-black/60 blur-md" />
    <div className="pet-jump relative">
      <div className="pet-shake">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PET_IMAGE} alt="" draggable={false} className="pet-img block w-full h-auto" />
      </div>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  4. UI KIT                                                          */
/* ------------------------------------------------------------------ */

type FieldProps = {
  icon: LucideIcon;
  type: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
};

const Field = ({ icon: Icon, type, placeholder, value, onChange }: FieldProps) => (
  <div className="relative group/input rounded-xl overflow-hidden border border-white/10 bg-white/[0.04] backdrop-blur-md transition-all duration-300 focus-within:border-fuchsia-500/60 focus-within:bg-white/[0.08]">
    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-white/10 group-focus-within/input:bg-gradient-to-b group-focus-within/input:from-violet-500 group-focus-within/input:to-fuchsia-500 transition-colors duration-300" />
    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-fuchsia-400/70 group-focus-within/input:text-fuchsia-300 transition-colors duration-200">
      <Icon className="h-4 w-4 stroke-[1.8]" />
    </span>
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-transparent pl-10 pr-3 py-2.5 text-[13px] font-medium tracking-wide text-white placeholder-white/30 outline-none transition-all duration-300"
    />
  </div>
);

const BrandHeader = ({ isLogin }: { isLogin: boolean }) => (
  <div className="text-center mb-4 relative z-20 select-none">
    <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 backdrop-blur-md">
      <Sparkles className="h-3 w-3 text-fuchsia-400" />
      <span className="text-[9px] font-medium tracking-wider text-white/60 uppercase">JPRIME GLOBAL</span>
    </div>

    <h1 className="text-[26px] font-extrabold tracking-tight uppercase leading-none text-white">
      JPRIME{" "}
      <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-orange-300 bg-clip-text text-transparent">STORE</span>
    </h1>

    <p className="text-white/40 text-[9px] font-semibold uppercase tracking-[0.2em] mt-2">
      {isLogin ? "Authentication Protocol" : "Registration Protocol"}
    </p>
  </div>
);

const SubmitButton = ({ isLogin, onClick }: { isLogin: boolean; onClick: () => void }) => (
  <div className="mt-4 relative z-20">
    <button
      onClick={onClick}
      className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white py-3 rounded-xl font-bold text-xs tracking-[0.2em] transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 shadow-[0_8px_26px_-6px_rgba(192,38,211,0.6)] cursor-pointer"
    >
      <span>{isLogin ? "LOG IN" : "SIGN UP"}</span>
      <ArrowRight className="h-3.5 w-3.5 stroke-[2.5]" />
    </button>
  </div>
);

/* Account switch: ONE slim horizontal row (icon + short text + button) */
const SwitchBar = ({ isLogin, onToggle }: { isLogin: boolean; onToggle: () => void }) => (
  <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#10091f]/90 px-3 py-2">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/25 to-fuchsia-500/25 text-fuchsia-300 ring-1 ring-fuchsia-400/20">
      {isLogin ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
    </span>
    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-white/85">
      {isLogin ? "New to JPrime?" : "Already a member?"}
    </span>
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-fuchsia-400/35 bg-fuchsia-500/10 px-2.5 py-1.5 text-[11px] font-bold text-fuchsia-200 transition-all hover:border-fuchsia-300/70 hover:bg-fuchsia-500/20 active:scale-95 cursor-pointer"
    >
      {isLogin ? "Create account" : "Log in"}
      <ChevronRight className="h-3 w-3" />
    </button>
  </div>
);

/* Tutorial: slim help banner */
const TutorialCard = () => (
  <a
    href={TUTORIAL_URL}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Open the How to Use the Site YouTube tutorial"
    className="group/tutorial mt-3 flex items-center gap-3 rounded-xl border border-violet-300/15 bg-[#0b0718]/90 px-3 py-2.5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-fuchsia-400/45 hover:bg-[#120a25] active:scale-[0.99]"
  >
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-[0_6px_16px_rgba(192,38,211,0.28)]">
      <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
    </span>
    <span className="min-w-0 flex-1 truncate text-[12px] font-bold tracking-wide text-white">How to use the site</span>
    <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-fuchsia-200">
      Guide
    </span>
    <ArrowRight className="h-4 w-4 shrink-0 text-fuchsia-200 transition-transform group-hover/tutorial:translate-x-0.5" />
  </a>
);

/* ------------------------------------------------------------------ */
/*  5. AUTH LAYER  (all state + API calls live here, no JSX)           */
/* ------------------------------------------------------------------ */

const useAuthForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ username: "", password: "", email: "", mobileNumber: "" });

  const setField = useCallback(
    (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value })),
    []
  );

  const toggleMode = useCallback(() => setIsLogin((v) => !v), []);

  const login = async () => {
    // The server verifies the password and sets an HttpOnly session cookie.
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.username, password: form.password }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result?.success || !result?.user) {
      alert(result?.error || "Invalid username or password");
      return;
    }

    // Display-only hint for the UI. It is NOT used for authentication.
    localStorage.setItem("jprime:lastActivityAt", String(Date.now()));
    localStorage.setItem(
      "user",
      JSON.stringify({
        username: result.user.username,
        email: result.user.email,
        role: result.user.role,
      })
    );
    window.location.href = "/";
  };

  const signup = async () => {
    if (!form.mobileNumber.trim() || form.mobileNumber.length < 10) {
      alert("Enter valid mobile number");
      return;
    }

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.username,
        password: form.password,
        email: form.email,
        mobile_number: form.mobileNumber,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result?.success) {
      alert(result?.error || "Could not create account.");
    } else {
      alert("Signup Success");
      setIsLogin(true);
    }
  };

  const submit = async () => {
    try {
      if (isLogin) await login();
      else await signup();
    } catch {
      alert("Network error. Please try again.");
    }
  };

  return { isLogin, form, setField, toggleMode, submit };
};

/* ------------------------------------------------------------------ */
/*  6. PAGE                                                            */
/* ------------------------------------------------------------------ */

export default function LoginPage() {
  const { isLogin, form, setField, toggleMode, submit } = useAuthForm();

  return (
    <div className="min-h-screen bg-[#07040f] text-white flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden font-sans antialiased selection:bg-fuchsia-500 selection:text-white">
      <BackgroundLayer />

      <main className="relative z-10 w-full flex flex-col" style={{ maxWidth: SIZES.cardMaxWidth }}>
        {/* wrapper lets the pet sit on the card edge without being clipped */}
        <div className="card-wrap relative mt-10">
          {/* Kelly stands behind the card (desktop: right side of screen, mobile: peeks over the card) */}
          <KellyBackdrop />
          <PetMascot />

          <section className="login-panel relative z-10 overflow-hidden rounded-3xl border border-violet-300/20 bg-[#080511]/92 p-3 shadow-[0_28px_80px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/80 to-transparent" />
            <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-violet-600/10 blur-3xl" />

            <div className="relative z-10 rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.055] to-white/[0.015] px-4 pb-4 pt-5">
              <BrandHeader isLogin={isLogin} />

              <div className="mb-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              <div className="space-y-2.5 relative z-20">
                <Field icon={User} type="text" placeholder="Username" value={form.username} onChange={setField("username")} />

                {!isLogin && (
                  <div className="space-y-2.5 animate-form-reveal">
                    <Field
                      icon={Mail}
                      type="email"
                      placeholder="Email Address (optional)"
                      value={form.email}
                      onChange={setField("email")}
                    />
                    <Field
                      icon={Phone}
                      type="text"
                      placeholder="Mobile Number"
                      value={form.mobileNumber}
                      onChange={setField("mobileNumber")}
                    />
                  </div>
                )}

                <Field icon={Lock} type="password" placeholder="Password" value={form.password} onChange={setField("password")} />
              </div>

              <SubmitButton isLogin={isLogin} onClick={submit} />
            </div>

            <SwitchBar isLogin={isLogin} onToggle={toggleMode} />
          </section>
        </div>

        <TutorialCard />
      </main>

      <LoginStyles />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  7. STYLES                                                          */
/* ------------------------------------------------------------------ */

const LoginStyles = () => (
  <style
    dangerouslySetInnerHTML={{
      __html: `
    @keyframes formReveal {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-form-reveal {
      animation: formReveal 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .login-panel { isolation: isolate; }

    /* ================= KELLY (behind card, left, mirrored) ================= */
    .kelly-stage {
      position: fixed;
      bottom: 0;
      --kh: min(88vh, 880px);
      height: var(--kh);
      width: calc(var(--kh) * 0.667);
      /* RIGHT side: her left edge tucks behind the card so the card overlaps her body */
      left: calc(50% + ${SIZES.cardMaxWidth / 2}px - var(--kh) * 0.05);
      filter: drop-shadow(0 0 28px rgba(192, 38, 211, 0.35));
    }
    /* ---- Kelly natural idle (relaxed, confident, NO shaking) ----
       Every motion is a slow, smooth back-and-forth ("alternate" + ease-in-out),
       so it flows like a sine wave and loops seamlessly with no jerks.
       The body parts share one rhythm (2.6s per side, 5.2s for a full left-right
       cycle) but start at different phases, so the movement reads as ONE
       coordinated motion:
         hips push one way  ->  waist/torso lean the other way
         shoulders roll one after the other  ->  head tilts last and nods softly
         arms swing a little later than the body, each on its own timing. */
    .kelly-rig { --side: 2.6s; }

    .k-layer { position: absolute; inset: 0; will-change: transform; }
    .k-layer img, .k-nod img {
      display: block;
      width: 100%;
      height: 100%;
      max-width: none;
      object-fit: contain;
      object-position: bottom;
      user-select: none;
    }
    .k-nod { position: absolute; inset: 0; will-change: transform; }

    /* ---------- body-part masks (soft edges hide the seams) ---------- */
    .k-hips {
      -webkit-mask-image: linear-gradient(to bottom, transparent 66%, #000 78%);
      mask-image: linear-gradient(to bottom, transparent 66%, #000 78%);
    }
    .k-torso {
      -webkit-mask-image: linear-gradient(to bottom, transparent 25%, #000 33%, #000 76%, transparent 88%);
      mask-image: linear-gradient(to bottom, transparent 25%, #000 33%, #000 76%, transparent 88%);
    }
    .k-sh-l {
      -webkit-mask-image: radial-gradient(ellipse 15% 7% at 38% 40%, #000 70%, transparent 100%);
      mask-image: radial-gradient(ellipse 15% 7% at 38% 40%, #000 70%, transparent 100%);
    }
    .k-sh-r {
      -webkit-mask-image: radial-gradient(ellipse 15% 7% at 83% 38%, #000 70%, transparent 100%);
      mask-image: radial-gradient(ellipse 15% 7% at 83% 38%, #000 70%, transparent 100%);
    }
    .k-arm-l {
      -webkit-mask-image: radial-gradient(ellipse 30% 14% at 24% 57%, #000 78%, transparent 100%);
      mask-image: radial-gradient(ellipse 30% 14% at 24% 57%, #000 78%, transparent 100%);
    }
    .k-arm-r {
      -webkit-mask-image: radial-gradient(ellipse 22% 24% at 82% 62%, #000 72%, transparent 100%);
      mask-image: radial-gradient(ellipse 22% 24% at 82% 62%, #000 72%, transparent 100%);
    }
    .k-head {
      -webkit-mask-image: linear-gradient(to bottom, #000 28%, transparent 36%);
      mask-image: linear-gradient(to bottom, #000 28%, transparent 36%);
    }

    /* ---------- motions ---------- */
    .k-upper, .k-hips, .k-breath, .k-sh-l, .k-sh-r, .k-arm-l, .k-arm-r, .k-head, .k-nod {
      animation-timing-function: ease-in-out;
      animation-iteration-count: infinite;
      animation-direction: alternate;
    }

    /* 1) weight shift: upper body leans around the waist */
    .k-upper {
      transform-origin: 50% 76%;
      animation-name: kShift;
      animation-duration: var(--side);
    }
    @keyframes kShift {
      from { transform: rotate(-0.75deg) translateX(-3px); }
      to   { transform: rotate(0.75deg) translateX(3px); }
    }

    /* 2) hips counter-sway (opposite way to the torso); pivot = bottom, feet stay put */
    .k-hips {
      transform-origin: 50% 100%;
      animation-name: kHips;
      animation-duration: var(--side);
    }
    @keyframes kHips {
      from { transform: rotate(0.5deg); }
      to   { transform: rotate(-0.5deg); }
    }

    /* 3) breathing: chest rises a touch */
    .k-breath {
      animation-name: kBreath;
      animation-duration: calc(var(--side) / 2);
    }
    @keyframes kBreath {
      from { transform: translateY(0); }
      to   { transform: translateY(-2px); }
    }

    /* 4) shoulder rolls: left and right a quarter-cycle apart */
    .k-sh-l {
      transform-origin: 50% 40%;
      animation-name: kShoulder;
      animation-duration: calc(var(--side) / 2);
    }
    .k-sh-r {
      transform-origin: 50% 40%;
      animation-name: kShoulder;
      animation-duration: calc(var(--side) / 2);
      animation-delay: calc(var(--side) / -4);
    }
    @keyframes kShoulder {
      from { transform: translateY(-2px) rotate(-0.5deg); }
      to   { transform: translateY(1px) rotate(0.4deg); }
    }

    /* 5) arms: gentle swing, each arm on its own timing and a bit behind the body */
    .k-arm-l {
      transform-origin: 37% 40%;
      animation-name: kArmL;
      animation-duration: var(--side);
      animation-delay: calc(var(--side) / -5);
    }
    @keyframes kArmL {
      from { transform: rotate(-1deg); }
      to   { transform: rotate(1.1deg); }
    }
    .k-arm-r {
      transform-origin: 82% 38%;
      animation-name: kArmR;
      animation-duration: calc(var(--side) * 1.25);
      animation-delay: calc(var(--side) / -2);
    }
    @keyframes kArmR {
      from { transform: rotate(0.9deg); }
      to   { transform: rotate(-1deg); }
    }

    /* 6) head: soft tilt that follows the body a moment later + a slow, small nod */
    .k-head {
      transform-origin: 66% 31%;
      animation-name: kHeadTilt;
      animation-duration: var(--side);
      animation-delay: calc(var(--side) / -6);
    }
    @keyframes kHeadTilt {
      from { transform: rotate(1.5deg); }
      to   { transform: rotate(-1.5deg); }
    }
    .k-nod {
      animation-name: kNod;
      animation-duration: calc(var(--side) * 0.8);
    }
    @keyframes kNod {
      from { transform: translateY(0); }
      to   { transform: translateY(1.8px); }
    }

    /* MOBILE / TABLET: Kelly stands on the top edge of the card (her lower body is
       hidden behind it) on the right, with the pet on the left. Her head, shoulders
       and arms stay fully visible above the card. */
    @media (max-width: 900px) {
      .card-wrap { margin-top: calc(min(44vh, 340px) - 56px) !important; }
      .kelly-stage {
        position: absolute;
        --kh: min(44vh, 340px);
        bottom: calc(100% - 64px);
        left: auto;
        right: -4px;
      }
    }

    /* ================= PET (on card, mirrored, jumping + shaking) ================= */
    .pet-img { transform: scaleX(-1); transform-origin: 50% 100%; }

    /* Pet: cute bouncy jump - crouch, launch, stretch, land with squash, small rebound */
    @keyframes petJump {
      0%   { transform: translateY(0) scale(1.1, 0.88); }
      12%  { transform: translateY(0) scale(0.92, 1.12); }
      35%  { transform: translateY(-34px) scale(0.94, 1.1); }
      50%  { transform: translateY(-38px) scale(1, 1); }
      68%  { transform: translateY(0) scale(1.14, 0.84); }
      78%  { transform: translateY(-9px) scale(0.97, 1.05); }
      88%  { transform: translateY(0) scale(1.05, 0.95); }
      100% { transform: translateY(0) scale(1.1, 0.88); }
    }
    .pet-jump {
      transform-origin: 50% 100%;
      animation: petJump 1.6s ease-in-out infinite;
      will-change: transform;
    }

    /* tiny happy wiggle while bouncing */
    @keyframes petWiggle {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-5deg); }
      75% { transform: rotate(5deg); }
    }
    .pet-shake {
      transform-origin: 50% 100%;
      animation: petWiggle 0.8s ease-in-out infinite;
    }

    @keyframes petShadow {
      0%, 100% { transform: scaleX(1.1); opacity: 0.65; }
      35%, 50% { transform: scaleX(0.55); opacity: 0.2; }
      68% { transform: scaleX(1.15); opacity: 0.7; }
    }
    .pet-shadow { animation: petShadow 1.6s ease-in-out infinite; }
  `,
    }}
  />
);