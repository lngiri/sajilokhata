/**
 * DoodleSpinner — A hand-drawn doodle loading animation that replaces
 * the plain border spinner. Shows a small animated QR-like doodle that
 * draws itself in a loop, matching the brand guide's "hand drawing QR" suggestion.
 */

type DoodleSpinnerProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
};

const sizeMap = {
  sm: "w-6 h-6",
  md: "w-10 h-10",
  lg: "w-16 h-16",
};

const strokeMap = {
  sm: 2.5,
  md: 2,
  lg: 1.5,
};

export default function DoodleSpinner({ size = "md", className = "", text }: DoodleSpinnerProps) {
  const sw = strokeMap[size];

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className={`relative ${sizeMap[size]}`}>
        {/* Animated SVG — QR corners draw themselves in a loop */}
        <svg
          viewBox="0 0 36 36"
          className="w-full h-full animate-spin-slow"
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Top-left corner */}
          <path
            d="M4 14V6a2 2 0 012-2h8"
            className="doodle-stroke"
            style={{ animationDelay: "0s" }}
          />
          {/* Top-right corner */}
          <path
            d="M22 4h8a2 2 0 012 2v8"
            className="doodle-stroke"
            style={{ animationDelay: "0.2s" }}
          />
          {/* Bottom-right corner */}
          <path
            d="M32 22v8a2 2 0 01-2 2h-8"
            className="doodle-stroke"
            style={{ animationDelay: "0.4s" }}
          />
          {/* Bottom-left corner */}
          <path
            d="M14 32H6a2 2 0 01-2-2v-8"
            className="doodle-stroke"
            style={{ animationDelay: "0.6s" }}
          />
          {/* Center dot */}
          <circle
            cx="18"
            cy="18"
            r="2"
            className="doodle-stroke"
            style={{ animationDelay: "0.8s" }}
          />
        </svg>
      </div>
      {text && (
        <p className="text-sm text-[var(--color-text-muted)] animate-pulse-soft">
          {text}
        </p>
      )}
    </div>
  );
}
