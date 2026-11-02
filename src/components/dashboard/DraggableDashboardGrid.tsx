'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  GripVertical,
  Sparkles,
  Plus,
} from 'lucide-react';
import {
  DashboardData,
  DashboardWidget,
  MorphableChartType,
  WidgetLayout,
} from '@/types/dashboard';
import { WidgetRenderer } from '@/components/chat/AiDashboardPreview';
import DashboardAiCanvas from '@/components/dashboard/DashboardAiCanvas';
import { toast } from 'sonner';

interface DraggableDashboardGridProps {
  dashboardId: string;
  data: DashboardData;
  isLocked: boolean;
  canEdit?: boolean;
  onUpdateData: (newData: DashboardData) => void;
  onMorphWidget?: (index: number, targetType: MorphableChartType) => void;
  onPersistLayout?: (updatedWidgets: DashboardWidget[]) => void;
}

// Default column span (12-column grid) by widget type
function getDefaultColSpan(widgetType: string): number {
  switch (widgetType) {
    case 'stat_card':
      return 3; // 4 cards per row
    case 'bar_chart':
    case 'line_chart':
    case 'pie_chart':
    case 'area_chart':
    case 'list':
    case 'text_summary':
    case 'timeline':
      return 6; // 2 widgets per row
    case 'table':
    case 'comparison':
      return 12; // full width
    default:
      return 6;
  }
}

// Supported snap sizes for width
const SNAP_COL_SPANS = [3, 4, 6, 8, 12];

