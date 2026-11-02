---
title: "AI Assistant & RAG Querying"
description: "Conversing with the enterprise AI Assistant, source page citation tracking, automated Markdown tables, and session exports."
---

The **AI Assistant** (`/chat`) provides an interactive conversational workspace to analyze, question, and cross-reference documents stored in the knowledge base.

---

## 1. Starting a Conversation

1. Navigate to **AI Assistant** (`/chat`).
2. Type your question into the bottom input prompt or click any of the suggested prompt pills.
3. Press **Enter** or click send.
4. The system executes semantic vector retrieval against pgvector, filters records by your access clearance, and streams the verified answer in real time.

---

## 2. Page-Level Citations & Verification Drawer

Every substantive fact produced by the AI is backed by transparent sourcing:
- Citations appear below the message (e.g., `📄 Annual Report 2025.pdf (Page 14)`).
- **Click to Inspect:** Clicking any citation badge opens the **Citation Drawer** on the right side of the screen, revealing the verbatim text excerpt and source page location for zero-friction auditing.

---

## 3. Automated Markdown Table Formatting

Whenever answers reference comparative metrics, schedules, or tabular figures:
- The system automatically enforces strict **Markdown Table** output with structured headers and numeric alignments.
- Tables can be copied directly with one click for pasting into Microsoft Excel or Word.

---

## 4. Session Exports & Feedback

- **Export Chat**: Download the entire conversation thread as formatted Markdown (`.md`) or text for meeting records.
- **Feedback**: Rate answers with thumbs-up or thumbs-down buttons to help system administrators track response accuracy and knowledge gaps.

