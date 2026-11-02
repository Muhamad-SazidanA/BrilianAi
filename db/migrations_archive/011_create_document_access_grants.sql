-- Migration 011: Document Access Grants (User-Level Permissions ACL)
-- Mendukung penambahan akses spesifik per-user (Additive Grant) oleh Admin atau Pemilik Dokumen
-- Access level: 'viewer' (hanya baca & tanya AI) atau 'editor' (bisa edit kurasi & metadata)

CREATE TABLE IF NOT EXISTS document_access_grants (
    id BIGSERIAL PRIMARY KEY,
    upload_batch_id UUID NOT NULL REFERENCES upload_batches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_level VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (access_level IN ('viewer', 'editor')),
    granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_doc_user_grant UNIQUE (upload_batch_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_grants_batch ON document_access_grants (upload_batch_id);
CREATE INDEX IF NOT EXISTS idx_doc_grants_user ON document_access_grants (user_id);
CREATE INDEX IF NOT EXISTS idx_doc_grants_level ON document_access_grants (access_level);
