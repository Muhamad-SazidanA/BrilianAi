import {
  BarChartWidget,
  LineChartWidget,
  PieChartWidget,
  AreaChartWidget,
  TableWidget,
  DashboardWidget,
  MorphableChartType,
  ChartItem,
} from '@/types/dashboard';

/**
 * Ekstraksi items kuantitatif dari TableWidget secara cerdas.
 * Mencari kolom angka/persentase secara otomatis dan menjadikannya value.
 */
export function extractChartItemsFromTable(table: TableWidget): { items: ChartItem[]; unit?: string } {
  let numColIdx = -1;
  const labelColIdx = 0;

  if (table.rows.length > 0) {
    const firstRow = table.rows[0];
    for (let c = firstRow.length - 1; c >= 0; c--) {
      const cell = String(firstRow[c] || '');
      const val = cell.replace(/[^0-9.,-]/g, '').replace(',', '.');
      if (!isNaN(parseFloat(val)) && parseFloat(val) !== 0) {
        numColIdx = c;
        break;
      }
    }
    // Jika tidak ditemukan kolom angka eksplisit, ambil kolom kedua jika ada
    if (numColIdx === -1 && table.columns.length > 1) {
      numColIdx = 1;
    }
  }

  const items: ChartItem[] = table.rows.map((row, idx) => {
    const rawVal = numColIdx !== -1 && row[numColIdx] ? String(row[numColIdx]) : String(idx + 1);
    const cleaned = rawVal.replace(/[^0-9.,-]/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    const value = isNaN(parsed) ? idx + 1 : parsed;
    const label = String(row[labelColIdx] || `Item ${idx + 1}`);
    return { label, value };
  });

  return {
    items: items.slice(0, 20),
    unit: numColIdx !== -1 ? table.columns[numColIdx] : undefined,
  };
}

export function convertTableToBarChart(table: TableWidget): BarChartWidget {
  const { items, unit } = extractChartItemsFromTable(table);
  return {
    type: 'bar_chart',
    title: table.title,
    items,
    unit,
  };
}

export function convertTableToLineChart(table: TableWidget): LineChartWidget {
  const { items, unit } = extractChartItemsFromTable(table);
  return {
    type: 'line_chart',
    title: table.title,
    items,
    unit,
  };
}

export function convertTableToPieChart(table: TableWidget): PieChartWidget {
  const { items, unit } = extractChartItemsFromTable(table);
  return {
    type: 'pie_chart',
    title: table.title,
    items,
    unit,
  };
}

export function convertTableToAreaChart(table: TableWidget): AreaChartWidget {
  const { items, unit } = extractChartItemsFromTable(table);
  return {
    type: 'area_chart',
    title: table.title,
    items,
    unit,
  };
}

export function convertChartToTable(
  chart: BarChartWidget | LineChartWidget | PieChartWidget | AreaChartWidget
): TableWidget {
  const columns = ['Kategori / Item', chart.unit || 'Nilai'];
  const rows = chart.items.map((item) => [item.label, String(item.value)]);

  return {
    type: 'table',
    title: chart.title,
    columns,
    rows,
  };
}

export function convertBarChartToTable(chart: BarChartWidget): TableWidget {
  return convertChartToTable(chart);
}

/**
 * Melakukan morphing widget secara dinamis berdasarkan targetType.
 * Mendukung transisi bebas antara bar_chart, line_chart, pie_chart, area_chart, dan table.
 */
export function morphWidget(
  widget: DashboardWidget,
  targetType: MorphableChartType
): DashboardWidget {
  if (widget.type === targetType) return widget;

  // 1. Dari Table ke salah satu Chart
  if (widget.type === 'table') {
    const table = widget as TableWidget;
    switch (targetType) {
      case 'bar_chart':  return convertTableToBarChart(table);
      case 'line_chart': return convertTableToLineChart(table);
      case 'pie_chart':  return convertTableToPieChart(table);
      case 'area_chart': return convertTableToAreaChart(table);
      default: return widget;
    }
  }

  // 2. Dari salah satu Chart ke Table atau Chart lainnya
  if (
    widget.type === 'bar_chart' ||
    widget.type === 'line_chart' ||
    widget.type === 'pie_chart' ||
    widget.type === 'area_chart'
  ) {
    const chart = widget as (BarChartWidget | LineChartWidget | PieChartWidget | AreaChartWidget);

    if (targetType === 'table') {
      return convertChartToTable(chart);
    }

    if (
      targetType === 'bar_chart' ||
      targetType === 'line_chart' ||
      targetType === 'pie_chart' ||
      targetType === 'area_chart'
    ) {
      return {
        ...chart,
        type: targetType,
      };
    }
  }

  return widget;
}
