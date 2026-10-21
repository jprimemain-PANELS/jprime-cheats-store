"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShoppingBag, Wallet } from "lucide-react";
import {
  ACTIVITY_POLL_MS,
  describeActivity,
  formatInr,
  formatRelativeTime,
  isActivityEvent,
  type ActivityEvent,
} from "@/lib/recent-activity";

type Status = "loading" | "ready" | "error";

/** Ticker speed. Lower = slower. ~30px/s is a calm, readable crawl. */
const MARQUEE_PX_PER_SEC = 30;

/** Fixed sizes: every state (loading / ready / empty / error) has the same height, so nothing jumps. */
const CARD_H = "h-[56px]";
const ROW = "flex h-[66px] items-start gap-2.5 pt-2.5"; // 10px top space is where the LATEST badge sits

/* ------------------------------------------------------------------ */
/*  One event (icon + sentence + time)                                 */
/* ------------------------------------------------------------------ */
function EventBody({ event, now, pinned }: { event: ActivityEvent; now: number; pinned?: boolean }) {
  const isDeposit = event.kind === "deposit";
  const Icon = isDeposit ? Wallet : ShoppingBag;

  return (
    <>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
          isDeposit
            ? "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-300"
            : "border-violet-500/25 bg-violet-500/10 text-violet-300"
        }`}
        aria-hidden="true"
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[11.5px] leading-[1.25] text-zinc-400">
          <span className="font-semibold text-white">{event.user}</span>{" "}
          {isDeposit ? (
            <>
              added <span className="font-semibold text-fuchsia-300">{formatInr(event.amount ?? 0)}</span> to their
              wallet
            </>
          ) : (
            <>
              purchased <span className="font-semibold text-violet-200">{event.product}</span>
              {event.duration ? <> for {event.duration}</> : null}
            </>
          )}
        </p>
        <p className={`mt-0.5 text-[10px] font-medium ${pinned ? "text-fuchsia-300/90" : "text-zinc-500"}`}>
          {formatRelativeTime(event.at, now)}
        </p>
      </div>
    </>
  );
}

/** The newest event. Fixed on the left (it never scrolls) with a glowing LATEST badge. */
function PinnedLatest({ event, now, fresh }: { event: ActivityEvent; now: number; fresh: boolean }) {
  return (
    <div
      data-ra="pinned"
      title={`Latest: ${describeActivity(event)}`}
      className={`relative ${CARD_H} w-[196px] shrink-0 sm:w-[248px] ${
        fresh ? "animate-in fade-in zoom-in-95 duration-500 motion-reduce:animate-none" : ""
      }`}
    >
      <span className="absolute -top-2 left-2.5 z-10 flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-1.5 py-px text-[8px] font-bold uppercase leading-[12px] tracking-[0.16em] text-white shadow-[0_0_12px_rgba(217,70,239,0.65)]">
        <span className="relative flex h-1 w-1" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80 motion-reduce:animate-none" />
          <span className="relative inline-flex h-1 w-1 rounded-full bg-white" />
        </span>
        Latest
      </span>
      <div className="flex h-full items-center gap-2.5 rounded-xl border border-fuchsia-500/40 bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10 px-2.5 shadow-[0_0_22px_-8px_rgba(217,70,239,0.6)]">
        <EventBody event={event} now={now} pinned />
      </div>
    </div>
  );
}

/** An older event inside the scrolling ticker. */
function TickerCard({ event, now }: { event: ActivityEvent; now: number }) {
  return (
    <li
      title={describeActivity(event)}
      className={`mr-2 flex ${CARD_H} w-[200px] shrink-0 items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 sm:w-[236px]`}
    >
      <EventBody event={event} now={now} />
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  The slow right-to-left ticker                                      */
/* ------------------------------------------------------------------ */
function Ticker({ events, now }: { events: ActivityEvent[]; now: number }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const setRef = useRef<HTMLUListElement>(null);
  const [animate, setAnimate] = useState(false);
  const [setWidth, setSetWidth] = useState(0);

  useEffect(() => {
    const viewport = viewportRef.current;
    const set = setRef.current;
    if (!viewport || !set) return;

    const measure = () => {
      const w = set.scrollWidth;
      setSetWidth(w);
      setAnimate(w > viewport.clientWidth + 1);
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(viewport);
    ro.observe(set);
    return () => ro.disconnect();
  }, [events]);

  const signature = events.map((e) => e.key).join(",");
  const seconds = Math.max(12, setWidth / MARQUEE_PX_PER_SEC);

  return (
    <div data-ra="viewport" ref={viewportRef} className="ra-viewport relative min-w-0 flex-1 overflow-hidden">
      <div
        key={signature}
        className={`ra-track flex w-max ${animate ? "ra-moving" : ""}`}
        style={animate ? { animationDuration: `${seconds}s` } : undefined}
        data-moving={animate ? "true" : "false"}
      >
        <ul ref={setRef} data-ra="set" className="flex shrink-0">
          {events.map((event) => (
            <TickerCard key={event.key} event={event} now={now} />
          ))}
        </ul>
        {animate && (
          <ul data-ra="copy" aria-hidden="true" className="ra-copy flex shrink-0">
            {events.map((event) => (
              <TickerCard key={`copy-${event.key}`} event={event} now={now} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading / empty / error                                            */
/* ------------------------------------------------------------------ */
function SkeletonRow() {
  return (
    <div className={ROW} aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={`${CARD_H} ${
            i === 0 ? "w-[196px] sm:w-[248px]" : "w-[200px] sm:w-[236px]"
          } shrink-0 animate-pulse rounded-xl border border-white/5 bg-white/[0.02] px-2.5 motion-reduce:animate-none`}
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="flex h-full items-center gap-2.5">
            <span className="h-8 w-8 shrink-0 rounded-lg bg-white/[0.06]" />
            <div className="flex-1 space-y-1.5">
              <span className="block h-2 w-[85%] rounded bg-white/[0.07]" />
              <span className="block h-2 w-[55%] rounded bg-white/[0.05]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MessageRow({ title, text }: { title: string; text: string }) {
  return (
    <div className={ROW}>
      <div className={`flex ${CARD_H} w-full items-center gap-2.5 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3`}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-500">
          <Wallet className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-zinc-300">{title}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">{text}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Live Recent Activity strip.
 */
export function RecentActivity() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [freshKeys, setFreshKeys] = useState<Set<string>>(() => new Set());
  const [now, setNow] = useState(() => Date.now());

  const inflightRef = useRef(false);
  const lastFetchRef = useRef(0);
  const stoppedRef = useRef(false);
  const knownKeysRef = useRef<Set<string> | null>(null);
  const shownKeysRef = useRef("");
  const isMountedRef = useRef(true);

  const load = useCallback(async () => {
    if (inflightRef.current || stoppedRef.current || !isMountedRef.current) return;

    inflightRef.current = true;
    lastFetchRef.current = Date.now();

    try {
      const res = await fetch("/api/recent-activity", { cache: "no-store" });

      if (!isMountedRef.current) return;

      if (res.status === 401) {
        stoppedRef.current = true;
        setStatus("error");
        return;
      }

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success || !Array.isArray(json.events)) throw new Error("bad response");

      const next: ActivityEvent[] = json.events.filter(isActivityEvent);
      const signature = next.map((e) => e.key).join(",");

      if (signature !== shownKeysRef.current) {
        const known = knownKeysRef.current;
        setFreshKeys(known ? new Set(next.filter((e) => !known.has(e.key)).map((e) => e.key)) : new Set());
        knownKeysRef.current = new Set(next.map((e) => e.key));
        shownKeysRef.current = signature;
        setEvents(next);
      }

      setNow(Date.now());
      setStatus("ready");
    } catch {
      if (!isMountedRef.current) return;
      setStatus((prev) => (shownKeysRef.current ? prev : "error"));
    } finally {
      inflightRef.current = false;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    stoppedRef.current = false;
    void load();

    const poll = setInterval(() => {
      if (!document.hidden) void load();
    }, ACTIVITY_POLL_MS);

    const onVisible = () => {
      if (!document.hidden && Date.now() - lastFetchRef.current > 5_000) void load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      isMountedRef.current = false;
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);

  const hasEvents = events.length > 0 && (status === "ready" || status === "error");
  const latest = hasEvents ? events[0] : null;
  const older = hasEvents ? events.slice(1) : [];

  return (
    <section aria-label="Live recent activity" className="relative z-10 px-4 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-xl border border-violet-500/15 bg-[#0b0714]/70 shadow-[0_8px_30px_-20px_rgba(192,38,211,0.45)] backdrop-blur-md">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-3.5 pt-2.5 sm:px-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fuchsia-400/70 motion-reduce:animate-none" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-fuchsia-400" />
              </span>
              <h2 className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-orange-200 bg-clip-text text-[10px] font-bold uppercase tracking-[0.22em] text-transparent">
                Live Recent Activity
              </h2>
            </div>
            <span className="hidden text-[9px] font-medium uppercase tracking-wider text-zinc-600 sm:inline">
              Newest pinned &middot; older scrolling
            </span>
          </div>

          {/* Body */}
          <div className="px-3 pb-2.5 sm:px-3.5">
            {status === "loading" && <SkeletonRow />}

            {status === "ready" && events.length === 0 && (
              <MessageRow title="No recent activity yet" text="Completed wallet top-ups and purchases will appear here." />
            )}

            {status === "error" && events.length === 0 && (
              <MessageRow title="Activity feed is unavailable" text="We'll keep trying automatically." />
            )}

            {latest && (
              <div className={ROW}>
                <PinnedLatest event={latest} now={now} fresh={freshKeys.has(latest.key)} />
                {older.length > 0 && (
                  <>
                    <span className="mt-2.5 h-9 w-px shrink-0 self-start bg-white/10" aria-hidden="true" />
                    <Ticker events={older} now={now} />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes ra-marquee {
              from { transform: translate3d(0, 0, 0); }
              to   { transform: translate3d(-50%, 0, 0); }
            }
            /* right -> left, constant speed, seamless loop */
            .ra-moving { animation: ra-marquee linear infinite; will-change: transform; }
            /* hover (desktop) pauses it so a card can be read */
            .ra-viewport:hover .ra-moving { animation-play-state: paused; }
            /* soft fade at both edges */
            .ra-viewport {
              -webkit-mask-image: linear-gradient(to right, transparent 0, #000 12px, #000 calc(100% - 28px), transparent 100%);
              mask-image: linear-gradient(to right, transparent 0, #000 12px, #000 calc(100% - 28px), transparent 100%);
            }
            /* reduced-motion users: no animation, just a normal horizontally scrollable row */
            @media (prefers-reduced-motion: reduce) {
              .ra-moving { animation: none; }
              .ra-copy { display: none; }
              .ra-viewport { overflow-x: auto; scrollbar-width: none; }
              .ra-viewport::-webkit-scrollbar { display: none; }
            }
          `,
        }}
      />
    </section>
  );
}