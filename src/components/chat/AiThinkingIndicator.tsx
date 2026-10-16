'use client';

import React from 'react';
import { useLanguage } from '@/context/LanguageContext';

export interface AiThinkingIndicatorProps {
  queryText?: string;
  isStarterScreen?: boolean;
  className?: string;
}

export function AiThinkingIndicator({
  queryText: _queryText,
  isStarterScreen = false,
  className = '',
}: AiThinkingIndicatorProps) {
  const { language } = useLanguage();

  const thinkingText =
    language === 'en'
      ? 'Thinking...'
      : 'Sedang berpikir...';

  return (
    <div
      data-slot="ai-thinking-indicator"
      className={`brilian-thinking-loader-wrapper ${className}`}
      role="status"
      aria-live="polite"
      aria-label={thinkingText}
      style={{
        display: 'inline-flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: isStarterScreen ? 'center' : 'flex-start',
        gap: '10px',
        padding: isStarterScreen ? '6px 0 14px' : '3px 2px 8px',
        width: 'fit-content',
        minHeight: '26px',
      }}
    >
      {/* 16px Slim Translucent Glassmorphic Cube Loader */}
      <div className="tech-cube-loader-box">
        <div className="tech-cube-loader" aria-hidden="true" />
      </div>

      {/* Light style thinking label beside the cube */}
      <span id="statusToastText" className="thinking-indicator-text">
        {thinkingText}
      </span>
    </div>
  );
}

export default AiThinkingIndicator;
