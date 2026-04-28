import {
  Children,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { motion, type Transition, useMotionValue } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Real centered carousel — based on the 21st.dev Carousel primitive.
 *
 * Each `<CarouselItem>` is full container width by default. Slides
 * translate via `translateX(-index * 100%)`. To get one-card-at-a-time
 * with side peek, wrap the carousel in a fixed max-width container
 * narrower than the viewport (e.g. `max-w-md` on a 1280px screen).
 *
 * Imported as a primitive so the LandingScreen + any future picker
 * (campaign select, drydock category, etc.) reuse the same dragging
 * behavior + indicator + arrows without re-rolling them per call site.
 */

type CarouselContextType = {
  index: number;
  setIndex: (newIndex: number) => void;
  itemsCount: number;
  setItemsCount: (newItemsCount: number) => void;
  disableDrag: boolean;
};

const CarouselContext = createContext<CarouselContextType | undefined>(
  undefined,
);

export function useCarousel() {
  const context = useContext(CarouselContext);
  if (!context)
    throw new Error("useCarousel must be used within a Carousel");
  return context;
}

type CarouselProviderProps = {
  children: ReactNode;
  initialIndex?: number;
  onIndexChange?: (newIndex: number) => void;
  disableDrag?: boolean;
};

function CarouselProvider({
  children,
  initialIndex = 0,
  onIndexChange,
  disableDrag = false,
}: CarouselProviderProps) {
  const [index, setIndex] = useState<number>(initialIndex);
  const [itemsCount, setItemsCount] = useState<number>(0);

  const handleSetIndex = (newIndex: number) => {
    setIndex(newIndex);
    onIndexChange?.(newIndex);
  };

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex]);

  return (
    <CarouselContext.Provider
      value={{
        index,
        setIndex: handleSetIndex,
        itemsCount,
        setItemsCount,
        disableDrag,
      }}
    >
      {children}
    </CarouselContext.Provider>
  );
}

export type CarouselProps = {
  children: ReactNode;
  className?: string;
  initialIndex?: number;
  index?: number;
  onIndexChange?: (newIndex: number) => void;
  disableDrag?: boolean;
};

export function Carousel({
  children,
  className,
  initialIndex = 0,
  index: externalIndex,
  onIndexChange,
  disableDrag = false,
}: CarouselProps) {
  const [internalIndex, setInternalIndex] = useState<number>(initialIndex);
  const isControlled = externalIndex !== undefined;
  const currentIndex = isControlled ? externalIndex : internalIndex;

  const handleIndexChange = (newIndex: number) => {
    if (!isControlled) setInternalIndex(newIndex);
    onIndexChange?.(newIndex);
  };

  return (
    <CarouselProvider
      initialIndex={currentIndex}
      onIndexChange={handleIndexChange}
      disableDrag={disableDrag}
    >
      <div className={cn("group/hover relative", className)}>
        {/* The overflow-hidden viewport. data-bs-carousel marks it
         *   so the e2e clipping diagnostic knows children that
         *   extend past the viewport are intentional (off-page
         *   slides). */}
        <div className="overflow-hidden" data-bs-carousel="viewport">
          {children}
        </div>
      </div>
    </CarouselProvider>
  );
}

type CarouselNavigationProps = {
  className?: string;
  classNameButton?: string;
  alwaysShow?: boolean;
};

