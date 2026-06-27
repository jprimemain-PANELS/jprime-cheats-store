"use client";

import { useEffect, useRef } from "react";
import { Apple, MessageCircle, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Renderer, Program, Mesh, Triangle, Color } from "ogl";

/* ==========================================================================
   THREADS SHADER SYSTEM (INTERACTIVE BACKGROUND)
   ========================================================================== */
const vertexShader = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform float iTime;
uniform vec3 iResolution;
uniform vec3 uColor;
uniform float uAmplitude;
uniform float uDistance;
uniform vec2 uMouse;

#define PI 3.1415926538

const int u_line_count = 40;
const float u_line_width = 7.0;
const float u_line_blur = 10.0;

float Perlin2D(vec2 P) {
    vec2 Pi = floor(P);
    vec4 Pf_Pfmin1 = P.xyxy - vec4(Pi, Pi + 1.0);
    vec4 Pt = vec4(Pi.xy, Pi.xy + 1.0);
    Pt = Pt - floor(Pt * (1.0 / 71.0)) * 71.0;
    Pt += vec2(26.0, 161.0).xyxy;
    Pt *= Pt;
    Pt = Pt.xzxz * Pt.yyww;
    vec4 hash_x = fract(Pt * (1.0 / 951.135664));
    vec4 hash_y = fract(Pt * (1.0 / 642.949883));
    vec4 grad_x = hash_x - 0.49999;
    vec4 grad_y = hash_y - 0.49999;
    vec4 grad_results = inversesqrt(grad_x * grad_x + grad_y * grad_y)
        * (grad_x * Pf_Pfmin1.xzxz + grad_y * Pf_Pfmin1.yyww);
    grad_results *= 1.4142135623730950;
    vec2 blend = Pf_Pfmin1.xy * Pf_Pfmin1.xy * Pf_Pfmin1.xy
               * (Pf_Pfmin1.xy * (Pf_Pfmin1.xy * 6.0 - 15.0) + 10.0);
    vec4 blend2 = vec4(blend, vec2(1.0 - blend));
    return dot(grad_results, blend2.zxzx * blend2.wwyy);
}

float pixel(float count, vec2 resolution) {
    return (1.0 / max(resolution.x, resolution.y)) * count;
}

float lineFn(vec2 st, float width, float perc, float offset, vec2 mouse, float time, float amplitude, float distance) {
    float split_offset = (perc * 0.4);
    float split_point = 0.1 + split_offset;

    float amplitude_normal = smoothstep(split_point, 0.7, st.x);
    float amplitude_strength = 0.5;
    float finalAmplitude = amplitude_normal * amplitude_strength
                           * amplitude * (1.0 + (mouse.y - 0.5) * 0.2);

    float time_scaled = time / 10.0 + (mouse.x - 0.5) * 1.0;
    float blur = smoothstep(split_point, split_point + 0.05, st.x) * perc;

    float xnoise = mix(
        Perlin2D(vec2(time_scaled, st.x + perc) * 2.5),
        Perlin2D(vec2(time_scaled, st.x + time_scaled) * 3.5) / 1.5,
        st.x * 0.3
    );

    float y = 0.5 + (perc - 0.5) * distance + xnoise / 2.0 * finalAmplitude;

    float line_start = smoothstep(
        y + (width / 2.0) + (u_line_blur * pixel(1.0, iResolution.xy) * blur),
        y,
        st.y
    );

    float line_end = smoothstep(
        y,
        y - (width / 2.0) - (u_line_blur * pixel(1.0, iResolution.xy) * blur),
        st.y
    );

    return clamp(
        (line_start - line_end) * (1.0 - smoothstep(0.0, 1.0, pow(perc, 0.3))),
        0.0,
        1.0
    );
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    float line_strength = 1.0;
    for (int i = 0; i < u_line_count; i++) {
        float p = float(i) / float(u_line_count);
        line_strength *= (1.0 - lineFn(
            uv,
            u_line_width * pixel(1.0, iResolution.xy) * (1.0 - p),
            p,
            (PI * 1.0) * p,
            uMouse,
            iTime,
            uAmplitude,
            uDistance
        ));
    }

    float colorVal = 1.0 - line_strength;
    fragColor = vec4(uColor * colorVal, colorVal);
}

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;

