// Custom SVG icons for Mycroft (monocle) and Hórus (pharaoh/Eye of Horus)

export function MonocleIcon({ className = '', size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Monocle lens */}
      <circle cx="12" cy="10" r="6" />
      {/* Inner lens reflection */}
      <circle cx="10" cy="8" r="1.5" strokeWidth="0" fill="currentColor" opacity="0.2" />
      {/* Chain hanging down */}
      <path d="M12 16 Q14 19 12 22" />
      <path d="M12 22 Q10 20 11 18" />
      {/* Bridge/handle */}
      <line x1="18" y1="8" x2="20" y2="6" />
    </svg>
  );
}

export function PharaohIcon({ className = '', size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Eye of Horus - stylized */}
      {/* Main eye shape */}
      <path d="M3 12 Q12 4 21 12" />
      <path d="M3 12 Q12 18 21 12" />
      {/* Pupil */}
      <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.3" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" opacity="0.6" />
      {/* Falcon tear mark (distinctive Eye of Horus feature) */}
      <path d="M9 15 Q8 18 6 21" strokeWidth="2" />
      <path d="M6 21 Q8 20 10 19" strokeWidth="1.5" />
      {/* Eyebrow/crown accent */}
      <path d="M2 9 Q12 2 22 9" strokeWidth="1.2" opacity="0.5" />
    </svg>
  );
}
