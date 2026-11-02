"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, VideoOff } from "lucide-react";

/**
 * ProductVideo
 * - Normal links (Supabase, Cloudinary, Bunny, R2, any .mp4/.webm/.mov) -> <video controls>
 * - YouTube links (watch / youtu.be / shorts / embed / live) -> custom-styled player
 *   (own thumbnail + own play/pause button, YouTube title/controls/suggestions hidden)
 * - If a video fails to load -> friendly placeholder instead of a broken black box
 */

function getYouTubeId(raw: string): string | null {
  const url = raw.trim();
  if (/^[\w-]{11}$/.test(url)) return url; // plain video id

  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");

    if (host === "youtu.be") {
      const id = u.pathname.split("/")[1];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const v = u.searchParams.get("v");
      if (v && /^[\w-]{11}$/.test(v)) return v;

      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
      if (m) return m[1];
    }
  } catch {
    /* not a valid URL */
  }
  return null;
}

function Unavailable() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-violet-950/30 to-black/60">
      <VideoOff className="h-8 w-8 text-white/40" />
      <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
        Video unavailable
      </span>
    </div>
  );
}

function YouTubePlayer({ videoId }: { videoId: string }) {
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const send = (func: string) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args: [] }),
      "*"
    );
  };

  // Listen to player state so our custom button always matches the real state
  useEffect(() => {
    if (!started) return;

    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data?.event === "onStateChange") {
          setPlaying(data.info === 1);
          // video ended -> go back to our own thumbnail (hides YT "more videos")
          if (data.info === 0) setStarted(false);
        } else if (
          data?.event === "infoDelivery" &&
          typeof data.info?.playerState === "number"
        ) {
          const s = data.info.playerState;
          setPlaying(s === 1);
          if (s === 0) setStarted(false);
        }
      } catch {
        /* ignore */
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [started]);

  const toggle = () => {
    if (!started) {
      setStarted(true);
      setPlaying(true);
      return;
    }
    send(playing ? "pauseVideo" : "playVideo");
    setPlaying((p) => !p);
  };

  const params = new URLSearchParams({
    autoplay: "1",
    controls: "0",
    modestbranding: "1",
    rel: "0",
    playsinline: "1",
    disablekb: "1",
    fs: "0",
    iv_load_policy: "3",
    enablejsapi: "1",
  });

  return (
    <div className="absolute inset-0 bg-black">
      {started ? (
        <iframe
          ref={iframeRef}
          src={`https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`}
          title="Product demo"
          allow="autoplay; encrypted-media; picture-in-picture"
          className="pointer-events-none absolute inset-0 h-full w-full scale-[1.02] border-0"
          onLoad={() => {
            // subscribe to state-change events
            iframeRef.current?.contentWindow?.postMessage(
              JSON.stringify({ event: "listening", id: 1, channel: "widget" }),
              "*"
            );
          }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      )}

      {/* Our own click layer + play/pause button (YouTube UI can't be clicked) */}
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause video" : "Play video"}
        className="group absolute inset-0 z-10 flex items-center justify-center"
      >
        <span
          className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-fuchsia-500/40 bg-fuchsia-500/25 backdrop-blur-md shadow-[0_0_20px_rgba(192,38,211,0.4)] transition-all duration-300 group-hover:scale-110 ${
            playing ? "opacity-0 group-hover:opacity-100" : "opacity-100"
          }`}
        >
          {playing ? (
            <Pause className="h-6 w-6 text-fuchsia-200" />
          ) : (
            <Play className="ml-1 h-6 w-6 text-fuchsia-200" />
          )}
        </span>
      </button>
    </div>
  );
}

export function ProductVideo({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [url]);

  const ytId = getYouTubeId(url);
  if (ytId) return <YouTubePlayer videoId={ytId} />;

  if (failed) return <Unavailable />;

  return (
    <video
      key={url}
      controls
      playsInline
      preload="metadata"
      src={url}
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}