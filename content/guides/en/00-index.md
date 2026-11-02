---
title: "Getting Started with Brilian.Ai"
description: "Introductory guide to Brilian.Ai Enterprise Knowledge Base, AI Document Ingestion, and pgvector-backed AI Copilot."
---

Welcome to the **Brilian.Ai Help Center**! This enterprise platform enables organizations to automate document comprehension, AI Vision OCR text extraction, data curation, and verified question-answering (*Retrieval-Augmented Generation / RAG*) with strict Zero-Data-Retention privacy guarantees.

[Baca panduan ini dalam Bahasa Indonesia](/docs/id/00-index)

---

## Core System Workflow

To make the most of Brilian.Ai, follow this recommended end-to-end workflow:

1. **Authentication & Sign In**: Access your workspace credentials via the secure login portal or enterprise passkey.
2. **Document Ingestion & Upload**: Ingest multi-format corporate files (*PDF, Word .docx, Excel .xlsx, or CSV*). Files are processed through text extraction and high-precision AI Vision OCR.
3. **Knowledge Base Repository**: Toggle document activation status (*Active Knowledge*) and assign data security classifications (*Public, Internal, Confidential, Top Secret*).
4. **AI Curation Studio**: Review zero-token automatic tabular insights or perform page-by-page manual fact verification.
5. **AI Assistant (Chat RAG)**: Ask strategic questions, audit policies, and analyze data with verifiable citations linking to original source pages.
6. **AI Dynamic Dashboard**: Organize interactive analytics cards with 2D resizable handles, draggable positioning, and the floating Copilot Canvas.
7. **Governance & Audit Logs**: Workspace Administrators review pending account approvals, configure RBAC/ABAC role matrices, and monitor immutable security audit logs.

---

## User Guide Chapters

Explore the full documentation organized by module:

1. [Authentication & Session Security](01-authentication) — Sign-in, self-service password changes, admin resets, and the 30-minute inactivity auto-logout.
2. [Document Upload & Ingestion](02-upload-and-ingestion) — PDF, Word, Excel, CSV support, sliding-window chunking, and 1024-dim pgvector embeddings.
3. [Knowledge Base Management](03-knowledge-base) — Active knowledge toggle, privacy classifications, and document search.
4. [AI Curation Studio](04-ai-curation) — Zero-token tabular insight extraction, page-level curation, and fact verification.
5. [AI Assistant & RAG Querying](05-ai-chat) — Cosine similarity retrieval, citation tracking, Markdown tables, and session exports.
6. [Dynamic Dashboard & Copilot Canvas](06-ai-dashboard) — Analytics visualization, interactive grid, responsive layouts, and AI-driven widget generation.
7. [User Management](07-user-management) — Account approvals, user deactivation, and credential resets.
8. [Roles & Permissions](08-roles-and-permissions) — Granular ABAC matrix configuration and document classification access controls.
9. [Audit Logs & Enterprise Compliance](09-audit-logs) — Comprehensive activity logs, chat turn audit trails, and CSV/JSON export capabilities.

---

## Key Terminology

- **Active Knowledge**: Documents activated into AI vector memory. Only active documents are referenced by the AI Assistant when answering queries.
- **pgvector 1024-d**: PostgreSQL vector database storing 1024-dimensional semantic chunk embeddings for high-speed cosine similarity search.
- **Curated Insights**: Verified factual findings extracted from documents, given top priority during AI grounding to eliminate hallucinations.
- **ABAC (Attribute-Based Access Control)**: Security governance restricting document retrieval by classification (*Public, Internal, Confidential, Top Secret*) and user department.
