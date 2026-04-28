import { Check, Dices, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { codenameFromSeed, dailySeed, randomSeed, seedFromCodename, trenchBlurbForSeed } from "@/sim/rng";
import { getModeMetadata, type SessionMode } from "@/sim";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@/ui/primitives";

interface SeedPickerOverlayProps {
  /** When non-null the dialog is open and `mode` is the user's selected dive mode. */
  mode: SessionMode | null;
  /** Initial seed to seed the input; recommended to be `dailySeed()` so the
      overlay defaults to today's chart. */
  initialSeed: number;
  onCancel: () => void;
  onConfirm: (seed: number) => void;
}

export function SeedPickerOverlay({
  mode,
  initialSeed,
  onCancel,
  onConfirm,
}: SeedPickerOverlayProps) {
  const [seed, setSeed] = useState<number>(initialSeed);
  const [editingCodename, setEditingCodename] = useState<string>(
    () => codenameFromSeed(initialSeed),
  );

  // Reset to a fresh daily seed every time the overlay opens.
  useEffect(() => {
    if (mode !== null) {
      setSeed(initialSeed);
      setEditingCodename(codenameFromSeed(initialSeed));
    }
  }, [mode, initialSeed]);

  // Keep the codename input synced when the seed changes via Reroll/Daily.
  useEffect(() => {
    setEditingCodename(codenameFromSeed(seed));
  }, [seed]);

  const blurb = trenchBlurbForSeed(seed).full;
  const meta = mode ? getModeMetadata(mode) : null;
  const todaySeed = dailySeed();
  const isOnTodaySeed = seed === todaySeed;

  return (
    <Dialog
      open={mode !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent
        data-testid="seed-picker-overlay"
        className="sm:max-w-lg"
        // The landing's animated hero stays visible behind the blur — the
        // dialog is meant to feel like a chart rolled out over the trench.
      >
        <DialogHeader>
          {meta && (
            <p
              className="bs-label text-[0.62rem]"
              style={{
                color: meta.accentHex,
                filter: "url(#bs-soft-glow)",
              }}
            >
              {meta.label} dive
            </p>
          )}
          <DialogTitle>Choose your dive</DialogTitle>
          <DialogDescription>
            {meta?.description ??
              "Every dive is generated from a three-word codename. Same codename, same ocean."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="seed-codename"
              className="bs-label text-[0.62rem] text-fg-muted"
              style={{ filter: "url(#bs-soft-glow)" }}
            >
              Dive codename
            </label>
            <Input
              id="seed-codename"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={editingCodename}
              onChange={(e) => {
                setEditingCodename(e.target.value);
                const parsed = seedFromCodename(e.target.value);
                if (parsed !== null) setSeed(parsed);
              }}
              data-testid="seed-codename-input"
            />
            <p className="m-0 min-h-[2.4em] text-center text-xs italic leading-relaxed text-fg-muted">
              {blurb}
            </p>
          </div>

          <div className="flex flex-wrap items-stretch justify-center gap-2">
            {/* Today's chart — a "snap-to" affordance. When already on
             *  today's seed, it shows a filled check + glow ring so the
             *  player can read at a glance "yep, this is the daily."
             *  Click while inactive snaps the seed to today; click
             *  while active is a no-op visually but harmless to fire.
             */}
            <Button
              variant="outline"
              size="sm"
              aria-pressed={isOnTodaySeed}
              onClick={() => setSeed(todaySeed)}
              data-testid="seed-daily-button"
              className={
                isOnTodaySeed
                  ? "border-glow/70 bg-glow/10 text-glow ring-1 ring-glow/40"
                  : undefined
              }
            >
              {isOnTodaySeed ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : (
                <Sparkles className="size-3.5" aria-hidden="true" />
              )}
              Today's chart
            </Button>

            {/* Reroll — distinct action affordance. Outline button
             *  (Begin Dive owns the page's primary slot) but a punchier
             *  dice icon + slightly elevated stroke so it reads as
             *  "spin me a new one" instead of "toggle a state." Always
             *  functionally an action, never a toggle.
             */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSeed(randomSeed())}
              data-testid="seed-reroll-button"
              className="border-glow/40 hover:border-glow/70"
            >
              <Dices className="size-4" aria-hidden="true" />
              Reroll
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} data-testid="seed-cancel-button">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => onConfirm(seed)}
            data-testid="begin-dive-button"
          >
            Begin dive
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
