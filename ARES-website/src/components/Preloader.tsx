import { useEffect } from "react";

type PreloaderProps = {
  onDone: () => void;
};

export default function Preloader({ onDone }: PreloaderProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    const timer = setTimeout(() => onDone(), 3000);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [onDone]);

  const label = "A.R.E.S. Loading...";
  const characters = Array.from(label);

  return (
    <div className="loader-screen">
      <div className="loader-glass">
        <div className="loader-text-line">
          {characters.map((char, index) => (
            <span
              key={`${char}-${index}`}
              className="loader-letter"
              style={{ "--delay": `${index * 0.08}s` } as Record<string, string>}
            >
              {char === " " ? "\u00a0" : char}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
