type TaskPreloaderProps = {
  label?: string;
};

export default function TaskPreloader({ label = "A.R.E.S. Loading..." }: TaskPreloaderProps) {
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
