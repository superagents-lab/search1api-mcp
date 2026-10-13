/*! Adapted from Rare UI Web Search — https://rareui.com/components/websearch
 * Copyright (c) 2026 Swami Malode. MIT + Commons Clause + Attribution.
 * See THIRD_PARTY_NOTICES.md for the complete third-party license.
 */
"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
  type Variants,
} from "motion/react";
import { cn } from "@/lib/utils";

export type WebSearchStatus = "searching" | "done";

export type WebSource = {
  id: string;
  title: string;
  url: string;
  snippet?: string;
  favicon?: string;
};

const COLUMNS = 4;
const STACK = 4;
// hover waits a beat before acting, so a pointer just passing through never triggers it
const SPREAD_DELAY = 150;
const PREVIEW_DELAY = 300;
const LEAVE_DELAY = 150;

const SWAP: Transition = { type: "spring", duration: 0.55, bounce: 0.1 };
const POP: Transition = { type: "spring", duration: 0.5, bounce: 0.4 };
const SPREAD: Transition = { type: "spring", duration: 0.35, bounce: 0 };
const OPEN: Transition = { type: "spring", duration: 0.5, bounce: 0.08 };
const CARD: Transition = { type: "spring", duration: 0.5, bounce: 0.1 };
const STAGGER = 0.045;
const INSTANT: Transition = { duration: 0 };

const swapVariants: Variants = {
  enter: { y: 6, opacity: 0, filter: "blur(3px)" },
  center: { y: 0, opacity: 1, filter: "blur(0px)" },
  exit: { y: -6, opacity: 0, filter: "blur(3px)" },
};

const cardVariants: Variants = {
  enter: { opacity: 0, y: 8, scale: 0.97, filter: "blur(6px)" },
  center: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 0.97, filter: "blur(4px)" },
};

// the highlight sits mid gradient and the size leaves room either side, so each sweep starts off screen
const SHIMMER =
  "linear-gradient(90deg, var(--web-search-ink) 40%, var(--web-search-shine) 50%, var(--web-search-ink) 60%)";

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const RING_CIRCLE = { ...STROKE, cx: 14, cy: 14, r: 13, strokeWidth: 1.5 };

const hash = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  }
  return h >>> 0;
};

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

// without an href an anchor keeps its look but goes nowhere, for previews that shouldn't send visitors away
const linkTo = (url: string, linked: boolean) =>
  linked ? { href: url, target: "_blank", rel: "noreferrer" } : {};

// developer.mozilla.org reads as "mozilla", the way people say it
const siteName = (url: string) => {
  const parts = hostOf(url).split(".");
  return parts.length > 1 ? parts[parts.length - 2] : parts[0];
};

export type WebSearchProps = Omit<ComponentProps<"div">, "children"> & {
  sources: WebSource[];
  status?: WebSearchStatus;
  query?: string;
  label?: string;
  linked?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Set false to report content size immediately to an MCP Apps host. */
  animateHeight?: boolean;
  /** Set false to show completed results immediately, including expansion and reopening. */
  appear?: boolean;
  expandable?: boolean;
  columns?: 2 | 4;
};

