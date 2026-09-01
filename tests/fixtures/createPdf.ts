/**
 * Creates a valid in-memory minimal PDF buffer with the specified number of pages.
 *
 * @param pageCount - Number of pages to include in the generated PDF
 * @returns Buffer containing the valid PDF file
 */
export function createTestPdf(pageCount: number = 1): Buffer {
  const objects: string[] = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  const kids: string[] = [];
  for (let i = 0; i < pageCount; i++) {
    kids.push(`${3 + i} 0 R`);
  }
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pageCount} >>\nendobj\n`);

  for (let i = 0; i < pageCount; i++) {
    objects.push(
      `${3 + i} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <<>> >>\nendobj\n`
    );
  }

  const body = objects.join('');
  const header = '%PDF-1.4\n';
  const offsets: number[] = [];
  let currentOffset = header.length;

  for (const obj of objects) {
    offsets.push(currentOffset);
    currentOffset += Buffer.byteLength(obj);
  }

  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${off.toString().padStart(10, '0')} 00000 n \n`;
  }

  const startXref = currentOffset;
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`;

  return Buffer.from(header + body + xref + trailer);
}
