---
title: "Authentication & Session Security"
description: "Guide to system sign-in, self-service password updates, administrator password resets, and 30-minute inactivity auto-logout."
---

Brilian.Ai's authentication system conforms to strict enterprise and financial-grade standards, leveraging `scrypt` memory-hard password hashing, brute-force IP rate limiting, and automated inactivity session timeouts.

---

## 1. Sign In to Your Account

1. Navigate to `/login`.
2. Enter your registered username or email address (e.g., `superadmin@brilian.ai`).
3. Enter your password and click **Sign in**.
4. The system routes you directly to your primary module (Dashboard, Knowledge Base, or AI Assistant) based on your assigned role permissions.

> **Brute-Force Shield:** More than 5 failed login attempts from a single IP/account within 15 minutes will temporarily lock the credential to prevent dictionary attacks.

---

## 2. Forgot Password Policy

In compliance with enterprise data privacy regulations (ISO 27001 & UU PDP), self-service email reset links are restricted:
- Click **Forgot password?** on the login card.
- A concise guidance card instructs you to reach out to your **Workspace Administrator**. Administrators can issue temporary credentials directly via the User Management module.

---

## 3. Self-Service Password Change

Any logged-in user can change their password at any time:
1. Click your profile avatar in the bottom-left sidebar.
2. Select **Change Password**.
3. Provide your **Current Password** to verify your identity.
4. Enter your **New Password** (minimum 6 characters) and re-type it to confirm.
5. Click **Simpan Kata Sandi Baru**. The password is immediately hashed using salted `scrypt`.

---

## 4. Administrator Password Reset

Available exclusively to **Super Administrators**:
1. Open the **Manage Users** menu (`/users`).
2. Locate the user requesting a reset in the table.
3. Click the key icon (**Reset Password**) in the actions column.
4. Choose between:
   - **Generate Secure Random Password**: The system produces a cryptographically secure temporary password.
   - **Specify New Password Manually**: Set a manual temporary password.
5. Confirm the reset, copy the generated password, and deliver it securely to the user.

---

## 5. Inactivity Timeout (30-Minute Auto-Logout)

To guard against unauthorized physical access to unattended terminals:
- The system continuously monitors user interactions (mouse movement, keystrokes, scrolling, touch).
- **Pre-Timeout Warning (2 Minutes Remaining):** If no interaction occurs for 28 minutes, an alert dialog appears with a live countdown `MM:SS`. Click **Stay Signed In** or interact with the screen to reset the timer.
- **Auto-Logout (30 Minutes):** If the timer reaches zero, the server session is revoked, secure cookies are flushed, and you are redirected to `/login` with an informative session timeout banner.
- **Cross-Tab Synchronization:** Activity in another browser tab automatically resets the idle timer across all active tabs.