export default function DraggableDashboardGrid({
  dashboardId,
  data,
  isLocked,
  canEdit = true,
  onUpdateData,
  onMorphWidget,
  onPersistLayout,
}: DraggableDashboardGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Resize state
  const [resizingIndex, setResizingIndex] = useState<number | null>(null);
  const [resizeMetrics, setResizeMetrics] = useState<{
    colSpan: number;
    heightPx: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  // ── Card Selection & AI Canvas ──
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isAiCanvasOpen, setIsAiCanvasOpen] = useState(false);

  // Handle Drag & Drop reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (isLocked) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (isLocked || draggedIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    if (isLocked || draggedIndex === null) return;
    e.preventDefault();

    if (draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const currentWidgets = [...data.widgets];
    const [movedWidget] = currentWidgets.splice(draggedIndex, 1);
    currentWidgets.splice(targetIndex, 0, movedWidget);

    const updatedData: DashboardData = {
      ...data,
      widgets: currentWidgets,
    };

    onUpdateData(updatedData);
    if (onPersistLayout) {
      onPersistLayout(currentWidgets);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
    toast.success('Urutan widget diperbarui!');
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Resize Start (Mouse Down on Bottom-Right Corner)
  const handleResizeStart = (e: React.MouseEvent, index: number) => {
    if (isLocked) return;
    e.preventDefault();
    e.stopPropagation();

    const widget = data.widgets[index];
    if (!widget) return;

    const blockEl = (e.currentTarget.parentElement as HTMLElement);
    const rect = blockEl.getBoundingClientRect();

    const currentSpan = widget.layout?.colSpan || getDefaultColSpan(widget.type);
    const currentHeight = widget.layout?.heightPx || rect.height;

    setResizingIndex(index);
    setResizeMetrics({
      colSpan: currentSpan,
      heightPx: currentHeight,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
    });
  };

  // Handle global mousemove & mouseup during resize
  useEffect(() => {
    if (resizingIndex === null || !resizeMetrics || !containerRef.current) return;

    const containerWidth = containerRef.current.clientWidth;
    const singleColWidth = containerWidth / 12;

    const onMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeMetrics.startX;
      const deltaY = e.clientY - resizeMetrics.startY;

      const proposedWidth = Math.max(120, resizeMetrics.startWidth + deltaX);
      const rawSpan = Math.round(proposedWidth / singleColWidth);

      // Snap rawSpan to nearest in SNAP_COL_SPANS (3, 4, 6, 8, 12)
      let snappedSpan = SNAP_COL_SPANS[0];
      let minDiff = Infinity;
      for (const span of SNAP_COL_SPANS) {
        const diff = Math.abs(rawSpan - span);
        if (diff < minDiff) {
          minDiff = diff;
          snappedSpan = span;
        }
      }

      const proposedHeight = Math.max(200, Math.min(850, Math.round(resizeMetrics.startHeight + deltaY)));

      setResizeMetrics((prev) =>
        prev
          ? {
              ...prev,
              colSpan: snappedSpan,
              heightPx: proposedHeight,
            }
          : null
      );
    };

    const onMouseUp = () => {
      if (resizingIndex !== null && resizeMetrics) {
        const currentWidgets = [...data.widgets];
        const widget = currentWidgets[resizingIndex];
        if (widget) {
          currentWidgets[resizingIndex] = {
            ...widget,
            layout: {
              ...(widget.layout || {}),
              colSpan: resizeMetrics.colSpan,
              heightPx: resizeMetrics.heightPx,
            },
          };

          const updatedData = { ...data, widgets: currentWidgets };
          onUpdateData(updatedData);
          if (onPersistLayout) {
            onPersistLayout(currentWidgets);
          }
        }
      }

      setResizingIndex(null);
      setResizeMetrics(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [resizingIndex, resizeMetrics, data, onUpdateData, onPersistLayout]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* ── 12-Column Drag & Drop Grid ── */}
      <div
        ref={containerRef}
        className="db-12-col-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: '12px',
          width: '100%',
          position: 'relative',
        }}
      >
        {data.widgets.map((widget, index) => {
          const isBeingResized = resizingIndex === index;
          const effectiveColSpan = isBeingResized && resizeMetrics
            ? resizeMetrics.colSpan
            : widget.layout?.colSpan || getDefaultColSpan(widget.type);

          const effectiveHeight = isBeingResized && resizeMetrics
            ? resizeMetrics.heightPx
            : widget.layout?.heightPx;

          const isDraggingThis = draggedIndex === index;
          const isDragOverThis = dragOverIndex === index && draggedIndex !== index;
          const isSelected = selectedIndices.includes(index);

          // Toggle card selection for AI canvas
          const handleToggleSelect = (e: React.MouseEvent) => {
            e.stopPropagation();
            setSelectedIndices(prev => {
              const next = prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index];
              return next;
            });
            if (!isAiCanvasOpen) setIsAiCanvasOpen(true);
          };

          // Click on card body itself also selects and connects to AI
          const handleCardClick = (e: React.MouseEvent) => {
            if ((e.target as HTMLElement).closest('.db-widget-select-btn')) return;
            if ((e.target as HTMLElement).closest('button')) return;
            setSelectedIndices(prev => {
              const next = prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index];
              return next;
            });
            if (!isAiCanvasOpen) setIsAiCanvasOpen(true);
          };

          return (
            <div
              key={`widget-${index}-${widget.type}`}
              className={`db-grid-widget-item${canEdit && isSelected ? ' db-grid-widget-selected' : ''}`}
              draggable={canEdit && !isLocked}
              onDragStart={(e) => canEdit && handleDragStart(e, index)}
              onDragOver={(e) => canEdit && handleDragOver(e, index)}
              onDragLeave={canEdit ? handleDragLeave : undefined}
              onDrop={(e) => canEdit && handleDrop(e, index)}
              onDragEnd={canEdit ? handleDragEnd : undefined}
              onClick={canEdit ? handleCardClick : undefined}
              style={{
                gridColumn: `span ${effectiveColSpan}`,
                height: effectiveHeight ? `${effectiveHeight}px` : undefined,
                minHeight: '220px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '12px',
                border: canEdit && isSelected
                  ? '2px solid #2563EB'
                  : canEdit && isDragOverThis
                  ? '2px dashed #2563EB'
                  : canEdit && isBeingResized
                  ? '2px solid #2563EB'
                  : '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                boxShadow: canEdit && isSelected
                  ? '0 0 0 3px rgba(37, 99, 235, 0.18), 0 4px 16px rgba(37, 99, 235, 0.12)'
                  : canEdit && isDragOverThis
                  ? '0 0 0 3px rgba(37, 99, 235, 0.15)'
                  : canEdit && isDraggingThis
                  ? 'none'
                  : '0 1px 3px rgba(0, 0, 0, 0.05)',
                opacity: canEdit && isDraggingThis ? 0.4 : 1,
                transition: isBeingResized ? 'none' : 'box-shadow 0.2s ease, border-color 0.2s ease',
                overflow: 'hidden',
                cursor: canEdit ? 'pointer' : 'default',
              }}
            >
              {/* ── Top Control Bar (Only rendered when user can edit) ── */}
              {canEdit && (
                <div
                  className="db-grid-ctrl-bar"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 6px',
                    background: isSelected ? 'rgba(37, 99, 235, 0.06)' : 'transparent',
                    borderBottom: isSelected ? '1px solid rgba(37, 99, 235, 0.18)' : '1px solid transparent',
                    minHeight: '22px',
                    transition: 'background 0.15s ease, border-color 0.15s ease',
                  }}
                >
                  {!isLocked ? (
                    <div
                      title="Tarik / geser untuk memindahkan posisi card"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'grab',
                        padding: '2px 4px',
                        borderRadius: '4px',
                        color: isSelected ? '#2563EB' : '#94A3B8',
                      }}
                    >
                      <GripVertical size={13} />
                    </div>
                  ) : (
                    <div style={{ width: '13px' }} />
                  )}

                  {/* + Icon Button → Connect to AI Assistant */}
                  <button
                    type="button"
                    className={`db-widget-select-btn${isSelected ? ' selected' : ''}`}
                    onClick={handleToggleSelect}
                    title={isSelected ? 'Lepas fokus dari AI Assistant' : 'Hubungkan card ini ke AI Assistant (+)'}
                    style={{
                      width: '20px',
                      height: '20px',
                      padding: 0,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isSelected ? (
                      <Sparkles size={10} />
                    ) : (
                      <Plus size={11} strokeWidth={2.5} />
                    )}
                  </button>
                </div>
              )}

              {/* ── Selection Overlay (Only when user can edit) ── */}
              {canEdit && isSelected && (
                <div className="db-widget-select-overlay" onClick={handleCardClick}>
                  <div className="db-widget-select-badge">
                    <Sparkles size={9} />
                    <span>Terpilih</span>
                  </div>
                </div>
              )}

              {/* ── Widget Body ── */}
              <div
                className="db-widget-body"
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  overflowY: 'auto',
                  padding: canEdit ? '4px 6px' : '10px 12px',
                }}
              >
                <WidgetRenderer
                  widget={widget}
                  originalIndex={index}
                />
              </div>

              {/* ── Corner Resize Handle (Bottom-Right, Only when Unlocked and Editable) ── */}
              {!isLocked && canEdit && (
                <div
                  className="db-resize-handle"
                  onMouseDown={(e) => handleResizeStart(e, index)}
                  title="Tarik sudut ini untuk memperbesar/memperkecil widget (ke samping & ke atas)"
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: '18px',
                    height: '18px',
                    cursor: 'nwse-resize',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'flex-end',
                    padding: '2px',
                    zIndex: 20,
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ color: '#94A3B8' }}
                  >
                    <path
                      d="M10 2L2 10M10 6L6 10M10 10H10.01"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              )}

              {/* ── Live Resize Tooltip Badge ── */}
              {isBeingResized && resizeMetrics && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '22px',
                    right: '8px',
                    backgroundColor: '#0F172A',
                    color: '#FFFFFF',
                    padding: '3px 8px',
                    borderRadius: '5px',
                    fontSize: '10px',
                    fontWeight: 600,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    zIndex: 50,
                    pointerEvents: 'none',
                  }}
                >
                  Lebar: {resizeMetrics.colSpan}/12 ({Math.round((resizeMetrics.colSpan / 12) * 100)}%) · Tinggi: {resizeMetrics.heightPx}px
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Floating AI Canvas (Only for editors) ── */}
      {canEdit && (
        <DashboardAiCanvas
          isOpen={isAiCanvasOpen}
          dashboardId={dashboardId}
          dashboardData={data}
          selectedIndices={selectedIndices}
          onMorphWidget={onMorphWidget}
          onToggleSelect={(idx) => {
            setSelectedIndices((prev) =>
              prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
            );
          }}
          onClearSelection={() => setSelectedIndices([])}
          onClose={() => {
            setIsAiCanvasOpen(false);
            setSelectedIndices([]);
          }}
        />
      )}

      {/* ── Floating AI Canvas Launch Button (when closed, editor only) ── */}
      {canEdit && !isAiCanvasOpen && (
        <button
          type="button"
          className="canvas-launcher"
          onClick={() => setIsAiCanvasOpen(true)}
          aria-label="Buka Brilian AI Canvas"
          title="Buka Brilian AI Canvas"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
            <path d="M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z" />
          </svg>
          <i />
        </button>
      )}
    </div>
  );
}
