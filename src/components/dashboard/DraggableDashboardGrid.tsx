'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  GripVertical,
  Lock,
  Unlock,
  RotateCcw,
  Check,
  Sparkles,
  Maximize2,
  Minimize2,
  Grid,
} from 'lucide-react';
import {
  DashboardData,
  DashboardWidget,
  MorphableChartType,
  WidgetLayout,
} from '@/types/dashboard';
import { WidgetRenderer } from '@/components/chat/AiDashboardPreview';
import CardFloatingCopilot from '@/components/dashboard/CardFloatingCopilot';
import { toast } from 'sonner';

interface DraggableDashboardGridProps {
  dashboardId: string;
  data: DashboardData;
  isLocked: boolean;
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

  // Copilot active index
  const [activeCopilotIndex, setActiveCopilotIndex] = useState<number | null>(null);

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

  // Quick resize button (direct set colSpan)
  const handleSetColSpan = (index: number, newColSpan: number) => {
    if (isLocked) return;
    const currentWidgets = [...data.widgets];
    const widget = currentWidgets[index];
    if (!widget) return;

    currentWidgets[index] = {
      ...widget,
      layout: {
        ...(widget.layout || {}),
        colSpan: newColSpan,
      },
    };

    const updatedData = { ...data, widgets: currentWidgets };
    onUpdateData(updatedData);
    if (onPersistLayout) {
      onPersistLayout(currentWidgets);
    }
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

          const isMorphable =
            widget.type === 'table' ||
            widget.type === 'bar_chart' ||
            widget.type === 'line_chart' ||
            widget.type === 'pie_chart' ||
            widget.type === 'area_chart';

          const handleMorphTo = onMorphWidget && isMorphable
            ? (targetType: MorphableChartType) => {
                onMorphWidget(index, targetType);
              }
            : undefined;

          return (
            <div
              key={`widget-${index}-${widget.type}`}
              className="db-grid-widget-item"
              draggable={!isLocked}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              style={{
                gridColumn: `span ${effectiveColSpan}`,
                height: effectiveHeight ? `${effectiveHeight}px` : undefined,
                minHeight: '220px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '12px',
                border: isDragOverThis
                  ? '2px dashed #2563EB'
                  : isBeingResized
                  ? '2px solid #2563EB'
                  : '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                boxShadow: isDragOverThis
                  ? '0 0 0 3px rgba(37, 99, 235, 0.15)'
                  : isDraggingThis
                  ? 'none'
                  : '0 1px 3px rgba(0, 0, 0, 0.05)',
                opacity: isDraggingThis ? 0.4 : 1,
                transition: isBeingResized ? 'none' : 'box-shadow 0.15s ease, border-color 0.15s ease',
                overflow: 'hidden',
              }}
            >
              {/* ── Top Drag & Resize Control Bar (Only when Unlocked) ── */}
              {!isLocked && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '3px 8px',
                    backgroundColor: '#F8FAFC',
                    borderBottom: '1px solid #F1F5F9',
                    fontSize: '10px',
                    color: '#64748B',
                    userSelect: 'none',
                    cursor: 'grab',
                  }}
                  title="Klik & tarik bar ini untuk memindahkan posisi widget"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <GripVertical size={12} color="#94A3B8" />
                    <span style={{ fontWeight: 600, fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Drag Blok
                    </span>
                  </div>

                  {/* Quick Span Selector Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ fontSize: '9px', color: '#94A3B8', marginRight: '2px' }}>Lebar:</span>
                    {[
                      { span: 3, label: '1/4' },
                      { span: 4, label: '1/3' },
                      { span: 6, label: '1/2' },
                      { span: 8, label: '2/3' },
                      { span: 12, label: 'Full' },
                    ].map((btn) => (
                      <button
                        key={btn.span}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetColSpan(index, btn.span);
                        }}
                        style={{
                          border: 'none',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          fontSize: '9px',
                          fontWeight: effectiveColSpan === btn.span ? 700 : 500,
                          backgroundColor: effectiveColSpan === btn.span ? '#2563EB' : '#E2E8F0',
                          color: effectiveColSpan === btn.span ? '#FFFFFF' : '#475569',
                          cursor: 'pointer',
                        }}
                        title={`Ubah lebar menjadi ${btn.label} layar (${btn.span}/12)`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Widget Body ── */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  overflowY: 'auto',
                  padding: '4px 6px',
                }}
              >
                <WidgetRenderer
                  widget={widget}
                  originalIndex={index}
                  onMorphTo={handleMorphTo}
                  onOpenCopilot={() =>
                    setActiveCopilotIndex((prev) => (prev === index ? null : index))
                  }
                  isCopilotOpen={activeCopilotIndex === index}
                />
              </div>

              {/* ── Corner Resize Handle (Bottom-Right, Only when Unlocked) ── */}
              {!isLocked && (
                <div
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

      {/* ── Floating Copilot Dock if Opened ── */}
      {activeCopilotIndex !== null && data.widgets[activeCopilotIndex] && (
        <CardFloatingCopilot
          dashboardId={dashboardId}
          dashboardData={data}
          widget={data.widgets[activeCopilotIndex]}
          widgetIndex={activeCopilotIndex}
          onMorphWidget={onMorphWidget}
          onClose={() => setActiveCopilotIndex(null)}
        />
      )}
    </div>
  );
}
