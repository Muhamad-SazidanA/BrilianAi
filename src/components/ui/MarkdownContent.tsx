'use client';

import React, { useState } from 'react';
import { Copy, Check, Table as TableIcon } from 'lucide-react';
import { toast } from 'sonner';

interface TableBlock {
  type: 'table';
  headers: string[];
  alignments: Array<'left' | 'center' | 'right'>;
  rows: string[][];
}

interface HeadingBlock {
  type: 'heading';
  level: number;
  content: string;
}

interface NoteBlock {
  type: 'note';
  content: string;
}

interface BulletListBlock {
  type: 'bullet_list';
  items: string[];
}

interface NumberedListBlock {
  type: 'numbered_list';
  items: string[];
}

interface ParagraphBlock {
  type: 'paragraph';
  content: string;
}

type MarkdownBlock =
  | TableBlock
  | HeadingBlock
  | NoteBlock
  | BulletListBlock
  | NumberedListBlock
  | ParagraphBlock;

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|') || !trimmed.includes('-')) return false;
  const parts = trimmed.split('|').map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 && parts.every((p) => /^:?-+:?$/.test(p));
}

function parseTableRow(line: string): string[] {
  let content = line.trim();
  if (content.startsWith('|')) content = content.slice(1);
  if (content.endsWith('|')) content = content.slice(0, -1);
  return content.split('|').map((cell) => cell.trim());
}

function isNumericLike(val: string): boolean {
  if (!val) return false;
  const stripped = val.replace(/[*%]/g, '').trim();
  return /^[\$€£¥Rp\s]*[+-]?\d+([.,]\d+)*\s*$/i.test(stripped);
}

function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  if (!markdown) return [];
  const lines = markdown.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // 1. Table Detection
    if (trimmed.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = parseTableRow(lines[i]);
      const sepParts = parseTableRow(lines[i + 1]);
      const alignments = sepParts.map((p) => {
        const s = p.trim();
        if (s.startsWith(':') && s.endsWith(':')) return 'center' as const;
        if (s.endsWith(':')) return 'right' as const;
        return 'left' as const;
      });

      i += 2;
      const rows: string[][] = [];
      while (i < lines.length) {
        const rowLine = lines[i].trim();
        if (!rowLine || !rowLine.includes('|')) break;
        rows.push(parseTableRow(rowLine));
        i++;
      }

      blocks.push({
        type: 'table',
        headers,
        alignments,
        rows,
      });
      continue;
    }

    // 2. Headings (###, ####)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        content: headingMatch[2],
      });
      i++;
      continue;
    }

    // 3. Footnote / Asterisk Note (e.g. * Setelah Stock split...)
    if (/^\*\s+[^*]/.test(trimmed) && !trimmed.endsWith('*')) {
      blocks.push({
        type: 'note',
        content: trimmed.replace(/^\*\s+/, ''),
      });
      i++;
      continue;
    }

    // 4. Bullet List (- or •)
    if (/^[-•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length) {
        const itemLine = lines[i].trim();
        if (!/^[-•]\s+/.test(itemLine)) break;
        items.push(itemLine.replace(/^[-•]\s+/, ''));
        i++;
      }
      blocks.push({
        type: 'bullet_list',
        items,
      });
      continue;
    }

    // 5. Numbered List (1. 2.)
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length) {
        const itemLine = lines[i].trim();
        if (!/^\d+\.\s+/.test(itemLine)) break;
        items.push(itemLine.replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({
        type: 'numbered_list',
        items,
      });
      continue;
    }

    // 6. Regular Paragraph
    const paraLines: string[] = [trimmed];
    i++;
    while (i < lines.length) {
      const nextLine = lines[i].trim();
      if (!nextLine) break;
      if (nextLine.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) break;
      if (/^(#{1,6})\s+/.test(nextLine)) break;
      if (/^[-•*]\s+/.test(nextLine)) break;
      if (/^\d+\.\s+/.test(nextLine)) break;
      paraLines.push(nextLine);
      i++;
    }
    blocks.push({
      type: 'paragraph',
      content: paraLines.join('\n'),
    });
  }

  return blocks;
}

function renderInline(text: string): React.ReactNode[] {
  if (!text) return [];

  // Match **bold**, `code`, or *italic*
  const regex = /(\*\*.*?\*\*|`.*?`|\*[^\s*](?:.*?[^\s*])?\*)/g;
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    if (!part) return null;

    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={idx} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={idx}
          style={{
            backgroundColor: 'var(--bg-subtle)',
            padding: '1px 5px',
            borderRadius: '4px',
            fontSize: '90%',
            fontFamily: 'var(--font-mono)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 3 && !part.startsWith('**')) {
      return (
        <em key={idx} style={{ fontStyle: 'italic' }}>
          {part.slice(1, -1)}
        </em>
      );
    }

    return <span key={idx}>{part}</span>;
  });
}

