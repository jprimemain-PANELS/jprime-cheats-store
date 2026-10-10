"use client";

import { useState, useEffect, useRef } from "react";
import { User, Lock, Phone, Mail, ArrowRight, Sparkles, UserPlus, LogIn } from "lucide-react";
import { Renderer, Program, Mesh, Triangle } from "ogl";

/* ==========================================================================
   FERROFLUID SHADER SYSTEM (BACKGROUND)
   ========================================================================== */
const MAX_COLORS = 8;

const hexToRGB = (hex: string) => {
  const c = hex.replace("#", "").padEnd(6, "0");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  return [r, g, b];
};

const prepColors = (input: string[]) => {
  const base = (
    input && input.length
      ? input
      : ["#c026d3", "#7c3aed", "#9333ea"]
  ).slice(0, MAX_COLORS);
  const count = base.length;
  const arr: number[][] = [];
  for (let i = 0; i < MAX_COLORS; i++)
    arr.push(hexToRGB(base[Math.min(i, base.length - 1)]));
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

/* ==========================================================================
   HUMPTY DUMPTY CHARACTER SITTING ON THE WALL BORDER
   ========================================================================== */
const SittingHumptyCharacter = ({ currentField }: { currentField: string }) => {
  return (
    <div className="w-48 h-48 mx-auto relative -mb-10 z-30 transition-all duration-300 pointer-events-none select-none">
      <svg viewBox="0 0 160 170" className="w-full h-full filter drop-shadow-[0_12px_28px_rgba(0,0,0,0.85)]">
        <defs>
          {/* Egg / Head Flesh Skin Gradient */}
          <radialGradient id="eggSkin" cx="40%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffedd5" />
            <stop offset="50%" stopColor="#fed7aa" />
            <stop offset="85%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ea580c" />
          </radialGradient>

          {/* Shirt Gradient */}
          <linearGradient id="shirtGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f1f5f9" />
          </linearGradient>

          {/* Pants / Trousers Gradient */}
          <linearGradient id="pantsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#86efac" />
            <stop offset="50%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>

          {/* Boots / Shoes */}
          <linearGradient id="shoeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#78350f" />
            <stop offset="100%" stopColor="#451a03" />
          </linearGradient>

          <filter id="humptyShadow">
            <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.5" />
          </filter>
        </defs>

        {/* --- LEGS DANGLING OVER WALL BORDER --- */}
        <g filter="url(#humptyShadow)">
          {/* Left Leg */}
          <path d="M 58,110 L 58,142 A 8,8 0 0,0 66,150 L 68,150" stroke="#16a34a" strokeWidth="12" strokeLinecap="round" fill="none" />
          <ellipse cx="64" cy="150" rx="9" ry="5" fill="url(#shoeGrad)" />

          {/* Right Leg */}
          <path d="M 102,110 L 102,142 A 8,8 0 0,0 110,150 L 112,150" stroke="#16a34a" strokeWidth="12" strokeLinecap="round" fill="none" />
          <ellipse cx="108" cy="150" rx="9" ry="5" fill="url(#shoeGrad)" />
        </g>

        {/* --- EGG BODY / TROUSERS --- */}
        <g filter="url(#humptyShadow)">
          {/* Round Bottom Trousers */}
          <path d="M 32,90 Q 30,118 80,118 Q 130,118 128,90 Z" fill="url(#pantsGrad)" />

          {/* Upper Shirt Torso */}
          <ellipse cx="80" cy="75" rx="46" ry="32" fill="url(#shirtGrad)" />

          {/* Big Round Egg Head/Body */}
          <ellipse cx="80" cy="55" rx="42" ry="38" fill="url(#eggSkin)" />
        </g>

        {/* --- SUSPENDERS & BOW TIE --- */}
        <g>
          {/* Left Strap */}
          <path d="M 56,60 L 54,105" stroke="#451a03" strokeWidth="3" fill="none" />
          {/* Right Strap */}
          <path d="M 104,60 L 106,105" stroke="#451a03" strokeWidth="3" fill="none" />

          {/* Bow Tie */}
          <polygon points="70,68 70,76 80,72" fill="#dc2626" />
          <polygon points="90,68 90,76 80,72" fill="#dc2626" />
          <circle cx="80" cy="72" r="3" fill="#991b1b" />
        </g>

        {/* --- ROSY CHEEKS --- */}
        <ellipse cx="54" cy="58" rx="6" ry="3.5" fill="#f43f5e" opacity="0.45" />
        <ellipse cx="106" cy="58" rx="6" ry="3.5" fill="#f43f5e" opacity="0.45" />

        {/* --- INTERACTIVE EYEBALLS --- */}
        {currentField === "password" ? (
          /* PASSWORD STATE: Hands Covering Eyes Nervous Expression */
          <g filter="url(#humptyShadow)">
            <path d="M 52,48 Q 60,38 68,48" stroke="#451a03" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M 92,48 Q 100,38 108,48" stroke="#451a03" strokeWidth="3" strokeLinecap="round" fill="none" />

            {/* Sweat drops */}
            <circle cx="56" cy="34" r="2.5" fill="#38bdf8" className="animate-ping" />
            <circle cx="104" cy="34" r="2.5" fill="#38bdf8" className="animate-ping" />
          </g>
        ) : currentField === "username" ? (
          /* USERNAME STATE: Looking Down Wide Eyes */
          <g filter="url(#humptyShadow)">
            <circle cx="62" cy="46" r="8" fill="#ffffff" />
            <circle cx="63" cy="49" r="4" fill="#0f172a" />
            <circle cx="62" cy="48" r="1.5" fill="#ffffff" />

            <circle cx="98" cy="46" r="8" fill="#ffffff" />
            <circle cx="97" cy="49" r="4" fill="#0f172a" />
            <circle cx="96" cy="48" r="1.5" fill="#ffffff" />
          </g>
        ) : (
          /* IDLE STATE: Smiling Eyeballs */
          <g filter="url(#humptyShadow)">
            <circle cx="62" cy="44" r="7" fill="#ffffff" />
            <circle cx="62" cy="44" r="3.5" fill="#0f172a" />
            <circle cx="60.5" cy="42.5" r="1.5" fill="#ffffff" />

            <circle cx="98" cy="44" r="7" fill="#ffffff" />
            <circle cx="98" cy="44" r="3.5" fill="#0f172a" />
            <circle cx="96.5" cy="42.5" r="1.5" fill="#ffffff" />
          </g>
        )}

        {/* --- INTERACTIVE MOUTH --- */}
        {currentField === "password" ? (
          <path d="M 68,64 Q 80,58 92,64" stroke="#451a03" strokeWidth="3" strokeLinecap="round" fill="none" />
        ) : currentField === "username" ? (
          <path d="M 66,60 Q 80,76 94,60 Z" fill="#9f1239" stroke="#451a03" strokeWidth="1.5" />
        ) : (
          <path d="M 68,60 Q 80,68 92,60" stroke="#451a03" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        )}

        {/* --- ARMS / HANDS DYNAMICS --- */}
        {currentField === "password" ? (
          /* Hands Raised Covering Eyes */
          <g filter="url(#humptyShadow)">
            <path d="M 36,78 Q 42,42 58,42" stroke="url(#eggSkin)" strokeWidth="8" strokeLinecap="round" fill="none" />
            <path d="M 124,78 Q 118,42 102,42" stroke="url(#eggSkin)" strokeWidth="8" strokeLinecap="round" fill="none" />
          </g>
        ) : currentField === "username" ? (
          /* Celebrating Waving Arms */
          <g filter="url(#humptyShadow)">
            <path d="M 36,78 Q 20,60 26,45" stroke="url(#eggSkin)" strokeWidth="7" strokeLinecap="round" fill="none" />
            <path d="M 124,78 Q 140,60 134,45" stroke="url(#eggSkin)" strokeWidth="7" strokeLinecap="round" fill="none" />
          </g>
        ) : (
          /* Resting Arms on Lap */
          <g filter="url(#humptyShadow)">
            <path d="M 36,78 Q 48,88 56,84" stroke="url(#eggSkin)" strokeWidth="7" strokeLinecap="round" fill="none" />
            <path d="M 124,78 Q 112,88 104,84" stroke="url(#eggSkin)" strokeWidth="7" strokeLinecap="round" fill="none" />
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

  const [currentField, setCurrentField] = useState("idle");

  async function handleAuth() {
    try {
      if (isLogin) {
        // The server verifies the password and sets an HttpOnly session cookie.
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
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
      } else {
        if (!mobileNumber.trim() || mobileNumber.length < 10) {
          alert("Enter valid mobile number");
          return;
        }

        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            password,
            email,
            mobile_number: mobileNumber,
          }),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result?.success) {
          alert(result?.error || "Could not create account.");
        } else {
          alert("Signup Success");
          setIsLogin(true);
        }
      }
    } catch {
      alert("Network error. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-[#07040f] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans antialiased selection:bg-fuchsia-500 selection:text-white">
      {/* Background Glow Blobs */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-violet-600/30 blur-[120px]" />
      <div className="pointer-events-none absolute top-40 -right-24 h-[260px] w-[260px] rounded-full bg-fuchsia-500/20 blur-[100px]" />

      {/* SHADER BACKGROUND */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <Ferrofluid
          colors={["#c026d3", "#7c3aed", "#e879f9"]}
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

      {/* MAIN CONTENT WRAPPER */}
      <div className="relative z-10 w-full max-w-md flex flex-col mt-2">
        
        {/* CHARACTER SITTING ON TOP WALL / CARD BORDER */}
        <SittingHumptyCharacter currentField={currentField} />

        {/* CARD CONTAINER (THE "WALL" TOP BORDER) */}
        <div className="bg-[#07040f]/85 backdrop-blur-2xl border border-white/10 rounded-3xl p-7 md:p-9 shadow-[0_40px_100px_rgba(0,0,0,0.9)] relative overflow-hidden group/card transition-all duration-500 hover:border-fuchsia-500/30">
          
          {/* Top Wall Border Accent Line */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500" />

          {/* BRAND TYPOGRAPHY */}
          <div className="text-center mb-6 relative z-20 select-none">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-md">
              <Sparkles className="h-3 w-3 text-fuchsia-400" />
              <span className="text-[10px] font-medium tracking-wider text-white/60 uppercase">
                JPRIME GLOBAL
              </span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight uppercase leading-none text-white">
              JPRIME{" "}
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-orange-300 bg-clip-text text-transparent">
                STORE
              </span>
            </h1>

            <p className="text-white/40 text-[10px] font-semibold uppercase tracking-[0.2em] mt-2.5">
              {isLogin ? "Authentication Protocol" : "Registration Protocol"}
            </p>
          </div>

          {/* FORM INPUTS */}
          <div className="space-y-3 relative z-20">
            {/* USERNAME */}
            <div className="relative group/input rounded-xl overflow-hidden border border-white/10 bg-white/[0.04] backdrop-blur-md transition-all duration-300 focus-within:border-fuchsia-500/60 focus-within:bg-white/[0.08]">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-white/10 group-focus-within/input:bg-gradient-to-b group-focus-within/input:from-violet-500 group-focus-within/input:to-fuchsia-500 transition-colors duration-300" />

              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-fuchsia-400/70 group-focus-within/input:text-fuchsia-300 transition-colors duration-200">
                <User className="h-4 w-4 stroke-[1.8]" />
              </span>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setCurrentField("username")}
                onBlur={() => setCurrentField("idle")}
                className="w-full bg-transparent pl-11 pr-4 py-3 text-sm font-medium tracking-wide text-white placeholder-white/30 outline-none transition-all duration-300"
              />
            </div>

            {/* CONDITIONAL SIGNUP FIELDS */}
            {!isLogin && (
              <div className="space-y-3 animate-form-reveal">
                {/* EMAIL */}
                <div className="relative group/input rounded-xl overflow-hidden border border-white/10 bg-white/[0.04] backdrop-blur-md transition-all duration-300 focus-within:border-fuchsia-500/60 focus-within:bg-white/[0.08]">
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-white/10 group-focus-within/input:bg-gradient-to-b group-focus-within/input:from-violet-500 group-focus-within/input:to-fuchsia-500 transition-colors duration-300" />
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-fuchsia-400/70 group-focus-within/input:text-fuchsia-300 transition-colors duration-200">
                    <Mail className="h-4 w-4 stroke-[1.8]" />
                  </span>
                  <input
                    type="email"
                    placeholder="Email Address (optional)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setCurrentField("username")}
                    onBlur={() => setCurrentField("idle")}
                    className="w-full bg-transparent pl-11 pr-4 py-3 text-sm font-medium tracking-wide text-white placeholder-white/30 outline-none transition-all duration-300"
                  />
                </div>

                {/* MOBILE */}
                <div className="relative group/input rounded-xl overflow-hidden border border-white/10 bg-white/[0.04] backdrop-blur-md transition-all duration-300 focus-within:border-fuchsia-500/60 focus-within:bg-white/[0.08]">
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-white/10 group-focus-within/input:bg-gradient-to-b group-focus-within/input:from-violet-500 group-focus-within/input:to-fuchsia-500 transition-colors duration-300" />
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-fuchsia-400/70 group-focus-within/input:text-fuchsia-300 transition-colors duration-200">
                    <Phone className="h-4 w-4 stroke-[1.8]" />
                  </span>
                  <input
                    type="text"
                    placeholder="Mobile Number"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    onFocus={() => setCurrentField("username")}
                    onBlur={() => setCurrentField("idle")}
                    className="w-full bg-transparent pl-11 pr-4 py-3 text-sm font-medium tracking-wide text-white placeholder-white/30 outline-none transition-all duration-300"
                  />
                </div>
              </div>
            )}

            {/* PASSWORD */}
            <div className="relative group/input rounded-xl overflow-hidden border border-white/10 bg-white/[0.04] backdrop-blur-md transition-all duration-300 focus-within:border-fuchsia-500/60 focus-within:bg-white/[0.08]">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-white/10 group-focus-within/input:bg-gradient-to-b group-focus-within/input:from-violet-500 group-focus-within/input:to-fuchsia-500 transition-colors duration-300" />
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-fuchsia-400/70 group-focus-within/input:text-fuchsia-300 transition-colors duration-200">
                <Lock className="h-4 w-4 stroke-[1.8]" />
              </span>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setCurrentField("password")}
                onBlur={() => setCurrentField("idle")}
                className="w-full bg-transparent pl-11 pr-4 py-3 text-sm font-medium tracking-wide text-white placeholder-white/30 outline-none transition-all duration-300"
              />
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="mt-6 relative z-20">
            <button
              onClick={handleAuth}
              className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white py-3.5 rounded-xl font-bold text-xs tracking-[0.2em] transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 shadow-[0_8px_30px_-6px_rgba(192,38,211,0.6)] cursor-pointer"
            >
              <span>{isLogin ? "LOG IN" : "SIGN UP"}</span>
              <ArrowRight className="h-3.5 w-3.5 stroke-[2.5]" />
            </button>
          </div>

          {/* PROMINENT HIGH-VISIBILITY CREATE ACCOUNT CALLOUT CARD */}
          <div className="mt-6 relative z-20 border-t border-white/10 pt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 text-center backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div className="text-left">
                <span className="block text-xs font-bold text-white">
                  {isLogin ? "Don't have an account?" : "Already registered?"}
                </span>
                <span className="text-[11px] text-white/50">
                  {isLogin ? "Join 10,000+ active users today." : "Log back into your account."}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 px-3.5 py-2 text-xs font-bold text-fuchsia-300 transition-all hover:bg-fuchsia-500/20 hover:border-fuchsia-500/60 active:scale-95 cursor-pointer shrink-0"
              >
                {isLogin ? (
                  <>
                    <UserPlus className="h-3.5 w-3.5" />
                    Create One
                  </>
                ) : (
                  <>
                    <LogIn className="h-3.5 w-3.5" />
                    Log In
                  </>
                )}
              </button>
            </div>
          </div>

        </div>
      </div>

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
      `,
        }}
      />
    </div>
  );
}