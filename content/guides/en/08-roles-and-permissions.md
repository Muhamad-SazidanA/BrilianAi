---
title: "Roles & Permissions Matrix"
description: "Granular RBAC permission configuration, ABAC document classification filtering, and system role governance."
---

The **Roles & Permissions** module (`/roles`) provides governance over access policies using combined **Role-Based Access Control (RBAC)** and **Attribute-Based Access Control (ABAC)**.

---

## 1. Built-in System Roles

Brilian.Ai includes 5 ready-to-use default roles:
1. **Super Administrator (`admin`)**: Unrestricted access across all modules, documents, AI curation, user management, and security audit logs.
2. **Knowledge Manager & Editor (`editor`)**: Authorized to upload documents, manage knowledge status, execute curation pipelines, and query the AI.
3. **Member / Viewer (`member`)**: Standard operational access to read active documents and ask questions in AI chat.
4. **Chatbot Specialist (`chat_only`)**: Dedicated access restricted strictly to AI conversational modules.
5. **Knowledge Viewer (`knowledge_only`)**: Dedicated access restricted strictly to browsing knowledge base archives.

---

## 2. Granular Permission Keys

Permissions can be customized per role:
- **Documents**: `documents:read`, `documents:upload`, `documents:toggle_active`, `documents:delete`.
- **AI Curation**: `curation:trigger`, `curation:edit`, `curation:delete`.
- **AI Chat**: `chat:query`, `chat:export`.
- **Administration**: `users:manage`, `roles:manage`, `audit:read`.

---

## 3. Permitted Classifications (ABAC)

Beyond functional permissions, roles specify **Allowed Document Classifications**:
- Example: The `member` role is assigned `["Publik", "Internal"]`.
- Documents tagged as `Rahasia (Confidential)` or `Sangat Rahasia (Top Secret)` are excluded from pgvector similarity calculations when a `member` queries the system.

