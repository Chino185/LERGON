import React from 'react';

interface RichardLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  glow?: boolean;
}

export const RichardLogo: React.FC<RichardLogoProps> = ({ 
  className = '', 
  size = 'md',
  glow = true 
}) => {
  // Height configurations
  const heightMap = {
    sm: 'h-6',
    md: 'h-8 sm:h-10',
    lg: 'h-12 sm:h-16',
    hero: 'h-16 sm:h-24 md:h-32 lg:h-36',
  };

  return (
    <div className={`inline-flex items-center select-none ${heightMap[size]} ${className}`}>
      <svg
        viewBox="0 0 520 85"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`h-full w-auto filter transition-all duration-300 ${
          glow ? 'drop-shadow-[0_0_20px_rgba(192,132,252,0.75)] drop-shadow-[0_0_45px_rgba(147,51,234,0.5)]' : ''
        }`}
      >
        <defs>
          <linearGradient id="richardGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#e9d5ff" />
            <stop offset="70%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
          <linearGradient id="dotGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#9333ea" />
          </linearGradient>
        </defs>

        <g stroke="url(#richardGradient)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
          {/* R */}
          <path d="M 20 75 V 20 C 20 12, 28 12, 50 12 C 68 12, 68 40, 50 40 H 20 M 42 40 C 50 40, 56 48, 66 75" />

          {/* I */}
          <path d="M 90 12 V 75" />

          {/* C */}
          <path d="M 165 24 C 150 12, 118 12, 118 43.5 C 118 75, 150 75, 165 63" />

          {/* H */}
          <path d="M 192 12 V 75 M 192 43.5 H 235 M 235 12 V 75" />

          {/* A (NEVERA Curved Arch Style) */}
          <path d="M 260 75 L 278 18 C 282 12, 288 12, 292 18 L 310 75 M 270 50 H 300" />

          {/* R */}
          <path d="M 335 75 V 20 C 335 12, 343 12, 365 12 C 383 12, 383 40, 365 40 H 335 M 357 40 C 365 40, 371 48, 381 75" />

          {/* D */}
          <path d="M 406 12 V 75 M 406 12 H 428 C 456 12, 456 75, 428 75 H 406" />
        </g>

        {/* Dot '.' at end */}
        <rect x="475" y="60" width="15" height="15" rx="4" fill="url(#dotGradient)" className="animate-pulse" />
      </svg>
    </div>
  );
};
