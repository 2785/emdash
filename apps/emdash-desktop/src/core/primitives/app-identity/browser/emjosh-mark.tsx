/** Emjosh's mark (a J on a rounded square); same artwork as src/assets/images/emjosh/emjosh.svg. */
export function EmjoshMark({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="100 100 824 824"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Emjosh"
    >
      <defs>
        <linearGradient id="emjosh-mark-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6D5DFC" />
          <stop offset="1" stopColor="#2A1F8F" />
        </linearGradient>
      </defs>
      <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#emjosh-mark-bg)" />
      <path
        d="M600 300 V600 A150 150 0 0 1 300 600"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="112"
        strokeLinecap="round"
      />
    </svg>
  );
}
