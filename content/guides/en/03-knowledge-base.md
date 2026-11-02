---
title: "Knowledge Base Management"
description: "Managing active knowledge status, privacy classifications, document renaming, and safe deletion."
---

The **Knowledge Base** module (`/documents`) is your organization's central knowledge repository. Administrators and editors control which documents the AI Assistant is allowed to reference.

---

## 1. Active Knowledge Status

Uploaded documents do not automatically become active reference sources:
- **Active Document (Active Knowledge = True)**: The document chunks are indexed in live vector searches when users ask questions to the AI Assistant.
- **Inactive Document (Active Knowledge = False)**: The document remains safely stored in PostgreSQL, but is ignored during AI searches. Ideal for superseded policies, drafts, or legacy archives.

> **Toggle Activation:** Click the switch in the **Knowledge Status** column. The update takes effect immediately with zero re-indexing delay.

---

## 2. Privacy Classifications

Every document carries a confidentiality tag to prevent unauthorized data exposure:
- **Public**: Accessible to all team members and viewers.
- **Internal**: Standard operational business documents.
- **Confidential (Rahasia)**: Restricted to managers, department heads, and editors.
- **Top Secret (Sangat Rahasia)**: Accessible only by Super Administrators and executive leadership.

When a user chats with the AI, pgvector searches are filtered at the database query level to ensure users never see or query documents above their clearance level.

---

## 3. Renaming & Deleting Documents

- **Rename**: Click the pencil icon to assign a clear descriptive display name to any archive.
- **Delete**: Click the trash icon to permanently remove an uploaded batch. PostgreSQL cascades deletions to all associated text chunks, embeddings, and curated insights.

