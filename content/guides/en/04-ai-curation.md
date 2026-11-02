---
title: "AI Curation Studio"
description: "Zero-Token tabular curation, page-level factual insights extraction, and verified knowledge management."
---

The **AI Curation Studio** (`/documents/[id]`) is Brilian.Ai's differentiator, preventing AI hallucinations by transforming raw documents into verified, structured facts before they are queried.

---

## 1. Dual-Chunk Architecture (Raw Text vs Curated Insights)

Data ingestion separates information into two distinct storage tiers:
1. **Raw Document Chunks**: Verbatim text segments from the original upload, indexed with pgvector embeddings.
2. **Curated Insights**: Verified summaries, policy rules, legal clauses, or financial metrics extracted from the document.

> **Grounding Precedence:** When a user queries the AI Assistant, the retrieval engine searches *Curated Insights* first. High-confidence insights take precedence over generic chunk similarity, guaranteeing deterministic answers.

---

## 2. Zero-Token Tabular Curation Engine

For tabular spreadsheets **Excel (`.xlsx`)** and **CSV**:
- The engine runs deterministic algorithmic parsing without consuming LLM API token quotas (0 Tokens / Zero API Cost).
- Automatically identifies financial totals (Revenue, Expense, Balance), generates summary metadata, and auto-activates the dataset for immediate query access.

---

## 3. Manual & AI-Assisted Curation

For PDF and Word documents:
1. Open the document detail page from the Knowledge Base table (`/documents/[id]`).
2. Navigate to the **AI Curation** tab.
3. You can:
   - **Trigger AI Auto-Curation**: The LLM reads each page and extracts synthesized factual takeaways.
   - **Add Manual Insights**: Create targeted insights, assign the exact source page number, and attach descriptive tags.
4. Mark insights as **Verified** to signal high-confidence enterprise credibility.

