---
title: "User Management"
description: "User account approval workflows, account suspension, and role assignment by Super Administrators."
---

The **Manage Users** module (`/users`) allows Super Administrators to control account lifecycles and permissions across the organization.

---

## 1. Account Approval Workflow

When a new user signs up or signs in via Google / Enterprise SSO:
- The account is assigned **Pending Approval** status.
- Pending users are blocked from querying sensitive knowledge base assets until verified.
- **Approving an Account:** Super Administrators click **Approve Account** in the users table to activate access immediately.

---

## 2. Updating Roles & Departments

Administrators can adjust user clearances at any time:
1. Click **Edit** on the user's row.
2. Select the designated role (*Super Administrator, Knowledge Manager & Editor, Member / Viewer, Chatbot Specialist, or Knowledge Viewer*).
3. Assign their business department (*Finance, Legal, Information Technology, HR*).
4. Click **Save Changes**. The updated permissions take effect immediately.

---

## 3. Account Deactivation

When an employee departs or an account requires temporary suspension:
- Click **Deactivate Account**.
- Inactive accounts are blocked at the authentication gate, and all active database sessions are revoked instantly.

