'use client';

import React from 'react';
import { AiThinkingIndicator } from './AiThinkingIndicator';

export interface ChatStarterViewProps {
  userName?: string;
  promptChips: string[];
  onSelectChip: (chip: string) => void;
  isLoading: boolean;
  activeQueryText: string;
}

export function ChatStarterView({
  userName,
  promptChips,
  onSelectChip,
  isLoading,
  activeQueryText,
}: ChatStarterViewProps) {
  const firstName = userName ? userName.split(' ')[0] : null;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem 0',
      }}
    >
      {/* Greeting Heading */}
      <div style={{ textAlign: 'center', marginBottom: '1.25rem', maxWidth: '38rem' }}>
        <h1
          style={{
            fontSize: 'clamp(20px, 3.2vw, 26px)',
            fontWeight: 500,
            letterSpacing: '-0.025em',
            color: 'var(--text-primary)',
            lineHeight: 1.25,
          }}
        >
          {firstName ? `Hi ${firstName}, what's on your mind?` : "Hi, what's on your mind?"}
        </h1>
      </div>

      {/* Suggested Query Chips */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          marginTop: '0.5rem',
        }}
      >
        {promptChips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onSelectChip(chip)}
            className="prompt-chip"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Loading indicator (only strictly shown if a query was submitted on the starter screen) */}
      {isLoading && Boolean(activeQueryText) && (
        <div id="statusToast" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
          <AiThinkingIndicator
            queryText={activeQueryText}
            isStarterScreen={true}
          />
        </div>
      )}
    </div>
  );
}
