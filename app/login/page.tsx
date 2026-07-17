"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { User, Lock, Phone, Mail, ArrowRight } from "lucide-react";
import { Renderer, Program, Mesh, Triangle } from "ogl";

/* ==========================================================================
   LIGHTFALL SHADER SYSTEM (INTERACTIVE & MOBILE COMPATIBLE BACKGROUND)
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
  const base = (input && input.length ? input : ["#A6C8FF", "#5227FF", "#FF9FFC"]).slice(0, MAX_COLORS);
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

uniform vec3  uBgColor;
uniform vec3  uMouseColor;
uniform float uSpeed;
uniform int   uStreakCount;
uniform float uStreakWidth;
uniform float uStreakLength;
uniform float uGlow;
uniform float uDensity;
uniform float uTwinkle;
uniform float uZoom;
uniform float uBgGlow;
uniform float uOpacity;
uniform float uMouseEnabled;
uniform float uMouseStrength;
uniform float uMouseRadius;

varying vec2 vUv;

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

vec3 tanhv(vec3 x) {
  vec3 e = exp(-2.0 * x);
  return (1.0 - e) / (1.0 + e);
}

vec2 sceneC(vec2 frag, vec2 r) {
  vec2 P = (frag + frag - r) / r.x;
  float z = 0.0;
  float d = 1e3;
  vec4 O = vec4(0.0);
  for (int k = 0; k < 39; k++) {
    if (d <= 1e-4) break;
    O = z * normalize(vec4(P, uZoom, 0.0)) - vec4(0.0, 4.0, 1.0, 0.0) / 4.5;
    d = 1.0 - sqrt(length(O * O));
    z += d;
  }
  return vec2(O.x, atan(O.z, O.y));
}

void mainImage(out vec4 o, vec2 C) {
  vec2 r = iResolution.xy;
  vec2 uv0 = (C + C - r) / r.x;
  float T = 0.1 * iTime * uSpeed + 9.0;
  float angRings = max(1.0, floor(6.28318530718 * max(uDensity, 0.05) + 0.5));
  vec2 Y = vec2(5e-3, 6.28318530718 / angRings);

  vec2 c0 = sceneC(C, r);
  vec2 cdx = sceneC(C + vec2(1.0, 0.0), r);
  vec2 cdy = sceneC(C + vec2(0.0, 1.0), r);
  vec2 dCx = cdx - c0;
  vec2 dCy = cdy - c0;
  dCx.y -= 6.28318530718 * floor(dCx.y / 6.28318530718 + 0.5);
  dCy.y -= 6.28318530718 * floor(dCy.y / 6.28318530718 + 0.5);
  vec2 fw = abs(dCx) + abs(dCy);
  C = c0;

  vec2 P = vec2(2.0, 1.0) * uv0 - (r / r.x) * vec2(0.0, 1.0);
  vec4 O = vec4(uBgColor * 90.0 * uBgGlow / (1e3 * dot(P, P) + 6.0), 0.0);

  float mGlow = 0.0;
  if (uMouseEnabled > 0.5) {
    vec2 mN = (iMouse + iMouse - r) / r.x;
    float md = length(uv0 - mN);
    mGlow = exp(-md * md / max(uMouseRadius * uMouseRadius, 1e-4)) * uMouseStrength;
    O.rgb += uMouseColor * mGlow * 0.25;
  }

  float zr = 5e-4 * uStreakWidth;
  vec2 rr = vec2(max(length(fw), 1e-5));
  float tail = 19.0 / max(uStreakLength, 0.05);

  for (int m = 0; m < 16; m++) {
    if (m >= uStreakCount) break;
    float jf = float(m) + 1.0;
    float ic = fract(sin(dot(vec2(jf, floor(C.x / Y.x + 0.5)), vec2(7.0, 11.0)) * 73.0));
    vec2 Pp = C - (T + T * ic) * vec2(0.0, 1.0);
    Pp -= floor(Pp / Y + 0.5) * Y;
    float h = fract(8663.0 * ic);
    vec3 col = palette(h);
    float weight = mix(1.5, 1.0 + sin(T + 7.0 * h + 4.0), uTwinkle);
    weight *= (1.0 + mGlow * 2.0);
    vec2 inner = vec2(length(max(Pp, vec2(-1.0, 0.0))), length(Pp) - zr) - zr;
    vec2 sm = vec2(1.0) - smoothstep(-rr, rr, inner);
    O.rgb += dot(sm, vec2(exp(tail * Pp.y), 3.0)) * col * weight;
    C.x += Y.x / 8.0;
  }

  vec3 colr = sqrt(tanhv(max(O.rgb * uGlow - vec3(0.04, 0.08, 0.02), 0.0)));
  o = vec4(colr, uOpacity);
}

void main() {
  vec4 color;
  mainImage(color, vUv * iResolution.xy);
  gl_FragColor = color;
}
`;

const Lightfall = ({
  className,
  dpr,
  paused = false,
  colors = ["#06b6d4", "#3b82f6", "#000000"],
  backgroundColor = "#020204",
  speed = 0.5,
  streakCount = 2,
  streakWidth = 1,
  streakLength = 1,
  glow = 1,
  density = 0.6,
  twinkle = 1,
  zoom = 3,
  backgroundGlow = 0.5,
  opacity = 1,
  mouseInteraction = true,
  mouseStrength = 0.5,
  mouseRadius = 1,
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
      uBgColor: { value: hexToRGB(backgroundColor) },
      uMouseColor: { value: avg },
      uSpeed: { value: speed },
      uStreakCount: { value: Math.max(1, Math.min(16, Math.round(streakCount))) },
      uStreakWidth: { value: streakWidth },
      uStreakLength: { value: streakLength },
      uGlow: { value: glow },
      uDensity: { value: density },
      uTwinkle: { value: twinkle },
      uZoom: { value: zoom },
      uBgGlow: { value: backgroundGlow },
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
      const scale = renderer.dpr || 1;
      const x = (e.clientX - rect.left) * scale;
      const y = (rect.height - (e.clientY - rect.top)) * scale;
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
        if (obj && typeof obj[key] === "function") {
          obj[key].call(obj);
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
    backgroundColor,
    speed,
    streakCount,
    streakWidth,
    streakLength,
    glow,
    density,
    twinkle,
    zoom,
    backgroundGlow,
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
        <Lightfall
          colors={["#06b6d4", "#2563eb", "#020204"]}
          backgroundColor="#020204"
          speed={0.4}
          streakCount={3}
          streakWidth={1.2}
          streakLength={1.5}
          glow={1.2}
          density={0.5}
          twinkle={1}
          zoom={2.5}
          backgroundGlow={0.3}
          opacity={1}
          mouseInteraction={true}
          mouseStrength={0.6}
          mouseRadius={1.2}
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