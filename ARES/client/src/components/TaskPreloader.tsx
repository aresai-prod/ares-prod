import { useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

type TaskPreloaderProps = {
  label?: string;
};

export default function TaskPreloader({ label = "A.R.E.S. Loading..." }: TaskPreloaderProps) {
  useLayoutEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    const html = document.documentElement;
    const previousHtmlBehavior = html.style.scrollBehavior;
    const previousHtmlOverflow = html.style.overflow;
    const previousHtmlTouchAction = html.style.touchAction;
    const previousHtmlHeight = html.style.height;
    html.dataset.preloading = "true";
    html.style.scrollBehavior = "auto";
    html.style.overflow = "hidden";
    html.style.touchAction = "none";
    html.style.height = "100dvh";

    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    const previousPosition = document.body.style.position;
    const previousTop = document.body.style.top;
    const previousWidth = document.body.style.width;
    const previousLeft = document.body.style.left;
    document.body.dataset.preloading = "true";
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    document.body.style.position = "fixed";
    document.body.style.top = "0";
    document.body.style.left = "0";
    document.body.style.width = "100%";

    let raf = 0;
    const enforceTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      raf = window.requestAnimationFrame(enforceTop);
    };
    raf = window.requestAnimationFrame(enforceTop);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      delete html.dataset.preloading;
      html.style.scrollBehavior = previousHtmlBehavior;
      html.style.overflow = previousHtmlOverflow;
      html.style.touchAction = previousHtmlTouchAction;
      html.style.height = previousHtmlHeight;
      delete document.body.dataset.preloading;
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
      document.body.style.position = previousPosition;
      document.body.style.top = previousTop;
      document.body.style.left = previousLeft;
      document.body.style.width = previousWidth;
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };
  }, []);

  const characters = Array.from(label);
  const content = (
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
  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}
