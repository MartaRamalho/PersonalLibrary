import { FC, useEffect, useRef, useState } from "react";

interface Props {
  labels: string[]; // pool of labels flashed while spinning
  target: string | null; // final label to land on
  spinKey: number; // increment to trigger a spin
  onSettled?: () => void;
  caption?: string;
}

// A slot-machine style spinner. The parent decides the winner (it knows the pools);
// this component just animates flashing labels and decelerates onto the target.
export const RouletteWheel: FC<Props> = ({
  labels,
  target,
  spinKey,
  onSettled,
  caption,
}) => {
  const [display, setDisplay] = useState<string>(target ?? "—");
  const [spinning, setSpinning] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (spinKey === 0 || !target) return;
    // Clear any in-flight timers.
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
    setSpinning(true);

    const pool = labels.length ? labels : [target];
    let delay = 60;
    let elapsed = 0;
    const total = 1800;

    const tick = () => {
      setDisplay(pool[Math.floor(Math.random() * pool.length)]);
      elapsed += delay;
      delay *= 1.12; // decelerate
      if (elapsed < total) {
        timers.current.push(window.setTimeout(tick, delay));
      } else {
        setDisplay(target);
        setSpinning(false);
        onSettled?.();
      }
    };
    timers.current.push(window.setTimeout(tick, delay));

    return () => {
      timers.current.forEach((t) => clearTimeout(t));
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey]);

  return (
    <div className="text-center">
      {caption && (
        <p className="text-xs uppercase tracking-wide text-ink/40 mb-1">
          {caption}
        </p>
      )}
      <div
        className={`mx-auto max-w-md rounded-2xl border-2 px-6 py-8 font-serif text-2xl font-bold transition-colors ${
          spinning
            ? "border-accent bg-accent/5 text-accent animate-pulse"
            : "border-ink/15 bg-surface text-ink"
        }`}
      >
        {display || "—"}
      </div>
    </div>
  );
};
