import { describe, it, expect } from 'vitest';
import { convertTableToBarChart, convertBarChartToTable, morphWidget } from '../src/lib/utils/dashboardMorph';
import { TableWidget, BarChartWidget } from '../src/types/dashboard';

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

  it('should dynamically morph widget using morphWidget dispatcher', () => {
    const morphedToChart = morphWidget(sampleTable, 'bar_chart');
    expect(morphedToChart.type).toBe('bar_chart');

    const morphedBackToTable = morphWidget(morphedToChart, 'table');
    expect(morphedBackToTable.type).toBe('table');
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