interface MarkdownContentProps {
  content: string;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function MarkdownContent({
  content,
  compact = false,
  className,
  style,
}: MarkdownContentProps) {
  const [copiedTableIdx, setCopiedTableIdx] = useState<number | null>(null);

  const blocks = parseMarkdownBlocks(content);

  const handleCopyTable = (block: TableBlock, idx: number) => {
    const tsv = [
      block.headers.join('\t'),
      ...block.rows.map((row) => row.join('\t')),
    ].join('\n');

    navigator.clipboard.writeText(tsv);
    setCopiedTableIdx(idx);
    toast.success('Data tabel disalin (format spreadsheet TSV)');
    setTimeout(() => setCopiedTableIdx(null), 2000);
  };

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? '8px' : '12px',
        width: '100%',
        ...style,
      }}
    >
      {blocks.map((block, bIdx) => {
        if (block.type === 'table') {
          return (
            <div
              key={bIdx}
              style={{
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
                backgroundColor: 'var(--bg-card)',
                boxShadow: 'var(--shadow-xs)',
                margin: '4px 0',
              }}
            >
              {/* Header Bar for Table: Count & Copy */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: compact ? '4px 8px' : '6px 12px',
                  backgroundColor: 'var(--bg-subtle)',
                  borderBottom: '1px solid var(--border-default)',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
                  <TableIcon size={12} color="var(--color-primary)" />
                  <span>Tabel Data ({block.rows.length} baris)</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyTable(block, bIdx)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: copiedTableIdx === bIdx ? 'var(--color-success)' : 'var(--text-secondary)',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                  title="Salin tabel untuk Excel / Google Sheets"
                >
                  {copiedTableIdx === bIdx ? (
                    <>
                      <Check size={12} />
                      <span>Disalin</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Salin Excel</span>
                    </>
                  )}
                </button>
              </div>

              {/* Scrollable Table Viewport */}
              <div
                style={{
                  overflowX: 'auto',
                  maxHeight: compact ? '320px' : '460px',
                  overflowY: block.rows.length > 7 ? 'auto' : 'visible',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: compact ? '12px' : '13px',
                    lineHeight: '18px',
                    textAlign: 'left',
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        position: 'sticky',
                        top: 0,
                        backgroundColor: 'var(--bg-subtle)',
                        zIndex: 2,
                        boxShadow: '0 1px 0 var(--border-default)',
                      }}
                    >
                      {block.headers.map((head, hIdx) => {
                        const align = block.alignments[hIdx] || 'left';
                        return (
                          <th
                            key={hIdx}
                            style={{
                              padding: compact ? '6px 10px' : '8px 12px',
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                              textAlign: align,
                              whiteSpace: 'nowrap',
                              borderBottom: '1px solid var(--border-default)',
                              backgroundColor: 'var(--bg-subtle)',
                            }}
                          >
                            {renderInline(head)}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rIdx) => {
                      const isOdd = rIdx % 2 === 1;
                      return (
                        <tr
                          key={rIdx}
                          style={{
                            backgroundColor: isOdd ? 'rgba(0, 0, 0, 0.015)' : 'var(--bg-card)',
                            borderBottom:
                              rIdx === block.rows.length - 1
                                ? 'none'
                                : '1px solid var(--border-subtle)',
                            transition: 'background-color 0.1s ease',
                          }}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        >
                          {row.map((cell, cIdx) => {
                            const markdownAlign = block.alignments[cIdx];
                            let cellAlign = markdownAlign || 'left';
                            if (cellAlign === 'left' && isNumericLike(cell)) {
                              cellAlign = 'right';
                            }

                            return (
                              <td
                                key={cIdx}
                                style={{
                                  padding: compact ? '6px 10px' : '7px 12px',
                                  color: 'var(--text-secondary)',
                                  textAlign: cellAlign,
                                  whiteSpace: 'nowrap',
                                  fontVariantNumeric: isNumericLike(cell) ? 'tabular-nums' : undefined,
                                }}
                              >
                                {renderInline(cell)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }

        if (block.type === 'note') {
          return (
            <div
              key={bIdx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px',
                padding: '4px 8px',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-xs)',
                fontSize: compact ? '11.5px' : '12px',
                color: 'var(--text-muted)',
                fontStyle: 'italic',
                borderLeft: '2px solid var(--color-primary)',
              }}
            >
              <span>*</span>
              <div>{renderInline(block.content)}</div>
            </div>
          );
        }

        if (block.type === 'bullet_list') {
          return (
            <ul
              key={bIdx}
              style={{
                paddingLeft: '1.25rem',
                margin: 0,
                fontSize: compact ? '12.5px' : '13.5px',
                lineHeight: compact ? '20px' : '22px',
                color: 'var(--text-secondary)',
              }}
            >
              {block.items.map((it, itIdx) => (
                <li key={itIdx} style={{ marginBottom: '3px' }}>
                  {renderInline(it)}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === 'numbered_list') {
          return (
            <ol
              key={bIdx}
              style={{
                paddingLeft: '1.25rem',
                margin: 0,
                fontSize: compact ? '12.5px' : '13.5px',
                lineHeight: compact ? '20px' : '22px',
                color: 'var(--text-secondary)',
              }}
            >
              {block.items.map((it, itIdx) => (
                <li key={itIdx} style={{ marginBottom: '3px' }}>
                  {renderInline(it)}
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === 'heading') {
          return (
            <h4
              key={bIdx}
              style={{
                fontSize: compact ? '13.5px' : '14.5px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginTop: '4px',
                marginBottom: '2px',
              }}
            >
              {renderInline(block.content)}
            </h4>
          );
        }

        // Paragraph
        return (
          <p
            key={bIdx}
            style={{
              fontSize: compact ? '13px' : '14px',
              color: 'var(--text-secondary)',
              lineHeight: compact ? '21px' : '23px',
              margin: 0,
              whiteSpace: 'pre-line',
            }}
          >
            {renderInline(block.content)}
          </p>
        );
      })}
    </div>
  );
}
