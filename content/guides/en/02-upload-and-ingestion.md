---
title: "Document Upload & Ingestion"
description: "End-to-end processing of PDF, Word, Excel, and CSV files, AI Vision OCR extraction, sliding-window chunking, and pgvector storage."
---

Brilian.Ai's ingestion pipeline transforms raw business documents into structured, vector-indexed semantic units ready for instant artificial intelligence querying.

---

## 1. Supported Document Formats

The platform natively processes 4 standard enterprise document types:
1. **PDF (`.pdf`)**: Reports, standard operating procedures (SOPs), compliance policies, and technical manuals. Supports both native digital PDFs and scanned images.
2. **Microsoft Word (`.docx`, `.doc`)**: Official letters, contract agreements, and draft manuscripts.
3. **Microsoft Excel (`.xlsx`, `.xls`)**: Financial balance sheets, inventory tables, and data recaps.
4. **CSV (`.csv`)**: Raw tabular database exports.

---

## 2. Ingesting Documents

1. Click **Upload PDF** in the top navigation header or navigate to **Ingestion & Upload** (`/upload`).
2. Drag and drop your file into the upload zone or click to select a file from your computer (up to 50 MB per file).
3. Specify essential document metadata:
   - **Department**: Target division (e.g., Finance, Human Resources, Operations).
   - **Classification**: Privacy level (*Public, Internal, Confidential, Top Secret*).
4. Click **Start Upload & Ingest**.

---

## 3. Four-Stage Automated Pipeline

Once uploaded, files are processed through four sequential stages:
- **Stage 1: Multi-Format Text Extraction**:
  Extracts text page-by-page. For scanned images or low-contrast pages, the system activates the **Brilian Vision OCR Engine** for optical character recognition.
- **Stage 2: Sliding-Window Chunking**:
  Breaks continuous text into semantic units (800 characters with a 150-character overlap). Every chunk preserves its original source page range for precise citation tracking.
- **Stage 3: 1024-Dimensional Vector Embedding**:
  Each chunk is transformed into a dense 1024-dimensional embedding vector capturing sentence context and semantic relationships.
- **Stage 4: pgvector Persistence**:
  Chunks and embeddings are stored in PostgreSQL with pgvector cosine distance indexes, enabling sub-50ms vector similarity searches.

