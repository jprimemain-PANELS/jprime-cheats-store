"use client";

/* ====================================================================
 *  JPRIME STORE - LOGIN PAGE
 *
 *  ARCHITECTURE (top to bottom in this file)
 *  ------------------------------------------------------------------
 *  1. CONFIG        constants, asset paths, mascot sizes, theme colors
 *  2. SHADER LAYER  WebGL helpers + <Ferrofluid /> background
 *  3. MASCOT LAYER  <BoyCharacter />, <GirlCharacter />, <MascotRow />
 *  4. UI KIT        small reusable pieces (<Field />, <BrandHeader />,
 *                   <SwitchPill />, <TutorialCard />, <SubmitButton />)
 *  5. AUTH LAYER    useAuthForm() hook -> all state + API calls
 *  6. PAGE          <LoginPage /> only composes the pieces above
 *  7. STYLES        one <LoginStyles /> block with all keyframes
 * ==================================================================== */

import { useState, useEffect, useRef, useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import { User, Lock, Phone, Mail, ArrowRight, Sparkles, UserPlus, LogIn, Play, ChevronRight } from "lucide-react";
import { Renderer, Program, Mesh, Triangle } from "ogl";

/* ------------------------------------------------------------------ */
/*  1. CONFIG                                                          */
/* ------------------------------------------------------------------ */

// IMPORTANT: put girl.png and boy-character.png inside /public
const GIRL_IMAGE = "/girl.png";
const BOY_IMAGE = "/boy-character.png";
const TUTORIAL_URL = "https://youtu.be/F0UKQlnyXE4?si=n6qZtG91u6nddqSa";

// Change these two numbers to make the characters bigger / smaller.
const MASCOT_SIZE = {
  boyHeight: 170, // px  (was 300)
  girlWidth: 92, // px  (was ~170)
};

const SHADER_COLORS = ["#c026d3", "#7c3aed", "#e879f9"];

type FocusField = "idle" | "username" | "password";

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

/* Background = shader + two soft glow blobs, kept together as one layer */
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

/* Boy: reference artwork, seated on the card edge. Size comes from
   MASCOT_SIZE.boyHeight (the overlay SVG scales with the image). */
const BoyCharacter = () => {
  const h = MASCOT_SIZE.boyHeight;
  const seatH = Math.round(h * 0.83); // visible seat area above the card edge
  const top = Math.round(h * 0.08);

  return (
    <div className="boy-seat relative w-full overflow-visible" style={{ height: seatH }} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BOY_IMAGE}
        alt=""
        draggable={false}
        className="boy-character-float absolute w-auto max-w-none object-contain object-top select-none"
        style={{ height: h, top }}
      />
      {/* Subtle animated eyelids and smile over the original face. */}
      <svg
        viewBox="0 0 642 1536"
        preserveAspectRatio="xMidYMin meet"
        className="boy-face-overlay boy-character-float pointer-events-none absolute w-auto max-w-none overflow-visible"
        style={{ height: h, top }}
      >
        <g className="boy-eye-blink boy-eye-left">
          <path d="M218 286 Q266 247 318 281 Q307 318 268 321 Q234 315 218 286Z" fill="#f7c9ad" />
          <path d="M220 285 Q267 252 316 281" fill="none" stroke="#54352f" strokeWidth="8" strokeLinecap="round" />
          <path d="M237 303 Q267 315 298 301" fill="none" stroke="#d89583" strokeWidth="3" strokeLinecap="round" />
        </g>
        <g className="boy-eye-blink boy-eye-right">
          <path d="M376 263 Q420 222 466 260 Q456 296 420 300 Q390 294 376 263Z" fill="#f7c9ad" />
          <path d="M378 262 Q420 228 464 260" fill="none" stroke="#54352f" strokeWidth="8" strokeLinecap="round" />
          <path d="M393 282 Q420 294 449 280" fill="none" stroke="#d89583" strokeWidth="3" strokeLinecap="round" />
        </g>
        <path className="boy-smile-glint" d="M336 355 Q359 366 383 352" fill="none" stroke="#9e4e4b" strokeWidth="4" strokeLinecap="round" />
        <path className="boy-smile-highlight" d="M342 354 Q359 359 376 352" fill="none" stroke="#fff0e6" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
};

/* Girl: original artwork untouched; only the eyelids / steam / hearts
   are animated on top. */
const GirlCharacter = ({ focus }: { focus: FocusField }) => {
  const shy = focus === "password"; // closes eyes while typing password
  const excited = focus === "username"; // talks faster while typing username

  return (
    <div className="relative w-full aspect-[338/497]">
      <span className="girl-heart" style={{ left: "78%", top: "8%", animationDelay: "0s" }}>
        ♥
      </span>
      <span className="girl-heart" style={{ left: "88%", top: "20%", animationDelay: "1.1s", fontSize: 9 }}>
        ♥
      </span>
      <span className="girl-heart" style={{ left: "70%", top: "14%", animationDelay: "2.1s", fontSize: 8 }}>
        ✦
      </span>

      {/* soft contact shadow on the card edge */}
      <div className="absolute -bottom-1.5 left-[4%] right-[4%] h-3 rounded-full bg-black/70 blur-md" />

      <div className="girl-wrap absolute inset-0">
        {/* BODY (below the neck) */}
        <div className="absolute inset-0" style={{ clipPath: "inset(34% 0 0 0)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={GIRL_IMAGE} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain" />
        </div>

        {/* steam from the cup */}
        <svg viewBox="0 0 338 497" className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <filter id="steamBlur">
              <feGaussianBlur stdDeviation="2.2" />
            </filter>
          </defs>
          {[172, 183, 194].map((x, i) => (
            <path
              key={x}
              className="girl-steam"
              style={{ animationDelay: `${i * 0.8}s` }}
              d={`M${x},238 q-7,-9 0,-17 q7,-8 0,-16`}
              stroke="#ffffff"
              strokeWidth="3.2"
              strokeLinecap="round"
              fill="none"
              filter="url(#steamBlur)"
            />
          ))}
        </svg>

        {/* HEAD (sways, blinks, talks) */}
        <div className="girl-head absolute inset-0" style={{ clipPath: "inset(0 0 64% 0)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={GIRL_IMAGE} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain" />

          <svg viewBox="0 0 338 497" className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <linearGradient id="lidSkin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e9ab88" />
                <stop offset="100%" stopColor="#f4c6a8" />
              </linearGradient>
            </defs>

            {/* left eyelid */}
            <g transform="rotate(-14 140 116)">
              <g className={`girl-lid ${shy ? "is-shut" : ""}`}>
                <ellipse cx="140" cy="116" rx="16.5" ry="14.5" fill="url(#lidSkin)" />
                <path d="M124,119 Q140,131 157,118" stroke="#3b1d10" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                <path d="M126,118 l-4,-1.5 M132,124 l-2.4,2.6 M141,127 l0,3.6 M150,125 l2.4,2.8" stroke="#3b1d10" strokeWidth="1.2" strokeLinecap="round" />
              </g>
            </g>

            {/* right eyelid */}
            <g transform="rotate(-6 183 100)">
              <g className={`girl-lid late ${shy ? "is-shut" : ""}`}>
                <ellipse cx="183" cy="100.5" rx="16.5" ry="14.5" fill="url(#lidSkin)" />
                <path d="M167,103 Q183,115 200,102" stroke="#3b1d10" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                <path d="M169,102 l-4,-1.5 M175,109 l-2.4,2.6 M184,112 l0,3.6 M193,110 l2.4,2.8" stroke="#3b1d10" strokeWidth="1.2" strokeLinecap="round" />
              </g>
            </g>

            {/* talking mouth */}
            <g transform="rotate(-14 165 146)">
              <g className={`girl-mouth ${excited ? "fast" : ""}`}>
                <path d="M152.5,144 Q165,140.5 178.5,142.2 Q174.5,155.5 165,155 Q156,153.5 152.5,144 Z" fill="#6e1d2a" />
                <path d="M155.5,144.4 Q165,141.8 176,143 L175,146.4 Q165,145.2 156.5,146.6 Z" fill="#fff5ee" />
                <ellipse cx="165" cy="151.5" rx="5.5" ry="2.4" fill="#d9697a" />
                <path d="M151.5,143.8 Q165,139 179.5,141.6" stroke="#d96a73" strokeWidth="2.4" strokeLinecap="round" fill="none" />
              </g>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
};

/* Row that seats both characters on the top edge of the card */
const MascotRow = ({ focus }: { focus: FocusField }) => (
  <div className="mascot-row relative z-30 -mb-4 flex items-end justify-between px-4 sm:px-8 pointer-events-none select-none">
    <div style={{ width: Math.round(MASCOT_SIZE.boyHeight * 0.62) }}>
      <BoyCharacter />
    </div>
    <div className="girl-seat translate-y-2" style={{ width: MASCOT_SIZE.girlWidth }}>
      <GirlCharacter focus={focus} />
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  4. UI KIT                                                          */
/* ------------------------------------------------------------------ */

/* One reusable input row (icon + glowing left bar + input) */
type FieldProps = {
  icon: LucideIcon;
  type: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onFocusField: () => void;
  onBlurField: () => void;
};

const Field = ({ icon: Icon, type, placeholder, value, onChange, onFocusField, onBlurField }: FieldProps) => (
  <div className="relative group/input rounded-xl overflow-hidden border border-white/10 bg-white/[0.04] backdrop-blur-md transition-all duration-300 focus-within:border-fuchsia-500/60 focus-within:bg-white/[0.08]">
    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-white/10 group-focus-within/input:bg-gradient-to-b group-focus-within/input:from-violet-500 group-focus-within/input:to-fuchsia-500 transition-colors duration-300" />
    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-fuchsia-400/70 group-focus-within/input:text-fuchsia-300 transition-colors duration-200">
      <Icon className="h-4 w-4 stroke-[1.8]" />
    </span>
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocusField}
      onBlur={onBlurField}
      className="w-full bg-transparent pl-11 pr-4 py-3 text-sm font-medium tracking-wide text-white placeholder-white/30 outline-none transition-all duration-300"
    />
  </div>
);

const BrandHeader = ({ isLogin }: { isLogin: boolean }) => (
  <div className="text-center mb-6 relative z-20 select-none">
    <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-md">
      <Sparkles className="h-3 w-3 text-fuchsia-400" />
      <span className="text-[10px] font-medium tracking-wider text-white/60 uppercase">JPRIME GLOBAL</span>
    </div>

    <h1 className="text-3xl font-extrabold tracking-tight uppercase leading-none text-white">
      JPRIME{" "}
      <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-orange-300 bg-clip-text text-transparent">STORE</span>
    </h1>

    <p className="text-white/40 text-[10px] font-semibold uppercase tracking-[0.2em] mt-2.5">
      {isLogin ? "Authentication Protocol" : "Registration Protocol"}
    </p>
  </div>
);

const SubmitButton = ({ isLogin, onClick }: { isLogin: boolean; onClick: () => void }) => (
  <div className="mt-6 relative z-20">
    <button
      onClick={onClick}
      className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white py-3.5 rounded-xl font-bold text-xs tracking-[0.2em] transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 shadow-[0_8px_30px_-6px_rgba(192,38,211,0.6)] cursor-pointer"
    >
      <span>{isLogin ? "LOG IN" : "SIGN UP"}</span>
      <ArrowRight className="h-3.5 w-3.5 stroke-[2.5]" />
    </button>
  </div>
);

/* Account switch: a compact, separate footer panel with the same action */
const SwitchPill = ({ isLogin, onToggle }: { isLogin: boolean; onToggle: () => void }) => (
  <div className="account-switch mt-5 rounded-2xl border border-white/10 bg-[#10091f]/90 p-3.5 sm:p-4">
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/25 to-fuchsia-500/25 text-fuchsia-300 ring-1 ring-fuchsia-400/20">
        {isLogin ? <UserPlus className="h-[18px] w-[18px]" /> : <LogIn className="h-[18px] w-[18px]" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-fuchsia-300/80">
          {isLogin ? "New to JPrime?" : "Already a member?"}
        </span>
        <span className="mt-1 block text-sm font-semibold text-white">
          {isLogin ? "Create a new account" : "Continue to your account"}
        </span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-white/45">
          {isLogin ? "Join in a few simple steps." : "Your account is ready when you are."}
        </span>
      </span>
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-fuchsia-400/35 bg-fuchsia-500/10 px-3 py-2.5 text-[11px] font-bold text-fuchsia-200 transition-all hover:border-fuchsia-300/70 hover:bg-fuchsia-500/20 active:scale-95 cursor-pointer"
      >
        {isLogin ? "Create account" : "Log in"}
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
);

/* Tutorial: compact horizontal help banner instead of a large thumbnail box */
const TutorialCard = () => (
  <a
    href={TUTORIAL_URL}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Open the How to Use the Site YouTube tutorial"
    className="tutorial-card group/tutorial mt-3 flex items-center gap-3 rounded-2xl border border-violet-300/15 bg-[#0b0718]/90 px-4 py-3.5 shadow-[0_14px_38px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-fuchsia-400/45 hover:bg-[#120a25] hover:shadow-[0_14px_36px_rgba(124,58,237,0.16)] active:scale-[0.99]"
  >
    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-[0_6px_18px_rgba(192,38,211,0.28)] transition-transform duration-300 group-hover/tutorial:scale-105">
      <Play className="ml-0.5 h-4 w-4 fill-current" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-2">
        <span className="block text-xs font-extrabold tracking-[0.08em] text-white">How to use the site</span>
        <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-fuchsia-200">Guide</span>
      </span>
      <span className="mt-1 block text-[11px] leading-relaxed text-white/45">Watch the quick step-by-step video tutorial</span>
    </span>
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-fuchsia-200 transition-all group-hover/tutorial:translate-x-0.5 group-hover/tutorial:border-fuchsia-300/40 group-hover/tutorial:bg-fuchsia-500/10">
      <ArrowRight className="h-4 w-4" />
    </span>
  </a>
);

/* ------------------------------------------------------------------ */
/*  5. AUTH LAYER  (all state + API calls live here, no JSX)           */
/* ------------------------------------------------------------------ */

const useAuthForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [focus, setFocus] = useState<FocusField>("idle");
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

  return { isLogin, focus, setFocus, form, setField, toggleMode, submit };
};

/* ------------------------------------------------------------------ */
/*  6. PAGE  (only composes the pieces above)                          */
/* ------------------------------------------------------------------ */

export default function LoginPage() {
  const { isLogin, focus, setFocus, form, setField, toggleMode, submit } = useAuthForm();

  // Handlers shared by every input
  const asUsername = { onFocusField: () => setFocus("username"), onBlurField: () => setFocus("idle") };
  const asPassword = { onFocusField: () => setFocus("password"), onBlurField: () => setFocus("idle") };

  return (
    <div className="min-h-screen bg-[#07040f] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans antialiased selection:bg-fuchsia-500 selection:text-white">
      <BackgroundLayer />

      <main className="relative z-10 w-full max-w-md flex flex-col mt-2">
        {/* Both characters sit on the top edge of the card */}
        <MascotRow focus={focus} />

        {/* Redesigned login panel: brand header, form surface, and account footer */}
        <section className="login-panel relative overflow-hidden rounded-[28px] border border-violet-300/15 bg-[#080511]/90 p-4 shadow-[0_32px_90px_rgba(0,0,0,0.72)] backdrop-blur-2xl transition-all duration-500 hover:border-fuchsia-400/25 sm:p-5">
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/80 to-transparent" />
          <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-violet-600/10 blur-3xl" />

          <div className="relative z-10 rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.055] to-white/[0.015] px-4 pb-4 pt-5 sm:px-5 sm:pt-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white/55">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                JPrime Global
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-fuchsia-200/55">
                {isLogin ? "Secure login" : "New registration"}
              </span>
            </div>

            <BrandHeader isLogin={isLogin} />

            <div className="mb-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="space-y-3 relative z-20">
              <Field
                icon={User}
                type="text"
                placeholder="Username"
                value={form.username}
                onChange={setField("username")}
                {...asUsername}
              />

              {!isLogin && (
                <div className="space-y-3 animate-form-reveal">
                  <Field
                    icon={Mail}
                    type="email"
                    placeholder="Email Address (optional)"
                    value={form.email}
                    onChange={setField("email")}
                    {...asUsername}
                  />
                  <Field
                    icon={Phone}
                    type="text"
                    placeholder="Mobile Number"
                    value={form.mobileNumber}
                    onChange={setField("mobileNumber")}
                    {...asUsername}
                  />
                </div>
              )}

              <Field
                icon={Lock}
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={setField("password")}
                {...asPassword}
              />
            </div>

            <SubmitButton isLogin={isLogin} onClick={submit} />
          </div>

          <SwitchPill isLogin={isLogin} onToggle={toggleMode} />
        </section>
        <TutorialCard />
      </main>

      <LoginStyles />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  7. STYLES  (all keyframes in one place)                            */
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

    /* ---- redesigned login panel and account switch ---- */
    .login-panel { isolation: isolate; }
    .account-switch { box-shadow: inset 0 1px 0 rgba(255,255,255,0.025); }
    @media (max-width: 420px) {
      .account-switch > div { align-items: flex-start; flex-wrap: wrap; }
      .account-switch button { margin-left: 52px; }
    }

    /* ---- switch (create account / log in) pill ---- */
    @keyframes pillBorder {
      0% { background-position: 0% 50%; }
      100% { background-position: 200% 50%; }
    }
    .switch-pill {
      background: linear-gradient(90deg, #7c3aed, #d946ef, #fb923c, #d946ef, #7c3aed);
      background-size: 200% 100%;
      animation: pillBorder 4s linear infinite;
      box-shadow: 0 10px 30px -10px rgba(217, 70, 239, 0.55);
    }
    @keyframes pillShine {
      0% { transform: translateX(0) skewX(-20deg); opacity: 0; }
      20% { opacity: 1; }
      60%, 100% { transform: translateX(420%) skewX(-20deg); opacity: 0; }
    }
    .switch-shine { animation: pillShine 3.6s ease-in-out infinite; }

    /* ---- tutorial card ---- */
    @keyframes tutorialPing {
      0% { transform: scale(1); opacity: 0.6; }
      80%, 100% { transform: scale(1.9); opacity: 0; }
    }
    .tutorial-ping { animation: tutorialPing 2s cubic-bezier(0, 0, 0.2, 1) infinite; }
    .tutorial-grid {
      background-image:
        linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px);
      background-size: 22px 22px;
      mask-image: radial-gradient(circle at center, black 20%, transparent 75%);
      -webkit-mask-image: radial-gradient(circle at center, black 20%, transparent 75%);
    }

    /* ---- boy: subtle idle movement ---- */
    @keyframes boyFloat {
      0%, 100% { transform: translateX(calc(-50% + 6px)) translateY(0) rotate(0deg); }
      50% { transform: translateX(calc(-50% + 6px)) translateY(-2px) rotate(0.25deg); }
    }
    .boy-character-float { left: 50%; animation: boyFloat 4.2s ease-in-out infinite; transform-origin: 50% 65%; }

    @keyframes boyBlink {
      0%, 42%, 48%, 87%, 93%, 100% { transform: scaleY(0.02); opacity: 0.98; }
      44%, 46%, 89%, 91% { transform: scaleY(1); opacity: 1; }
    }
    .boy-eye-blink {
      transform-box: fill-box;
      transform-origin: center;
      transform: scaleY(0.02);
      animation: boyBlink 5.2s ease-in-out infinite;
    }
    .boy-eye-right { animation-delay: 0.045s; }
    @keyframes boySmile {
      0%, 35%, 100% { opacity: 0.25; transform: scale(0.96); }
      45%, 68% { opacity: 0.9; transform: scale(1.04); }
    }
    .boy-smile-glint, .boy-smile-highlight {
      transform-box: fill-box;
      transform-origin: center;
      animation: boySmile 3.6s ease-in-out infinite;
    }
    .boy-smile-highlight { animation-delay: 0.08s; opacity: 0.45; }

    /* ---- girl: seated on the card edge ---- */
    .mascot-row { isolation: isolate; }
    .girl-seat { position: relative; z-index: 2; }
    .girl-seat::after {
      content: "";
      position: absolute;
      left: 8%; right: 8%; bottom: 1px;
      height: 6px;
      border-radius: 999px;
      background: rgba(0,0,0,0.48);
      filter: blur(6px);
      z-index: -1;
    }

    @keyframes girlBreathe {
      0%, 100% { transform: scaleY(1); }
      50% { transform: scaleY(1.012); }
    }
    .girl-wrap {
      transform-origin: 50% 100%;
      animation: girlBreathe 4s ease-in-out infinite;
    }
    @keyframes girlHead {
      0%, 100% { transform: rotate(-1.4deg) translateY(0); }
      50% { transform: rotate(1.6deg) translateY(-1px); }
    }
    .girl-head {
      transform-origin: 49% 37%;
      animation: girlHead 5s ease-in-out infinite;
    }

    @keyframes girlBlink {
      0%, 90%, 100% { transform: scaleY(0); }
      93% { transform: scaleY(1); }
      96% { transform: scaleY(0); }
    }
    .girl-lid {
      transform-box: fill-box;
      transform-origin: 50% 0%;
      transform: scaleY(0);
      transition: transform 0.2s ease;
      animation: girlBlink 4.2s infinite;
    }
    .girl-lid.late { animation-delay: 0.05s; }
    .girl-lid.is-shut { animation: none; transform: scaleY(1); }

    @keyframes girlTalk {
      0%, 40%, 100% { opacity: 0; transform: scaleY(0.2); }
      46% { opacity: 1; transform: scaleY(1); }
      52% { opacity: 1; transform: scaleY(0.45); }
      58% { opacity: 1; transform: scaleY(0.95); }
      64% { opacity: 1; transform: scaleY(0.4); }
      70% { opacity: 1; transform: scaleY(0.85); }
      76% { opacity: 0; transform: scaleY(0.2); }
    }
    .girl-mouth {
      transform-box: fill-box;
      transform-origin: 50% 15%;
      opacity: 0;
      animation: girlTalk 6s infinite;
    }
    .girl-mouth.fast { animation-duration: 2.4s; }

    @keyframes girlSteam {
      0% { opacity: 0; transform: translateY(8px); }
      35% { opacity: 0.55; }
      100% { opacity: 0; transform: translateY(-16px); }
    }
    .girl-steam { opacity: 0; animation: girlSteam 3s ease-in-out infinite; }

    @keyframes girlHeart {
      0% { opacity: 0; transform: translateY(8px) scale(0.6); }
      25% { opacity: 0.95; }
      100% { opacity: 0; transform: translateY(-26px) scale(1.15); }
    }
    .girl-heart {
      position: absolute;
      font-size: 11px;
      line-height: 1;
      color: #f0abfc;
      text-shadow: 0 0 8px rgba(217, 70, 239, 0.9);
      opacity: 0;
      z-index: 5;
      animation: girlHeart 3.4s ease-in-out infinite;
    }
  `,
    }}
  />
);