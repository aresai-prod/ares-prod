import { useEffect } from "react";

type TaskPreloaderProps = {
  label?: string;
};

export default function TaskPreloader({ label = "A.R.E.S. Loading..." }: TaskPreloaderProps) {
  useEffect(() => {
    window.scrollTo(0, 0);
    const html = document.documentElement;
    const previousHtmlOverflow = html.style.overflow;
    const previousHtmlTouchAction = html.style.touchAction;
    html.style.overflow = "hidden";
    html.style.touchAction = "none";

    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      html.style.touchAction = previousHtmlTouchAction;
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, []);

  const characters = Array.from(label);
  return (
    <div className="task-overlay" role="status" aria-live="polite">
      <div className="task-loader">
        <div className="task-text-line">
          {characters.map((char, index) => (
            <span
              key={`${char}-${index}`}
              className="task-letter"
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
