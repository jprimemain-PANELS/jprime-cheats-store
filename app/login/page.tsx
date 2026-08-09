"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { User, Lock, Phone, Mail, ArrowRight } from "lucide-react";
import { Renderer, Program, Mesh, Triangle } from "ogl";

/* ==========================================================================
   FERROFLUID SHADER SYSTEM (INTERACTIVE & MOBILE COMPATIBLE BACKGROUND)
   ========================================================================== */
const MAX_COLORS = 8;

const hexToRGB = (hex) => {
  const c = hex.replace("#", "").padEnd(6, "0");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  return [r, g, b];
};

const prepColors = (input) => {
  const base = (input && input.length ? input : ["#4F46E5", "#06B6D4", "#E0F2FE"]).slice(0, MAX_COLORS);
  const count = base.length;
  const arr = [];
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

const flowVec = (d) => {
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
  colors = ["#ffffff", "#ffffff", "#ffffff"],
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
  mixBlendMode
}) => {
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const programRef = useRef(null);
  const meshRef = useRef(null);
  const geometryRef = useRef(null);
  const rendererRef = useRef(null);
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

    let renderer;
    try {
      renderer = new Renderer({
        dpr: getSafeDPR(),
        alpha: true,
        antialias: true,
        powerPreference: "high-performance"
      });
    } catch (err) {
      console.warn("WebGL compatibility system fallback activated:", err);
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
      uMouseRadius: { value: mouseRadius }
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

    const onPointerMove = (e) => {
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

    const loop = (t) => {
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
      const callIfFn = (obj, key) => {
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
    mouseDampening
  ]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 w-full h-full overflow-hidden ${className ?? ""}`}
      style={{
        ...(mixBlendMode && { mixBlendMode })
      }}
    />
  );
};

/* ==========================================================================
   ULTRA-REALISTIC HIGH-FIDELITY CARTOON TOY COMPONENT
   ========================================================================== */
const InteractiveToy = ({ currentField }) => {
  return (
    <div className="w-36 h-36 mx-auto relative -mb-5 z-30 transition-all duration-300 transform origin-bottom hover:scale-105 select-none pointer-events-none">
      <svg viewBox="0 0 140 140" className="w-full h-full filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)]">
        <defs>
          {/* Volumetric Plastic Head Gradients */}
          <radialGradient id="toySkin" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="55%" stopColor="#0891b2" />
            <stop offset="85%" stopColor="#0e7490" />
            <stop offset="100%" stopColor="#155e75" />
          </radialGradient>
          
          <linearGradient id="toySkinShadow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.45" />
          </linearGradient>

          {/* Glowing Neon Ear Tips */}
          <radialGradient id="earGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </radialGradient>

          {/* Realistic Deep 3D Eye Orbitals */}
          <radialGradient id="eyeBacking" cx="50%" cy="50%" r="50%">
            <stop offset="75%" stopColor="#ffffff" />
            <stop offset="93%" stopColor="#e4e4e7" />
            <stop offset="100%" stopColor="#a1a1aa" />
          </radialGradient>

          <radialGradient id="pupilGrad" cx="40%" cy="40%" r="50%">
            <stop offset="0%" stopColor="#27272a" />
            <stop offset="70%" stopColor="#09090b" />
            <stop offset="100%" stopColor="#000000" />
          </radialGradient>

          {/* Premium Specular Gloss Reflections */}
          <linearGradient id="glossHighlight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.65" />
            <stop offset="40%" stopColor="#ffffff" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          {/* Mouth Depth Cavity */}
          <linearGradient id="mouthInterior" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4c0519" />
            <stop offset="100%" stopColor="#9f1239" />
          </linearGradient>

          {/* Soft Drop Shadow for Features */}
          <filter id="softShadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#020617" floodOpacity="0.5" />
          </filter>
          <filter id="innerGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#ffffff" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* 3D Antennae / Ears Channel */}
        <g filter="url(#softShadow)" className="transition-transform duration-500 origin-center">
          {/* Left Ear Base & Gradient Structure */}
          <path d="M 45,40 Q 25,12 32,8 Q 42,5 52,30" fill="url(#toySkin)" />
          <path d="M 45,40 Q 25,12 32,8 Q 42,5 52,30" fill="url(#toySkinShadow)" />
          <circle cx="31" cy="8" r="7" fill="url(#earGlow)" className="animate-pulse" />
          
          {/* Right Ear Base & Gradient Structure */}
          <path d="M 95,40 Q 115,12 108,8 Q 98,5 88,30" fill="url(#toySkin)" />
          <path d="M 95,40 Q 115,12 108,8 Q 98,5 88,30" fill="url(#toySkinShadow)" />
          <circle cx="109" cy="8" r="7" fill="url(#earGlow)" className="animate-pulse" />
        </g>

        {/* Core Volumetric Head Shape */}
        <g filter="url(#softShadow)">
          <circle cx="70" cy="70" r="38" fill="url(#toySkin)" />
          {/* Ambient occlusion underlying profile depth */}
          <circle cx="70" cy="70" r="38" fill="url(#toySkinShadow)" />
        </g>

        {/* Highly Specular 3D Gloss Layer Anchor */}
        <path d="M 36,54 A 36,36 0 0,1 104,54 A 38,38 0 0,0 36,54 Z" fill="url(#glossHighlight)" opacity="0.4" />

        {/* Realistic Plush Rosy Cheeks */}
        <ellipse cx="44" cy="82" rx="7" ry="4.5" fill="#f43f5e" opacity="0.5" filter="blur(1px)" />
        <ellipse cx="96" cy="82" rx="7" ry="4.5" fill="#f43f5e" opacity="0.5" filter="blur(1px)" />

        {/* INTERACTIVE EYEBALL DYNAMICS */}
        {currentField === "password" ? (
          /* Password State: Super Funny covered / closed squeeze eyes looking up nervously */
          <g filter="url(#softShadow)" className="transition-all duration-300 transform translate-y-[-5px]">
            {/* Left Closed Curvature Slit */}
            <path d="M 46,68 Q 55,56 61,66" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" fill="none" />
            <path d="M 46,68 Q 55,56 61,66" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            
            {/* Right Closed Curvature Slit */}
            <path d="M 79,66 Q 85,56 94,68" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" fill="none" />
            <path d="M 79,66 Q 85,56 94,68" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" fill="none" />

            {/* Hilarious sweat/ping dots escaping upwards */}
            <circle cx="53" cy="52" r="2.5" fill="#38bdf8" className="animate-ping" />
            <circle cx="87" cy="52" r="2.5" fill="#38bdf8" className="animate-ping" />
          </g>
        ) : currentField === "username" ? (
          /* Username State: Ultra Ultra Wide Derpy Eyes looking directly down at input */
          <g filter="url(#softShadow)" className="transition-all duration-300">
            {/* Left Eye Sclera */}
            <circle cx="52" cy="65" r="11" fill="url(#eyeBacking)" stroke="#0891b2" strokeWidth="1" />
            <circle cx="54" cy="69" r="6" fill="url(#pupilGrad)" />
            {/* Specular Iris Sparkles */}
            <circle cx="52.5" cy="67.5" r="2" fill="#ffffff" />
            <circle cx="55.5" cy="70.5" r="0.75" fill="#ffffff" />

            {/* Right Eye Sclera */}
            <circle cx="88" cy="65" r="11" fill="url(#eyeBacking)" stroke="#0891b2" strokeWidth="1" />
            <circle cx="86" cy="69" r="6" fill="url(#pupilGrad)" />
            {/* Specular Iris Sparkles */}
            <circle cx="84.5" cy="67.5" r="2" fill="#ffffff" />
            <circle cx="87.5" cy="70.5" r="0.75" fill="#ffffff" />
          </g>
        ) : (
          /* Idle State: High Quality Premium Toy Glass Eyes */
          <g filter="url(#softShadow)" className="transition-all duration-300">
            {/* Left Eyeball Base */}
            <circle cx="52" cy="65" r="10" fill="url(#eyeBacking)" stroke="#0e7490" strokeWidth="0.5" />
            <circle cx="52" cy="65" r="5.5" fill="url(#pupilGrad)" />
            <circle cx="50" cy="63" r="2.5" fill="#ffffff" filter="url(#innerGlow)" />
            <circle cx="53.5" cy="66.5" r="1" fill="#ffffff" />

            {/* Right Eyeball Base */}
            <circle cx="88" cy="65" r="10" fill="url(#eyeBacking)" stroke="#0e7490" strokeWidth="0.5" />
            <circle cx="88" cy="65" r="5.5" fill="url(#pupilGrad)" />
            <circle cx="86" cy="63" r="2.5" fill="#ffffff" filter="url(#innerGlow)" />
            <circle cx="89.5" cy="66.5" r="1" fill="#ffffff" />
          </g>
        )}

        {/* INTERACTIVE MOUTH CAVITY DYNAMICS */}
        {currentField === "password" ? (
          /* Password State: Shaking / Wavy Nervous Line Mouth Expression */
          <path d="M 56,88 Q 63,82 70,88 T 84,88" stroke="#0f172a" strokeWidth="4.5" strokeLinecap="round" fill="none" className="transition-all duration-300" />
        ) : currentField === "username" ? (
          /* Username State: Giant Rendered Open Mouth Smile with Soft 3D Tongue */
          <g filter="url(#softShadow)" className="transition-all duration-300">
            <path d="M 52,82 Q 70,104 88,82 Z" fill="url(#mouthInterior)" stroke="#0891b2" strokeWidth="1" />
            {/* Volumetric Tongue Vector */}
            <path d="M 60,91 Q 70,84 80,91 Q 75,102 65,101 Z" fill="#fb7185" />
            <path d="M 52,82 Q 70,85 88,82" stroke="#0e7490" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : (
          /* Idle State: Cute Smug Subtle Plastic Molded Smile Line */
          <path d="M 55,84 Q 70,94 85,84" stroke="#0f172a" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        )}

        {/* MULTI-AXIS 3D ARMS / PAWS DYNAMICS */}
        {currentField === "password" ? (
          /* Password State: Volumetric arms moving directly up covering its side cheeks */
          <g filter="url(#softShadow)" className="transition-all duration-500 transform translate-y-[-18px]">
            {/* Left High Hand Vector */}
            <path d="M 26,96 Q 34,64 48,60" stroke="url(#toySkin)" strokeWidth="9" strokeLinecap="round" fill="none" />
            <path d="M 26,96 Q 34,64 48,60" stroke="url(#toySkinShadow)" strokeWidth="9" strokeLinecap="round" fill="none" />
            
            {/* Right High Hand Vector */}
            <path d="M 114,96 Q 106,64 92,60" stroke="url(#toySkin)" strokeWidth="9" strokeLinecap="round" fill="none" />
            <path d="M 114,96 Q 106,64 92,60" stroke="url(#toySkinShadow)" strokeWidth="9" strokeLinecap="round" fill="none" />
          </g>
        ) : currentField === "username" ? (
          /* Username State: Hilarious celebrating waving arms pointing straight down */
          <g filter="url(#softShadow)" className="transition-all duration-300">
            <path d="M 28,96 Q 12,98 20,112" stroke="url(#toySkin)" strokeWidth="8" strokeLinecap="round" fill="none" />
            <path d="M 28,96 Q 12,98 20,112" stroke="url(#toySkinShadow)" strokeWidth="8" strokeLinecap="round" fill="none" />
            
            <path d="M 112,96 Q 128,98 120,112" stroke="url(#toySkin)" strokeWidth="8" strokeLinecap="round" fill="none" />
            <path d="M 112,96 Q 128,98 120,112" stroke="url(#toySkinShadow)" strokeWidth="8" strokeLinecap="round" fill="none" />
          </g>
        ) : (
          /* Idle State: Soft Rounded Paws Resting Perfectly on Panel Rim */
          <g filter="url(#softShadow)" className="transition-all duration-300">
            <path d="M 28,96 Q 40,99 48,91" stroke="url(#toySkin)" strokeWidth="8" strokeLinecap="round" fill="none" />
            <path d="M 28,96 Q 40,99 48,91" stroke="url(#toySkinShadow)" strokeWidth="8" strokeLinecap="round" fill="none" />
            
            <path d="M 112,96 Q 100,99 92,91" stroke="url(#toySkin)" strokeWidth="8" strokeLinecap="round" fill="none" />
            <path d="M 112,96 Q 100,99 92,91" stroke="url(#toySkinShadow)" strokeWidth="8" strokeLinecap="round" fill="none" />
          </g>
        )}
      </svg>
    </div>
  );
};

/* ==========================================================================
   MAIN AUTHENTICATION PAGE COMPONENT
   ========================================================================== */
export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  
  // Real-time tracking of focused system input channels
  const [currentField, setCurrentField] = useState("idle");

  async function handleAuth() {
    if (isLogin) {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("password", password)
        .or(`username.eq.${username},mobile_number.eq.${username}`)
        .single();

      if (error || !data) {
        alert("Invalid username or password");
        return;
      }

      localStorage.setItem(
        "user",
        JSON.stringify({
          username: data.username,
          email: data.email,
          role: data.role
        })
      );
      window.location.href = "/";
    } else {
      if (!mobileNumber.trim() || mobileNumber.length < 10) {
        alert("Enter valid mobile number");
        return;
      }

      const { data: existingUser } = await supabase
        .from("users")
        .select("*")
        .eq("username", username)
        .single();

      if (existingUser) {
        alert("Username already exists");
        return;
      }

      const { error } = await supabase.from("users").insert([
        {
          username,
          password,
          email,
          mobile_number: mobileNumber,
          role: "user"
        }
      ]);

      if (error) {
        alert(error.message);
      } else {
        alert("Signup Success");
        setIsLogin(true);
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#020204] text-zinc-100 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans antialiased selection:bg-cyan-500 selection:text-black">
      
      {/* ================= DYNAMIC SHADER BACKGROUND SYSTEM ================= */}
      <div className="absolute inset-0 pointer-events-none z-0 bg-[#020204]">
        <Ferrofluid
          colors={["#06b6d4", "#2563eb", "#0891b2"]}
          speed={0.5}
          scale={1.8}
          turbulence={1.1}
          fluidity={0.15}
          rimWidth={0.25}
          sharpness={2.5}
          shimmer={1.5}
          glow={2.2}
          flowDirection="down"
          opacity={1}
          mouseInteraction={true}
          mouseStrength={0.9}
          mouseRadius={0.4}
        />
      </div>

      {/* ================= INTERFACE CONTENT SYSTEM ================= */}
      <div className="relative z-10 w-full max-w-md flex flex-col mt-4">
        
        {/* INTERACTIVE ULTRA-REALISTIC TOY COMPONENT */}
        <InteractiveToy currentField={currentField} />

        {/* PREMIUM MATTE INTERFACE PANEL WITH RAZOR EDGES */}
        <div className="bg-[#050608]/90 backdrop-blur-2xl border border-zinc-800/50 rounded-3xl p-8 md:p-12 shadow-[0_40px_100px_rgba(0,0,0,0.85)] relative overflow-hidden group/card transition-all duration-500 hover:border-zinc-700/60">
          
          {/* MICRO GRAPHIC GLINT LAYER */}
          <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
            <div className="absolute top-[-150%] left-[-150%] w-[300%] h-[300%] bg-gradient-to-tr from-transparent via-white/[0.08] to-transparent transform rotate-[35deg] animate-sword-edge" />
            <div className="absolute top-[-150%] left-[-150%] w-[300%] h-[300%] bg-gradient-to-tr from-transparent via-cyan-500/[0.03] to-transparent transform rotate-[35deg] animate-sword-flare" />
          </div>

          {/* BRAND TYPOGRAPHY: CORPORATE MATTE MINIMALISM */}
          <div className="text-center mb-10 relative z-20 select-none">
            <h1 className="text-4xl font-light tracking-[0.35em] text-white/95 uppercase leading-none pl-[0.35em]">
              JPRIME
            </h1>
            <p className="text-[10px] font-medium tracking-[0.65em] text-cyan-400/80 mt-3.5 uppercase pl-[0.65em]">
              GLOBAL
            </p>
            
            <div className="w-8 h-[1px] bg-zinc-800 mx-auto mt-6 mb-4" />
            
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">
              {isLogin ? "Authentication Protocol" : "Registration Protocol"}
            </p>
          </div>

          {/* PROFESSIONAL LOGIN BOXES (FLAT HIGH-CONTRAST INSET DESIGN) */}
          <div className="space-y-3.5 relative z-20">
            
            {/* INPUT CHANNELS: USERNAME */}
            <div className="relative group/input rounded-xl overflow-hidden border border-zinc-800 bg-black transition-all duration-300 focus-within:border-zinc-700">
              {/* Active Visual Indicator Anchor */}
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-zinc-800 group-focus-within/input:bg-cyan-400 transition-colors duration-300" />
              
              <span className="absolute inset-y-0 left-0 flex items-center pl-4.5 text-zinc-500 group-focus-within/input:text-zinc-300 transition-colors duration-200">
                <User className="h-4 w-4 stroke-[1.5]" />
              </span>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setCurrentField("username")}
                onBlur={() => setCurrentField("idle")}
                className="w-full bg-transparent pl-13 pr-4 py-4 text-sm font-medium tracking-wide text-zinc-200 placeholder-zinc-600 outline-none transition-all duration-300"
              />
            </div>

            {/* CONDITIONAL HANDLING FIELDS */}
            {!isLogin && (
              <div className="space-y-3.5 animate-form-reveal">
                
                {/* INPUT CHANNELS: EMAIL */}
                <div className="relative group/input rounded-xl overflow-hidden border border-zinc-800 bg-black transition-all duration-300 focus-within:border-zinc-700">
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-zinc-800 group-focus-within/input:bg-cyan-400 transition-colors duration-300" />
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4.5 text-zinc-500 group-focus-within/input:text-zinc-300 transition-colors duration-200">
                    <Mail className="h-4 w-4 stroke-[1.5]" />
                  </span>
                  <input
                    type="email"
                    placeholder="Email Address (optional)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setCurrentField("username")}
                    onBlur={() => setCurrentField("idle")}
                    className="w-full bg-transparent pl-13 pr-4 py-4 text-sm font-medium tracking-wide text-zinc-200 placeholder-zinc-600 outline-none transition-all duration-300"
                  />
                </div>

                {/* INPUT CHANNELS: MOBILE */}
                <div className="relative group/input rounded-xl overflow-hidden border border-zinc-800 bg-black transition-all duration-300 focus-within:border-zinc-700">
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-zinc-800 group-focus-within/input:bg-cyan-400 transition-colors duration-300" />
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4.5 text-zinc-500 group-focus-within/input:text-zinc-300 transition-colors duration-200">
                    <Phone className="h-4 w-4 stroke-[1.5]" />
                  </span>
                  <input
                    type="text"
                    placeholder="Mobile Number"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    onFocus={() => setCurrentField("username")}
                    onBlur={() => setCurrentField("idle")}
                    className="w-full bg-transparent pl-13 pr-4 py-4 text-sm font-medium tracking-wide text-zinc-200 placeholder-zinc-600 outline-none transition-all duration-300"
                  />
                </div>

              </div>
            )}

            {/* INPUT CHANNELS: PASSWORD */}
            <div className="relative group/input rounded-xl overflow-hidden border border-zinc-800 bg-black transition-all duration-300 focus-within:border-zinc-700">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-zinc-800 group-focus-within/input:bg-cyan-400 transition-colors duration-300" />
              <span className="absolute inset-y-0 left-0 flex items-center pl-4.5 text-zinc-500 group-focus-within/input:text-zinc-300 transition-colors duration-200">
                <Lock className="h-4 w-4 stroke-[1.5]" />
              </span>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setCurrentField("password")}
                onBlur={() => setCurrentField("idle")}
                className="w-full bg-transparent pl-13 pr-4 py-4 text-sm font-medium tracking-wide text-zinc-200 placeholder-zinc-600 outline-none transition-all duration-300"
              />
            </div>

          </div>

          {/* CORPORATE FLAT CONSOLE EXECUTION BUTTON */}
          <div className="mt-8 relative z-20">
            <button
              onClick={handleAuth}
              className="w-full bg-zinc-100 hover:bg-white text-black py-4 rounded-xl font-bold text-xs tracking-[0.2em] transition-all duration-300 active:scale-[0.99] flex items-center justify-center gap-2 shadow-[0_4px_30px_rgba(255,255,255,0.05)]"
            >
              <span>{isLogin ? "LOG IN" : "SIGN UP"}</span>
              <ArrowRight className="h-3.5 w-3.5 stroke-[2.5]" />
            </button>
          </div>

          {/* ALTERNATE LINK INTERACTION */}
          <div className="mt-8 text-center relative z-20 border-t border-zinc-900 pt-5">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-zinc-500 hover:text-zinc-400 font-medium text-[11px] tracking-wider uppercase transition-colors duration-200"
            >
              {isLogin ? "Create an account" : "Return to login handle"}
            </button>
          </div>

        </div>

      </div>

      {/* COMPACT CLEAN MOTION UTILITIES */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes swordEdge {
          0% { transform: translate(-35%, -35%) rotate(35deg); opacity: 0; }
          4% { opacity: 1; }
          20% { transform: translate(35%, 35%) rotate(35deg); opacity: 0; }
          100% { transform: translate(35%, 35%) rotate(35deg); opacity: 0; }
        }
        @keyframes swordFlare {
          0% { transform: translate(-35%, -35%) rotate(35deg); opacity: 0; }
          3% { opacity: 0; }
          7% { opacity: 1; }
          24% { transform: translate(35%, 35%) rotate(35deg); opacity: 0; }
          100% { transform: translate(35%, 35%) rotate(35deg); opacity: 0; }
        }
        .animate-sword-edge {
          animation: swordEdge 8s cubic-bezier(0.25, 1, 0.5, 1) infinite;
        }
        .animate-sword-flare {
          animation: swordFlare 8s cubic-bezier(0.25, 1, 0.5, 1) infinite;
        }
        @keyframes formReveal {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-form-reveal {
          animation: formReveal 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />
    </div>
  );
}