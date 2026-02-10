import { useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

type PreloaderProps = {
  onDone: () => void;
};

export default function Preloader({ onDone }: PreloaderProps) {
  useLayoutEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, left: 0, behavior: "auto" });
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

    const timer = setTimeout(() => onDone(), 3000);
    return () => {
      clearTimeout(timer);
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
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    };
  }, [onDone]);

  const label = "A.R.E.S. Loading...";
  const characters = Array.from(label);
  const content = (
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
  if (typeof document === "undefined") return content;

  return createPortal(content, document.body);
}
