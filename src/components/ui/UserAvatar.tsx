'use client';

import React from 'react';

export type UserAvatarSize = 'xs' | 'sm' | 'default' | 'md' | 'lg' | 'xl' | number;

export interface UserAvatarProps {
  name?: string | null;
  size?: UserAvatarSize;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Standardized neutral circular avatar component matching Spensify design system.
 * Always renders a clean circular avatar without arbitrary background colors.
 */
export default function UserAvatar({
  name,
  size = 'default',
  className = '',
  style = {},
}: UserAvatarProps) {
  let dimension = 32;
  let fontSize = 13;

  if (typeof size === 'number') {
    dimension = size;
    fontSize = Math.max(10, Math.round(size * 0.42));
  } else {
    switch (size) {
      case 'xs':
        dimension = 24;
        fontSize = 11;
        break;
      case 'sm':
        dimension = 28;
        fontSize = 12;
        break;
      case 'default':
        dimension = 32;
        fontSize = 13;
        break;
      case 'md':
        dimension = 36;
        fontSize = 14;
        break;
      case 'lg':
        dimension = 42;
        fontSize = 16;
        break;
      case 'xl':
        dimension = 52;
        fontSize = 20;
        break;
    }
  }

  const initial = (name || 'U').trim().charAt(0).toUpperCase() || 'U';

  return (
    <div
      className={className}
      style={{
        width: `${dimension}px`,
        height: `${dimension}px`,
        borderRadius: '50%',
        backgroundColor: 'var(--bg-subtle)',
        border: '1px solid var(--border-default)',
        color: 'var(--text-secondary)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        fontSize: `${fontSize}px`,
        flexShrink: 0,
        userSelect: 'none',
        lineHeight: 1,
        ...style,
      }}
      aria-label={name || 'User avatar'}
    >
      {initial}
    </div>
  );
}
