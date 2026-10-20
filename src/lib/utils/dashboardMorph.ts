import { BarChartWidget, TableWidget, DashboardWidget } from '@/types/dashboard';

/**
 * Konversi TableWidget menjadi BarChartWidget secara cerdas.
 * Mencari kolom angka/persentase secara otomatis dan menjadikannya value.
 */
export function convertTableToBarChart(table: TableWidget): BarChartWidget {
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

  const items = table.rows.map((row, idx) => {
    const rawVal = numColIdx !== -1 && row[numColIdx] ? String(row[numColIdx]) : String(idx + 1);
    const cleaned = rawVal.replace(/[^0-9.,-]/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    const value = isNaN(parsed) ? idx + 1 : parsed;
    const label = String(row[labelColIdx] || `Item ${idx + 1}`);
    return { label, value };
  });

  return {
    type: 'bar_chart',
    title: table.title,
    items: items.slice(0, 20),
    unit: numColIdx !== -1 ? table.columns[numColIdx] : undefined,
  };
}

/**
 * Konversi BarChartWidget menjadi TableWidget secara langsung.
 */
export function convertBarChartToTable(chart: BarChartWidget): TableWidget {
  const columns = ['Kategori / Item', chart.unit || 'Nilai'];
  const rows = chart.items.map((item) => [item.label, String(item.value)]);

  return {
    type: 'table',
    title: chart.title,
    columns,
    rows,
  };
}

/**
 * Melakukan toggle / morphing widget secara dinamis berdasarkan targetType
 */
export function morphWidget(
  widget: DashboardWidget,
  targetType: 'bar_chart' | 'table'
): DashboardWidget {
  if (widget.type === 'table' && targetType === 'bar_chart') {
    return convertTableToBarChart(widget as TableWidget);
  }
  if (widget.type === 'bar_chart' && targetType === 'table') {
    return convertBarChartToTable(widget as BarChartWidget);
  }
  return widget;
}
