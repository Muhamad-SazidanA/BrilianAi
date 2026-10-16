'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

export interface EnterpriseSelectOption {
  value: string | number;
  label: string;
  sublabel?: string;
  badge?: string;
  icon?: React.ReactNode;
}

export interface EnterpriseSelectProps {
  value: string | number;
  onChange: (value: any) => void;
  options: EnterpriseSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md';
  variant?: 'rounded' | 'pill';
  direction?: 'down' | 'up' | 'auto';
  searchable?: boolean;
  searchPlaceholder?: string;
  width?: string | number;
  style?: React.CSSProperties;
  menuWidth?: string | number;
  menuMaxHeight?: number;
  ariaLabel?: string;
}

export default function EnterpriseSelect({
  value,
  onChange,
  options,
  placeholder = 'Pilih...',
  disabled = false,
  size = 'sm',
  variant = 'rounded',
  direction = 'auto',
  searchable = false,
  searchPlaceholder = 'Cari opsi...',
  width = '100%',
  style,
  menuWidth,
  menuMaxHeight = 220,
  ariaLabel,
}: EnterpriseSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropUp, setDropUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Determine active item
  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  // Determine dropdown direction (up or down)
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      return;
    }

    if (direction === 'up') {
      setDropUp(true);
    } else if (direction === 'down') {
      setDropUp(false);
    } else if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceNeeded = Math.min(options.length * 32 + 20, menuMaxHeight);
      setDropUp(spaceBelow < spaceNeeded && rect.top > spaceNeeded);
    }

    if (searchable) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen, direction, options.length, menuMaxHeight, searchable]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (!isOpen) {
        e.preventDefault();
        setIsOpen(true);
      }
    } else if (e.key === 'ArrowDown' && !isOpen) {
      e.preventDefault();
      setIsOpen(true);
    }
  };

  // Filter options if searchable
  const filteredOptions = searchQuery.trim()
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : options;

  // Sizing definitions
  const height = size === 'xs' ? '24px' : size === 'sm' ? '30px' : '36px';
  const fontSize = size === 'xs' ? '11px' : size === 'sm' ? '11.5px' : '12.5px';
  const paddingX = size === 'xs' ? '7px' : size === 'sm' ? '8px' : '10px';
  const borderRadius = variant === 'pill' ? '9999px' : '6px';

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: width,
        userSelect: 'none',
        display: 'inline-block',
        ...style,
      }}
      onKeyDown={handleKeyDown}
    >
      {/* ── Trigger Button ── */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || placeholder}
        style={{
          width: '100%',
          height: height,
          padding: `0 ${paddingX}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          backgroundColor: disabled ? '#F8FAFC' : '#FFFFFF',
          border: `1px solid ${isOpen ? '#2563EB' : '#CBD5E1'}`,
          borderRadius: borderRadius,
          fontSize: fontSize,
          color: selectedOption ? '#0F172A' : '#94A3B8',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: isOpen
            ? '0 0 0 2px rgba(37, 99, 235, 0.12)'
            : '0 1px 2px rgba(15, 23, 42, 0.04)',
          transition: 'all 0.15s ease',
          outline: 'none',
          textAlign: 'left',
          boxSizing: 'border-box',
        }}
      >
        <span
          style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontWeight: selectedOption ? 500 : 400,
            flex: 1,
            minWidth: 0,
          }}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <ChevronDown
          size={size === 'xs' ? 10 : 12}
          color={disabled ? '#CBD5E1' : '#64748B'}
          style={{
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.18s ease',
          }}
        />
      </button>

      {/* ── Floating Menu (Slate Minimalist) ── */}
      {isOpen && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            left: 0,
            ...(dropUp ? { bottom: '100%', marginBottom: '4px' } : { top: '100%', marginTop: '4px' }),
            width: menuWidth || '100%',
            minWidth: '130px',
            maxWidth: '360px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06)',
            zIndex: 1100,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Optional Search Input */}
          {searchable && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 8px',
                borderBottom: '1px solid #F1F5F9',
                backgroundColor: '#FAFAFA',
              }}
            >
              <Search size={11} color="#94A3B8" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: '11px',
                  color: '#0F172A',
                  width: '100%',
                  padding: 0,
                }}
              />
            </div>
          )}

          {/* Options List */}
          <div
            style={{
              maxHeight: `${menuMaxHeight}px`,
              overflowY: 'auto',
              padding: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            {filteredOptions.length === 0 ? (
              <div
                style={{
                  padding: '8px',
                  fontSize: '11px',
                  color: '#94A3B8',
                  textAlign: 'center',
                }}
              >
                Tidak ada opsi ditemukan
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <div
                    key={String(opt.value)}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: '5px',
                      fontSize: fontSize,
                      cursor: 'pointer',
                      transition: 'all 0.1s ease',
                      backgroundColor: isSelected ? '#F1F5F9' : 'transparent',
                      color: isSelected ? '#0F172A' : '#334155',
                      fontWeight: isSelected ? 600 : 450,
                      gap: '8px',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = '#F8FAFC';
                        e.currentTarget.style.color = '#0F172A';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#334155';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {opt.label}
                      </span>
                      {opt.sublabel && (
                        <span style={{ fontSize: '10px', color: '#64748B', marginTop: '1px' }}>
                          {opt.sublabel}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <Check size={11} color="#2563EB" style={{ flexShrink: 0, strokeWidth: 2.5 }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
