// =====================================================
// Dashboard Types — BrilianAi Interactive Dashboard
// AI response → structured JSON → visual widgets
// =====================================================

export type DashboardWidgetType =
  | 'stat_card'
  | 'bar_chart'
  | 'list'
  | 'table'
  | 'timeline'
  | 'comparison'
  | 'text_summary';

export interface StatCardWidget {
  type: 'stat_card';
  title: string;
  value: string;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
}

export interface BarChartWidget {
  type: 'bar_chart';
  title: string;
  items: Array<{
    label: string;
    value: number;
    color?: string;
  }>;
  unit?: string;
}

export interface ListWidget {
  type: 'list';
  title: string;
  icon?: string;
  items: Array<{
    label: string;
    description?: string;
    badge?: string;
    badgeColor?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
  }>;
}

export interface TableWidget {
  type: 'table';
  title: string;
  columns: string[];
  rows: string[][];
}

export interface TimelineWidget {
  type: 'timeline';
  title: string;
  events: Array<{
    date: string;
    title: string;
    description?: string;
    status?: 'done' | 'active' | 'pending';
  }>;
}

export interface ComparisonWidget {
  type: 'comparison';
  title: string;
  items: Array<{
    label: string;
    values: Record<string, string>;
  }>;
  headers: string[];
}

export interface TextSummaryWidget {
  type: 'text_summary';
  title: string;
  content: string;
  highlight?: string;
}

export type DashboardWidget =
  | StatCardWidget
  | BarChartWidget
  | ListWidget
  | TableWidget
  | TimelineWidget
  | ComparisonWidget
  | TextSummaryWidget;

export interface DashboardData {
  id?: string;
  title: string;
  subtitle?: string;
  sourceMessageId: string;
  sourceQuery: string;
  widgets: DashboardWidget[];
  createdAt?: string;
  shareId?: string;
}

export interface DashboardRecord {
  dashboard_id: string;
  message_id: string;
  session_id?: string | null;
  user_id?: string | null;
  title: string;
  data: DashboardData;
  views_count: number;
  created_at: string;
  updated_at: string;
}
