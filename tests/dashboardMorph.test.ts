import { describe, it, expect } from 'vitest';
import {
  convertTableToBarChart,
  convertTableToLineChart,
  convertTableToPieChart,
  convertTableToAreaChart,
  convertBarChartToTable,
  convertChartToTable,
  morphWidget,
} from '../src/lib/utils/dashboardMorph';
import { TableWidget, BarChartWidget, LineChartWidget, PieChartWidget, AreaChartWidget } from '../src/types/dashboard';

describe('dashboardMorph utility', () => {
  const sampleTable: TableWidget = {
    type: 'table',
    title: 'Distribusi Dokumen Per Divisi',
    columns: ['Divisi', 'Jumlah'],
    rows: [
      ['Teknologi Informasi', '45'],
      ['Sumber Daya Manusia', '28'],
      ['Keuangan & Akuntansi', '19'],
    ],
  };

  const sampleChart: BarChartWidget = {
    type: 'bar_chart',
    title: 'Statistik Pengajuan Klaim',
    items: [
      { label: 'Januari', value: 120 },
      { label: 'Februari', value: 155 },
      { label: 'Maret', value: 98 },
    ],
    unit: 'kasus',
  };

  it('should convert TableWidget into BarChartWidget accurately', () => {
    const chart = convertTableToBarChart(sampleTable);
    expect(chart.type).toBe('bar_chart');
    expect(chart.title).toBe(sampleTable.title);
    expect(chart.items).toHaveLength(3);
    expect(chart.items[0]).toEqual({ label: 'Teknologi Informasi', value: 45 });
    expect(chart.items[1]).toEqual({ label: 'Sumber Daya Manusia', value: 28 });
    expect(chart.items[2]).toEqual({ label: 'Keuangan & Akuntansi', value: 19 });
    expect(chart.unit).toBe('Jumlah');
  });

  it('should convert TableWidget into LineChartWidget, PieChartWidget, and AreaChartWidget', () => {
    const lineChart = convertTableToLineChart(sampleTable);
    expect(lineChart.type).toBe('line_chart');
    expect(lineChart.items).toHaveLength(3);

    const pieChart = convertTableToPieChart(sampleTable);
    expect(pieChart.type).toBe('pie_chart');
    expect(pieChart.items).toHaveLength(3);

    const areaChart = convertTableToAreaChart(sampleTable);
    expect(areaChart.type).toBe('area_chart');
    expect(areaChart.items).toHaveLength(3);
  });

  it('should convert BarChartWidget into TableWidget accurately', () => {
    const table = convertBarChartToTable(sampleChart);
    expect(table.type).toBe('table');
    expect(table.title).toBe(sampleChart.title);
    expect(table.columns).toEqual(['Kategori / Item', 'kasus']);
    expect(table.rows).toHaveLength(3);
    expect(table.rows[0]).toEqual(['Januari', '120']);
    expect(table.rows[1]).toEqual(['Februari', '155']);
    expect(table.rows[2]).toEqual(['Maret', '98']);
  });

  it('should dynamically morph between all chart types and table using morphWidget dispatcher', () => {
    // Table -> Bar
    const toBar = morphWidget(sampleTable, 'bar_chart');
    expect(toBar.type).toBe('bar_chart');

    // Bar -> Line
    const toLine = morphWidget(toBar, 'line_chart');
    expect(toLine.type).toBe('line_chart');

    // Line -> Pie
    const toPie = morphWidget(toLine, 'pie_chart');
    expect(toPie.type).toBe('pie_chart');

    // Pie -> Area
    const toArea = morphWidget(toPie, 'area_chart');
    expect(toArea.type).toBe('area_chart');

    // Area -> Table
    const backToTable = morphWidget(toArea, 'table');
    expect(backToTable.type).toBe('table');
  });

  it('should handle percentage or currency characters gracefully in numeric columns', () => {
    const tableWithCurrency: TableWidget = {
      type: 'table',
      title: 'Anggaran',
      columns: ['Program', 'Biaya'],
      rows: [
        ['Pelatihan', 'Rp 15.000.000'],
        ['Operasional', '85%'],
      ],
    };
    const chart = convertTableToBarChart(tableWithCurrency);
    expect(chart.items[0].label).toBe('Pelatihan');
    expect(chart.items[0].value).toBe(15.0);
    expect(chart.items[1].value).toBe(85);
  });
});
