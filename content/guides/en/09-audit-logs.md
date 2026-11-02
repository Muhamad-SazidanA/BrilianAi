---
title: "Audit Logs & Enterprise Compliance"
description: "System activity trail auditing, chat turn tracking, and security log exports (CSV/JSON)."
---

The **Audit Logs** module (`/logs`) logs every security and administrative event across the platform to satisfy enterprise compliance requirements and internal forensic investigations.

---

## 1. Audited Event Categories

The system automatically records across 4 primary event domains:
1. **AUTH**: Successful/failed logins, manual/timeout logouts, password updates, and administrator password resets.
2. **DOCS**: Document uploads, knowledge status toggles, classification updates, and document deletions.
3. **CHAT**: Prompts submitted by users, token consumption, response latency, and cited document references.
4. **ADMIN**: User registrations, approvals, role reassignments, and permission matrix modifications.

---

## 2. Immutable Log Attributes

Each audit record captures comprehensive context:
- **Timestamp**: Millisecond-precision UTC timestamp.
- **Actor**: Name, email, and UUID of the user who initiated the action.
- **Client IP & User Agent**: Network IP address and browser client identifiers.
- **Resource**: Target entity identifier and human-readable label.
- **Status**: Outcome (`success` or `failed`), including rejection rationales if permission checks fail.

---

## 3. Interactive Filtering & SIEM Export

- **Interactive Search**: Filter logs by actor name, event category, action keyword, or date range.
- **CSV Export**: Export filtered log trails to structured CSV format for corporate auditors or integration into enterprise SIEM pipelines (*Splunk, Elastic, Datadog*).

