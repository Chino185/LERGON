import React from 'react';

interface MaterialIconProps {
  name: string;
  className?: string;
  filled?: boolean;
  size?: number;
}

export default function MaterialIcon({ name, className = '', filled = false, size }: MaterialIconProps) {
  const style: React.CSSProperties = size
    ? { fontSize: `${size}px`, width: `${size}px`, height: `${size}px` }
    : {};

  return (
    <span
      className={`material-symbols-rounded select-none inline-flex items-center justify-center leading-none ${filled ? 'material-symbols-filled' : ''} ${className}`}
      style={style}
    >
      {name}
    </span>
  );
}