function WebSearch({
  sources,
  status = "done",
  query,
  label,
  linked = true,
  open,
  defaultOpen = true,
  onOpenChange,
  animateHeight = true,
  appear = true,
  expandable = true,
  columns,
  className,
  ...props
}: WebSearchProps) {
  const reduced = !!useReducedMotion();
  const [openState, setOpenState] = useState(defaultOpen);
  const [expanded, setExpanded] = useState(false);
  const [measureRef, labelWidth] = useSize<HTMLSpanElement>("width");

  const searching = status === "searching";
  const isOpen = open ?? openState;
  const count = sources.length;
  const text =
    label ??
    (searching
      ? query
        ? `Searching “${query}”`
        : "Searching the web"
      : `Searched ${count} ${count === 1 ? "site" : "sites"}`);

  // the last slot belongs to the more card from the fourth result on, so no card ever has to turn into it
  const overflow = expandable && !expanded && count >= COLUMNS;
  const shown = overflow ? sources.slice(0, COLUMNS - 1) : sources;
  const hidden = overflow ? sources.slice(COLUMNS - 1) : [];
  // empty slots keep the first row full while results are still landing
  const skeletons = searching && !overflow ? Math.max(0, COLUMNS - count) : 0;

  const toggle = () => {
    const next = !isOpen;
    if (open === undefined) setOpenState(next);
    onOpenChange?.(next);
  };

  const swap = reduced || !appear ? INSTANT : SWAP;
  // after expanding, the stagger starts at the first card that was hidden
  const stagger = (i: number): Transition =>
    reduced
      ? INSTANT
      : {
          ...CARD,
          delay: Math.max(0, i - (expanded ? COLUMNS - 1 : 0)) * STAGGER,
        };

  const cell = (key: string, i: number, child: ReactNode) => !appear ? (
    <li key={key} className="group/card">{child}</li>
  ) : (
    <motion.li
      key={key}
      className="group/card"
      layout={!reduced}
      variants={cardVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={stagger(i)}
    >
      {child}
    </motion.li>
  );

  return (
    <div
      data-slot="web-search"
      data-status={status}
      data-open={isOpen || undefined}
      className={cn(
        "flex w-[560px] max-w-full flex-col font-runde text-black dark:text-white",
        className,
      )}
      {...props}
    >
      <button
        type="button"
        data-slot="web-search-trigger"
        disabled={searching}
        onClick={toggle}
        aria-expanded={searching ? undefined : isOpen}
        className="group flex h-10 w-fit max-w-full cursor-pointer disabled:cursor-default items-center gap-2.5 rounded-full bg-[#F4F4F9] pl-1.5 pr-3.5 text-left outline-none transition-[background-color,box-shadow] hover:bg-white hover:shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.04),0_2px_4px_-1px_rgba(0,0,0,0.08)] dark:hover:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#868593] dark:bg-[#1C1C1C] dark:hover:bg-[#232323]"
      >
        <SearchTile searching={searching} reduced={reduced} />

        {/* the label springs between widths, so the icons beside it glide instead of jumping */}
        <motion.span
          aria-live="polite"
          className="relative grid min-w-0 overflow-x-clip"
          initial={false}
          animate={{ width: labelWidth ?? "auto" }}
          transition={swap}
        >
          <span
            ref={measureRef}
            aria-hidden
            className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap text-[14px] font-semibold"
          >
            {text}
          </span>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={text}
              variants={swapVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={swap}
              className="truncate whitespace-nowrap text-[14px] font-semibold"
            >
              {searching ? <Shimmer reduced={reduced}>{text}</Shimmer> : text}
            </motion.span>
          </AnimatePresence>
        </motion.span>

        {!searching && <FaviconStack sources={sources} reduced={reduced} />}

        {!searching && <motion.span
          className="-ml-0.5 shrink-0 text-[#868593] transition-colors group-hover:text-black dark:group-hover:text-white"
          initial={false}
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={reduced ? INSTANT : OPEN}
        >
          <Chevron />
        </motion.span>}
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (count > 0 || searching) && (
          <Collapse key="sources" reduced={reduced} animateHeight={animateHeight}>
            <ol
              data-slot="web-search-sources"
              style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
              className="relative grid grid-cols-2 gap-2 pt-2.5 sm:grid-cols-4"
            >
              <AnimatePresence mode="popLayout">
                {shown.map((source, i) =>
                  cell(
                    source.id,
                    i,
                    <SourceCard
                      source={source}
                      linked={linked}
                    />,
                  ),
                )}
                {Array.from({ length: skeletons }, (_, i) => (
                  <motion.li
                    key={`skeleton-${count + i}`}
                    aria-hidden
                    layout={!reduced}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={stagger(count + i)}
                  >
                    <SkeletonCard reduced={reduced} delay={i * 0.12} />
                  </motion.li>
                ))}
                {hidden.length > 0 &&
                  cell(
                    "more",
                    COLUMNS - 1,
                    <MoreCard
                      sources={hidden}
                      onClick={() => setExpanded(true)}
                      reduced={reduced}
                    />,
                  )}
                {expanded &&
                  count >= COLUMNS &&
                  cell(
                    "less",
                    count,
                    <button
                      type="button"
                      onClick={() => setExpanded(false)}
                      className={cn(
                        CARD_SHELL,
                        "group flex-row items-center justify-center gap-1.5 bg-transparent text-[12.5px] font-semibold text-[#868593] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.07)] group-hover/card:translate-y-0 hover:bg-[#F4F4F9] hover:text-black hover:shadow-none dark:bg-transparent dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] dark:hover:bg-[#1C1C1C] dark:hover:text-white",
                      )}
                    >
                      <Chevron className="-ml-0.5 rotate-180 transition-transform duration-200 group-hover:-translate-y-px" />
                      Show less
                    </button>,
                  )}
              </AnimatePresence>
            </ol>
          </Collapse>
        )}
      </AnimatePresence>
    </div>
  );
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={14}
      height={14}
      {...STROKE}
      strokeWidth={2.6}
      className={cn("block", className)}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Collapse({
  reduced,
  animateHeight,
  children,
}: {
  reduced: boolean;
  animateHeight: boolean;
  children: ReactNode;
}) {
  const [ref, height] = useSize<HTMLDivElement>("height");

  // Report the final layout immediately; do not assume the host animates its frame.
  if (!animateHeight) {
    return (
      <div className="-mx-1 overflow-hidden">
        <div ref={ref} className="px-1 pb-1">
          {children}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      // height auto only animates on mount, so the measured height carries every later change
      animate={{ height: height ?? "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={
        reduced ? INSTANT : { height: OPEN, opacity: { duration: 0.25 } }
      }
      className="-mx-1 overflow-hidden"
    >
      {/* the inset gives the hover lift and focus rings room before the clip */}
      <div ref={ref} className="px-1 pb-1">
        {children}
      </div>
    </motion.div>
  );
}

// the li takes the hover and the card inside lifts, so the lift can't slide the card out from under the pointer
// the hover shadow stays inside the 4px the collapse leaves around the cards, or its clip shows as a hard edge
const CARD_SHELL =
  "flex h-[84px] w-full cursor-pointer flex-col rounded-[14px] bg-[#F4F4F9] p-2.5 text-left outline-none transition-[background-color,box-shadow,translate] duration-200 group-hover/card:-translate-y-0.5 hover:bg-white hover:shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.04),0_2px_4px_-1px_rgba(0,0,0,0.08)] dark:hover:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#868593] dark:bg-[#1C1C1C] dark:hover:bg-[#232323]";

function SourceCard({
  source,
  linked,
}: {
  source: WebSource;
  linked: boolean;
}) {
  return (
    <a
      data-slot="web-search-source"
      {...linkTo(source.url, linked)}
      title={source.title}
      className={cn(
        CARD_SHELL,
        "group justify-between",
        !linked && "cursor-default",
      )}
    >
      <span className="line-clamp-2 text-[12.5px] font-semibold leading-[17px] text-black/85 transition-colors group-hover:text-black dark:text-white/85 dark:group-hover:text-white">
        {source.title}
      </span>
      <span className="flex items-center gap-1.5">
        <Favicon source={source} size={16} />
        <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-[#868593]">
          {hostOf(source.url)}
        </span>
      </span>

    </a>
  );
}

function MoreCard({
  sources,
  onClick,
  reduced,
}: {
  sources: WebSource[];
  onClick: () => void;
  reduced: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Show ${sources.length} more sources`}
      className={cn(CARD_SHELL, "group justify-between")}
    >
      <FaviconStack sources={sources} reduced={reduced} />
      <span className="flex items-center gap-1 whitespace-nowrap text-[12.5px] font-semibold leading-[17px] text-black/85 transition-colors group-hover:text-black dark:text-white/85 dark:group-hover:text-white">
        <span className="relative inline-grid overflow-hidden tabular-nums">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={sources.length}
              initial={{ y: "100%", opacity: 0, filter: "blur(2px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ y: "-100%", opacity: 0, filter: "blur(2px)" }}
              transition={reduced ? INSTANT : SWAP}
            >
              {sources.length}
            </motion.span>
          </AnimatePresence>
        </span>
        more {sources.length === 1 ? "source" : "sources"}
      </span>
    </button>
  );
}

function SkeletonCard({ reduced, delay }: { reduced: boolean; delay: number }) {
  const bar = "rounded-full bg-black/[0.06] dark:bg-white/[0.07]";
  return (
    <div className="relative flex h-[84px] flex-col justify-between overflow-hidden rounded-[14px] bg-[#F4F4F9] p-2.5 dark:bg-[#1C1C1C]">
      <span className="flex flex-col gap-1.5 pt-0.5">
        <span className={cn(bar, "h-2.5 w-[88%]")} />
        <span className={cn(bar, "h-2.5 w-[60%]")} />
      </span>
      <span className="flex items-center gap-1.5">
        <span className={cn(bar, "size-3.5")} />
        <span className={cn(bar, "h-2 w-12")} />
      </span>
      {!reduced && (
        <motion.span
          className="absolute inset-0 bg-linear-to-r from-transparent via-white/60 to-transparent dark:via-white/[0.06]"
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{
            duration: 1.3,
            ease: "easeInOut",
            repeat: Infinity,
            delay,
          }}
        />
      )}
    </div>
  );
}

function useSize<T extends HTMLElement>(side: "width" | "height") {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<number | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // offsetWidth rounds down, which is enough to tip the label into an ellipsis
    const observer = new ResizeObserver(() =>
      setSize(Math.ceil(node.getBoundingClientRect()[side])),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [side]);

  return [ref, size] as const;
}

function useHoverIntent(enterDelay: number) {
  const [active, setActive] = useState(false);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const set = (next: boolean, delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setActive(next), delay);
  };

  // touch has no hover, so a tap never leaves anything stuck open
  const hover = {
    onPointerEnter: (event: ReactPointerEvent) =>
      event.pointerType === "mouse" && set(true, enterDelay),
    onPointerLeave: () => set(false, LEAVE_DELAY),
  };

  return { active, set, hover };
}

function FaviconStack({
  sources,
  reduced,
  size = 20,
}: {
  sources: WebSource[];
  reduced: boolean;
  size?: number;
}) {
  // only the icons themselves spread on hover, not the pill or card around them
  const { active: spread, hover } = useHoverIntent(SPREAD_DELAY);
  const shown = sources.slice(0, STACK);
  // the 2px plate around each icon counts in the layout, so the overlap makes room for it
  const overlap = Math.round(size * 0.3) + 4;
  // icons slide on transforms, which move in subpixels, and one padding change makes room for them
  const shift = spread ? overlap - 2 : 0;

  return (
    <motion.span
      data-slot="web-search-stack"
      {...hover}
      className="flex w-fit shrink-0 items-center"
      initial={false}
      animate={{ paddingRight: shift * Math.max(0, shown.length - 1) }}
      transition={reduced ? INSTANT : SPREAD}
    >
      <AnimatePresence initial={false}>
        {shown.map((source, i) => (
          <motion.span
            key={source.id}
            // the separator is a plate in the surface color, so the icon's soft edge blends into it instead of leaving a seam
            className="relative rounded-full bg-[#F4F4F9] p-[2px] transition-colors group-hover:bg-white dark:bg-[#1C1C1C] dark:group-hover:bg-[#232323]"
            style={{ zIndex: STACK - i, marginLeft: i === 0 ? 0 : -overlap }}
            initial={{ scale: 0, opacity: 0, x: shift * i }}
            animate={{ scale: 1, opacity: 1, x: shift * i }}
            exit={{ scale: 0, opacity: 0 }}
            transition={reduced ? INSTANT : { default: POP, x: SPREAD }}
          >
            <Favicon source={source} size={size} />
          </motion.span>
        ))}
      </AnimatePresence>
    </motion.span>
  );
}

function Favicon({ source, size }: { source: WebSource; size: number }) {
  const [broken, setBroken] = useState(false);
  const name = siteName(source.url);
  const hue = hash(name) % 360;
  const image = source.favicon && !broken;

  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold uppercase leading-none text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: image
          ? undefined
          : `linear-gradient(135deg, oklch(0.72 0.15 ${hue}), oklch(0.58 0.17 ${(hue + 30) % 360}))`,
      }}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={source.favicon}
          alt=""
          draggable={false}
          onError={() => setBroken(true)}
          className="size-full object-cover"
        />
      ) : (
        name.charAt(0)
      )}
    </span>
  );
}

// A magnifier rather than a globe: a globe reads like the fallback favicon of a site with no logo.
function SearchTile({
  searching,
  reduced,
}: {
  searching: boolean;
  reduced: boolean;
}) {
  return (
    <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-[#868593] shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-colors group-hover:text-black dark:bg-[#2A2A2A] dark:group-hover:text-white">
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        width={15}
        height={15}
        {...STROKE}
        strokeWidth={2}
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>
      {searching && <motion.svg
        data-slot="web-search-spinner"
        aria-hidden
        viewBox="0 0 28 28"
        className="absolute inset-0 size-full text-black dark:text-white"
        initial={false}
        animate={reduced ? undefined : { rotate: [0, 360] }}
        transition={{ duration: 1.2, ease: "linear", repeat: Infinity }}
      >
        <circle {...RING_CIRCLE} className="opacity-[0.12]" />
        <circle {...RING_CIRCLE} pathLength={1} strokeDasharray="0.25 0.75" />
      </motion.svg>}
    </span>
  );
}

function Shimmer({
  reduced,
  children,
}: {
  reduced: boolean;
  children: ReactNode;
}) {
  if (reduced) return <span className="text-[#868593]">{children}</span>;
  return (
    <motion.span
      data-slot="web-search-shimmer"
      className="bg-clip-text text-transparent [--web-search-ink:#868593] [--web-search-shine:#000] dark:[--web-search-shine:#fff]"
      style={{ backgroundImage: SHIMMER, backgroundSize: "250% 100%" }}
      initial={{ backgroundPosition: "100% 0" }}
      animate={{ backgroundPosition: "0% 0" }}
      transition={{ duration: 1.6, ease: "linear", repeat: Infinity }}
    >
      {children}
    </motion.span>
  );
}

export type WebSearchCitationProps = Omit<
  ComponentProps<"span">,
  "children"
> & {
  source: WebSource;
  index?: number;
  linked?: boolean;
};

function WebSearchCitation({
  source,
  index,
  linked = true,
  className,
  ...props
}: WebSearchCitationProps) {
  const reduced = !!useReducedMotion();
  const { active: open, set, hover } = useHoverIntent(PREVIEW_DELAY);

  return (
    <span
      data-slot="web-search-citation"
      className={cn("relative inline-flex align-baseline", className)}
      {...hover}
      // only keyboard focus opens it, a mouse click is already on its way to the link
      onFocus={(event) =>
        event.target.matches(":focus-visible") && set(true, 0)
      }
      onBlur={() => set(false, 0)}
      {...props}
    >
      <a
        {...linkTo(source.url, linked)}
        tabIndex={linked ? undefined : 0}
        aria-label={`${source.title}, ${hostOf(source.url)}`}
        className={cn(
          !linked && "cursor-default",
          "inline-flex h-[19px] -translate-y-px items-center gap-1 rounded-full bg-[#F4F4F9] pl-[3px] pr-1.5 font-runde text-[11px] font-semibold leading-none text-[#868593] no-underline outline-none transition-colors hover:bg-white hover:text-black hover:shadow-[0_1px_3px_rgba(0,0,0,0.1)] dark:hover:shadow-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#868593] dark:bg-[#1C1C1C] dark:hover:bg-[#2A2A2A] dark:hover:text-white",
          open &&
            "bg-white text-black shadow-[0_1px_3px_rgba(0,0,0,0.1)] dark:bg-[#2A2A2A] dark:text-white dark:shadow-none",
        )}
      >
        <Favicon source={source} size={14} />
        {siteName(source.url)}
        {index !== undefined && (
          <span className="tabular-nums opacity-60">{index}</span>
        )}
      </a>

      <AnimatePresence>
        {open && (
          // the padding bridges the gap to the chip, and wrapping resets because the chip sits in a nowrap span
          <motion.span
            role="tooltip"
            className="absolute bottom-full left-1/2 z-50 block w-72 whitespace-normal pb-2"
            style={{ x: "-50%", originY: 1 }}
            initial={{ opacity: 0, y: 4, scale: 0.96, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 4, scale: 0.98, filter: "blur(2px)" }}
            transition={
              reduced
                ? INSTANT
                : { type: "spring", duration: 0.35, bounce: 0.15 }
            }
          >
            <a
              {...linkTo(source.url, linked)}
              tabIndex={-1}
              className="block rounded-[16px] bg-white p-3 text-left font-runde no-underline shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.05)] dark:bg-[#1C1C1C] dark:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.07)]"
            >
              <span className="flex items-center gap-1.5">
                <Favicon source={source} size={18} />
                <span className="truncate text-[12px] font-medium text-[#868593]">
                  {hostOf(source.url)}
                </span>
              </span>
              <span className="mt-1.5 line-clamp-2 block text-[13.5px] font-semibold leading-[18px] text-black dark:text-white">
                {source.title}
              </span>
              {source.snippet && (
                <span className="mt-1 line-clamp-3 block text-[12.5px] font-medium leading-[17px] text-[#868593]">
                  {source.snippet}
                </span>
              )}
            </a>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

const STREAM_SPEED = 80;
// past this many waiting characters, each tick writes more so a live stream never falls behind
const CATCH_UP = 120;
const SENTENCE_PAUSE = 180;
const CLAUSE_PAUSE = 70;

// fixed jitter, so the pace feels uneven but every replay types the same way
const jitter = (n: number) =>
  ((Math.imul(n + 1, 2654435761) >>> 0) % 1000) / 1000;

type Parent = ReactElement<{ children?: ReactNode }>;

// plain tags like p, li, and strong are typed into; components like citations land whole
const isTag = (node: ReactNode): node is Parent =>
  isValidElement(node) && typeof node.type === "string";

const plain = (node: ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (isTag(node))
    return Children.toArray(node.props.children).map(plain).join("");
  return isValidElement(node) ? "\u0000" : "";
};

// a citation is wrapped with the word before it and the punctuation after it, so it never wraps onto a line alone
const glue = (nodes: ReactNode): ReactNode[] => {
  const list = Children.toArray(nodes);
  const out: ReactNode[] = [];
  list.forEach((node, i) => {
    if (isTag(node)) {
      out.push(cloneElement(node, undefined, glue(node.props.children)));
      return;
    }
    if (!isValidElement(node)) {
      out.push(node);
      return;
    }
    const prev = out.pop();
    const before =
      typeof prev === "string" ? /^([\s\S]*?)(\S+\s*)$/.exec(prev) : null;
    out.push(before ? before[1] : prev);
    const next = list[i + 1];
    const after =
      typeof next === "string" ? /^(\S*)([\s\S]*)$/.exec(next) : null;
    if (after) list[i + 1] = after[2];
    out.push(
      <span key={`glue-${i}`} className="whitespace-nowrap">
        {before?.[2]}
        {node}
        {after?.[1]}
      </span>,
    );
  });
  return out;
};

export type WebSearchAnswerProps = ComponentProps<"div"> & {
  play?: boolean;
  speed?: number;
  onComplete?: () => void;
};

function WebSearchAnswer({
  play = true,
  speed = STREAM_SPEED,
  onComplete,
  className,
  children,
  ...props
}: WebSearchAnswerProps) {
  const reduced = !!useReducedMotion();
  const content = useMemo(() => glue(children), [children]);
  const text = useMemo(() => content.map(plain).join(""), [content]);
  const [count, setCount] = useState(0);
  const written = reduced
    ? play
      ? text.length
      : 0
    : Math.min(count, text.length);
  const writing = play && written < text.length;

  useEffect(() => {
    if (!play || reduced || count >= text.length) return;
    const step = Math.max(
      1 + Math.floor(jitter(count) * 3),
      Math.ceil((text.length - count) / CATCH_UP),
    );
    const last = text[count + step - 1];
    const delay =
      (1000 / speed) * step * (0.4 + jitter(count + 7) * 1.2) +
      (/[.!?]/.test(last)
        ? SENTENCE_PAUSE
        : /[,;:]/.test(last)
          ? CLAUSE_PAUSE
          : 0);
    const id = window.setTimeout(() => setCount(count + step), delay);
    return () => window.clearTimeout(id);
  }, [play, reduced, count, text, speed]);

  const done = play && text.length > 0 && !writing;
  useEffect(() => {
    if (done) onComplete?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  // walks the content and cuts it off after the written characters, leaving the caret at the cut
  let left = written;
  let caret = writing;
  const write = (node: ReactNode): ReactNode => {
    if (left <= 0) return null;
    if (isTag(node)) {
      return cloneElement(
        node,
        undefined,
        Children.toArray(node.props.children).map(write),
      );
    }
    const isText = typeof node === "string" || typeof node === "number";
    const part = isText ? String(node).slice(0, left) : node;
    left -= isText ? (part as string).length : 1;
    if (left > 0 || !caret) return part;
    caret = false;
    return [part, <Caret key="caret" reduced={reduced} />];
  };

  return (
    <div
      data-slot="web-search-answer"
      data-writing={writing || undefined}
      aria-busy={writing}
      className={cn(
        "font-runde text-[15px] font-medium leading-7 text-black/80 dark:text-white/80",
        "[&_li]:pl-1 [&_li+li]:mt-1.5 [&_li::marker]:text-[#868593] [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_strong]:text-black [&_ul]:list-disc [&_ul]:pl-5 [&>*+*]:mt-3 dark:[&_strong]:text-white",
        className,
      )}
      {...props}
    >
      {written === 0 && writing ? (
        <Caret reduced={reduced} />
      ) : (
        content.map(write)
      )}
    </div>
  );
}

function Caret({ reduced }: { reduced: boolean }) {
  return (
    <motion.span
      aria-hidden
      className="ml-0.5 inline-block size-[0.55em] rounded-full bg-current align-[-0.02em]"
      animate={reduced ? undefined : { opacity: [1, 0.4, 1] }}
      transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

export { WebSearch, WebSearchAnswer, WebSearchCitation };
export default WebSearch;
