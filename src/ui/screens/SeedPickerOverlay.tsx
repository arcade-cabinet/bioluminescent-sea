import { Dice5, Sparkles } from "lucide-react";
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
              className="text-[0.65rem] uppercase tracking-[0.18em]"
              style={{ color: meta.accentHex }}
            >
              {meta.label} dive
            </p>
          )}
          <DialogTitle>Chart your route</DialogTitle>
          <DialogDescription>
            {meta?.description ??
              "Every trench is generated from a three-word phrase."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="seed-codename"
              className="text-[0.65rem] uppercase tracking-[0.14em] text-fg-muted"
            >
              Trench codename
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

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSeed(dailySeed())}
              data-testid="seed-daily-button"
            >
              <Sparkles className="size-3.5" aria-hidden="true" />
              Today's chart
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSeed(randomSeed())}
              data-testid="seed-reroll-button"
            >
              <Dice5 className="size-3.5" aria-hidden="true" />
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