function ThreadsBackground({ color = [0.02, 0.71, 0.84], amplitude = 1, distance = 0, enableMouseInteraction = true }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef(0);
  const propsRef = useRef({ color, amplitude, distance, enableMouseInteraction });
  propsRef.current = { color, amplitude, distance, enableMouseInteraction };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new Renderer({ alpha: true });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    container.appendChild(gl.canvas);

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        iTime: { value: 0 },
        iResolution: {
          value: new Color(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height)
        },
        uColor: { value: new Color(...propsRef.current.color) },
        uAmplitude: { value: propsRef.current.amplitude },
        uDistance: { value: propsRef.current.distance },
        uMouse: { value: new Float32Array([0.5, 0.5]) }
      }
    });

    const mesh = new Mesh(gl, { geometry, program });
    const MAX_RENDER_DIM = 1920;

    function resize() {
      if (!container) return;
      const { clientWidth, clientHeight } = container;
      const baseDpr = Math.min(window.devicePixelRatio || 1, 2);
      const longestSide = Math.max(clientWidth, clientHeight) * baseDpr;
      const dpr = longestSide > MAX_RENDER_DIM ? (baseDpr * MAX_RENDER_DIM) / longestSide : baseDpr;
      renderer.dpr = dpr;
      renderer.setSize(clientWidth, clientHeight);
      program.uniforms.iResolution.value.r = gl.canvas.width;
      program.uniforms.iResolution.value.g = gl.canvas.height;
      program.uniforms.iResolution.value.b = gl.canvas.width / gl.canvas.height;
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    window.addEventListener('resize', resize);
    resize();

    const currentMouse = [0.5, 0.5];
    let targetMouse = [0.5, 0.5];

    function handleMouseMove(e: MouseEvent) {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height;
      targetMouse = [x, y];
    }
    function handleMouseLeave() {
      targetMouse = [0.5, 0.5];
    }
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    let isVisible = true;
    const intersectionObserver = new IntersectionObserver(
      entries => {
        isVisible = entries[0].isIntersecting;
      },
      { threshold: 0 }
    );
    intersectionObserver.observe(container);

    function update(t: number) {
      animationFrameId.current = requestAnimationFrame(update);
      if (!isVisible || document.hidden) return;

      const { color, amplitude, distance, enableMouseInteraction } = propsRef.current;

      program.uniforms.uColor.value.set(...color);
      program.uniforms.uAmplitude.value = amplitude;
      program.uniforms.uDistance.value = distance;

      if (enableMouseInteraction) {
        const smoothing = 0.05;
        currentMouse[0] += smoothing * (targetMouse[0] - currentMouse[0]);
        currentMouse[1] += smoothing * (targetMouse[1] - currentMouse[1]);
        program.uniforms.uMouse.value[0] = currentMouse[0];
        program.uniforms.uMouse.value[1] = currentMouse[1];
      } else {
        program.uniforms.uMouse.value[0] = 0.5;
        program.uniforms.uMouse.value[1] = 0.5;
      }
      program.uniforms.iTime.value = t * 0.001;

      renderer.render({ scene: mesh });
    }
    animationFrameId.current = requestAnimationFrame(update);

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener('resize', resize);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      if (container.contains(gl.canvas)) container.removeChild(gl.canvas);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none" />;
}

/* ==========================================================================
   MAIN COMING SOON DISPLAY ELEMENT
   ========================================================================== */
export function ComingSoon() {
  return (
    <Card className="relative overflow-hidden border border-zinc-800/60 bg-[#050608]/90 backdrop-blur-2xl p-8 md:p-14 rounded-3xl shadow-[0_40px_100px_rgba(0,0,0,0.85)] group/card transition-all duration-500 hover:border-zinc-700/60">
      
      {/* ================= INTEGRATED THREAD SHADER BACKGROUND ================= */}
      <div className="absolute inset-0 opacity-40 z-0">
        <ThreadsBackground 
          color={[0.02, 0.71, 0.84]} 
          amplitude={1.2} 
          distance={0.1} 
          enableMouseInteraction={true} 
        />
      </div>

      {/* AMBIENT COMPLEMENTARY GLOW CORE */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-cyan-500/[0.03] rounded-full blur-[90px]" />
      </div>

      {/* CORE DISPLAY STACK */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-lg mx-auto select-none">
        
        {/* PREMIUM STRUCTURAL ICON CONTAINER */}
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-black border border-zinc-800 relative group/icon mb-6 shadow-inner transition-all duration-300 group-hover/card:border-zinc-700">
          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-zinc-800 group-hover/card:bg-cyan-400 transition-colors duration-300" />
          <Apple className="h-9 w-9 text-zinc-200 stroke-[1.25]" />
        </div>

        {/* HIGH-CONTRAST PROFESSIONAL BADGE */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-950 border border-zinc-800/80 mb-5">
          <Sparkles className="h-3 w-3 text-cyan-400" />
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] pl-0.5">Coming Soon</span>
        </div>

        {/* MINIMAL HIGH-END BRAND HEADMARK */}
        <h3 className="text-3xl font-light tracking-[0.25em] text-white/95 uppercase pl-[0.25em] leading-none mb-4">
          iOS Panel
        </h3>

        {/* BALANCED ARCHITECTURAL COPYTEXT */}
        <p className="text-zinc-400 font-medium text-xs md:text-sm tracking-wide leading-relaxed max-w-sm mb-9">
          Premium iOS main id safe private panel available. Contact us for customized private panels.
        </p>

        {/* CORPORATE CONSOLE BUTTON SCHEME */}
        <div className="flex flex-col sm:flex-row gap-3.5 w-full sm:w-auto">
          <Button
            className="bg-zinc-100 hover:bg-white text-black h-12 px-6 rounded-xl font-bold text-xs tracking-wider uppercase transition-all duration-300 active:scale-[0.99] shadow-md flex items-center justify-center"
            onClick={() => window.open("https://t.me/JPRIMEADMIN", "_blank")}
          >
            <MessageCircle className="h-4 w-4 mr-2.5 stroke-[2]" />
            Contact for Custom iOS
          </Button>
          
          <Button
            variant="outline"
            className="bg-black hover:bg-zinc-950 text-zinc-300 hover:text-white border-zinc-800 hover:border-zinc-700 h-12 px-6 rounded-xl font-bold text-xs tracking-wider uppercase transition-all duration-300 active:scale-[0.99]"
            onClick={() => window.open("https://t.me/JPRIMEADMIN", "_blank")}
          >
            Custom PC Panel
          </Button>
        </div>
      </div>
    </Card>
  );
}