export function CarouselNavigation({
  className,
  classNameButton,
  alwaysShow,
}: CarouselNavigationProps) {
  const { index, setIndex, itemsCount } = useCarousel();
  return (
    <div
      className={cn(
        // Arrows live inside the carousel's viewport on small
        // breakpoints (so they aren't clipped by `overflow-hidden` on
        // the page) and bleed slightly outside on tablet+ for a
        // sweeter visual rhythm.
        "pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-2 sm:left-[-12.5%] sm:inset-x-auto sm:w-[125%]",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Previous mode"
        data-testid="carousel-prev"
        className={cn(
          "pointer-events-auto h-fit w-fit rounded-full bg-abyss/60 p-2 text-fg ring-1 ring-glow/40 backdrop-blur-sm transition-all hover:text-glow hover:ring-glow",
          alwaysShow ? "opacity-100" : "opacity-0 group-hover/hover:opacity-100",
          alwaysShow ? "disabled:opacity-30" : "group-hover/hover:disabled:opacity-30",
          classNameButton,
        )}
        style={{ filter: "url(#bs-soft-glow)" }}
        disabled={index === 0}
        onClick={() => index > 0 && setIndex(index - 1)}
      >
        <ChevronLeft size={28} />
      </button>
      <button
        type="button"
        aria-label="Next mode"
        data-testid="carousel-next"
        className={cn(
          "pointer-events-auto h-fit w-fit rounded-full bg-abyss/60 p-2 text-fg ring-1 ring-glow/40 backdrop-blur-sm transition-all hover:text-glow hover:ring-glow",
          alwaysShow ? "opacity-100" : "opacity-0 group-hover/hover:opacity-100",
          alwaysShow ? "disabled:opacity-30" : "group-hover/hover:disabled:opacity-30",
          classNameButton,
        )}
        style={{ filter: "url(#bs-soft-glow)" }}
        disabled={index + 1 === itemsCount}
        onClick={() => index < itemsCount - 1 && setIndex(index + 1)}
      >
        <ChevronRight size={28} />
      </button>
    </div>
  );
}

type CarouselIndicatorProps = {
  className?: string;
  /** Per-mode metadata so dots can carry the mode's accent colour. */
  modeIds?: readonly string[];
};

export function CarouselIndicator({ className, modeIds }: CarouselIndicatorProps) {
  const { index, itemsCount, setIndex } = useCarousel();
  return (
    <div
      className={cn(
        "absolute -bottom-2 z-10 flex w-full items-center justify-center",
        className,
      )}
    >
      <div className="flex items-center space-x-2.5">
        {Array.from({ length: itemsCount }, (_, i) => {
          const isActive = index === i;
          const testId = modeIds?.[i] ? `mode-dot-${modeIds[i]}` : undefined;
          return (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`Go to mode ${i + 1}`}
              data-testid={testId}
              onClick={() => setIndex(i)}
              className={
                isActive
                  ? "h-2 w-8 rounded-full bg-glow shadow-[0_0_12px_rgba(107,230,193,0.7)] transition-all"
                  : "h-2 w-2 rounded-full bg-fg/55 ring-1 ring-fg/20 transition-all hover:bg-fg hover:ring-fg/40"
              }
            />
          );
        })}
      </div>
    </div>
  );
}

export type CarouselContentProps = {
  children: ReactNode;
  className?: string;
  transition?: Transition;
};

export function CarouselContent({
  children,
  className,
  transition,
}: CarouselContentProps) {
  const { index, setIndex, setItemsCount, disableDrag } = useCarousel();
  const [visibleItemsCount, setVisibleItemsCount] = useState(1);
  const dragX = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemsLength = Children.count(children);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const count = entries.filter((e) => e.isIntersecting).length;
        if (count > 0) setVisibleItemsCount(count);
      },
      { root: containerRef.current, threshold: 0.5 },
    );
    const childNodes = containerRef.current.children;
    Array.from(childNodes).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
    // children identity changes on every render but the IntersectionObserver
    // observes the live DOM children, not the React children prop. Re-run
    // is only needed when the count changes; observer is otherwise stable.
  }, []);

  useEffect(() => {
    if (!itemsLength) return;
    setItemsCount(itemsLength);
  }, [itemsLength, setItemsCount]);

  const onDragEnd = () => {
    const x = dragX.get();
    if (x <= -10 && index < itemsLength - 1) setIndex(index + 1);
    else if (x >= 10 && index > 0) setIndex(index - 1);
  };

  return (
    <motion.div
      drag={disableDrag ? false : "x"}
      dragConstraints={disableDrag ? undefined : { left: 0, right: 0 }}
      dragMomentum={disableDrag ? undefined : false}
      style={{ x: disableDrag ? undefined : dragX }}
      animate={{
        translateX: `-${index * (100 / visibleItemsCount)}%`,
      }}
      onDragEnd={disableDrag ? undefined : onDragEnd}
      transition={
        transition ?? {
          damping: 22,
          stiffness: 110,
          type: "spring",
        }
      }
      className={cn(
        "flex items-stretch",
        !disableDrag && "cursor-grab active:cursor-grabbing",
        className,
      )}
      ref={containerRef}
    >
      {children}
    </motion.div>
  );
}

export type CarouselItemProps = {
  children: ReactNode;
  className?: string;
};

export function CarouselItem({ children, className }: CarouselItemProps) {
  return (
    <motion.div
      className={cn("w-full min-w-0 shrink-0 grow-0", className)}
    >
      {children}
    </motion.div>
  );
}
