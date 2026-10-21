'use client';

import React, { useState } from 'react';
import {
  Database,
  Shield,
  Key,
  Server,
  Terminal,
  Eye,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';

interface DatabaseConnectorTabProps {
  metadata: {
    divisionId: string;
    classification: any;
    status: any;
    version: string;
    reviewDueDate: string | null;
    userGrants?: any[];
  };
  isSubmitting: boolean;
  setIsSubmitting: (submitting: boolean) => void;
  onSuccess: () => void;
  onClose: () => void;
}

export default function DatabaseConnectorTab({
  metadata,
  isSubmitting,
  setIsSubmitting,
  onSuccess,
  onClose,
}: DatabaseConnectorTabProps) {
  const [dbType, setDbType] = useState<'postgres' | 'mysql'>('postgres');
  const [sourceName, setSourceName] = useState<string>('');
  const [host, setHost] = useState<string>('localhost');
  const [port, setPort] = useState<string>('5432');
  const [database, setDatabase] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [ssl, setSsl] = useState<boolean>(false);
  const [query, setQuery] = useState<string>(
    "SELECT id, nama_produk, kategori, harga, stok FROM data_katalog WHERE status = 'aktif';"
  );

  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs: number; serverVersion?: string; error?: string } | null>(null);

  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [previewResult, setPreviewResult] = useState<{ rowCount: number; previewMarkdown: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDbTypeChange = (type: 'postgres' | 'mysql') => {
    setDbType(type);
    setPort(type === 'mysql' ? '3306' : '5432');
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    if (!host || !database || !username) {
      toast.error('Host, Database, dan Username wajib diisi.');
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/connectors/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          dbType,
          host: host.trim(),
          port: Number(port),
          database: database.trim(),
          username: username.trim(),
          password,
          ssl,
        }),
      });

      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        toast.success(`Koneksi berhasil! (${data.latencyMs}ms - ${data.serverVersion})`);
      } else {
        toast.error(`Koneksi gagal: ${data.error}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal menguji koneksi');
    } finally {
      setIsTesting(false);
    }
  };

  const handlePreview = async () => {
    if (!query.trim()) {
      toast.error('Query SQL wajib diisi.');
      return;
    }
    setIsPreviewing(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/connectors/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview',
          dbType,
          sourceName: sourceName.trim() || `${dbType.toUpperCase()} - ${database}`,
          host: host.trim(),
          port: Number(port),
          database: database.trim(),
          username: username.trim(),
          password,
          ssl,
          query: query.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengeksekusi kueri');
      }

      setPreviewResult({
        rowCount: data.preview.rowCount,
        previewMarkdown: data.preview.previewMarkdown,
      });
      toast.success(`Query berhasil dieksekusi (${data.preview.rowCount} baris sampel)!`);
    } catch (err: any) {
      setErrorMsg(err.message);
      toast.error(err.message || 'Gagal mengeksekusi query SQL');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSync = async () => {
    if (!database.trim() || !username.trim() || !query.trim()) {
      toast.error('Database, Username, dan Query SQL wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/connectors/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync',
          dbType,
          sourceName: sourceName.trim() || `${dbType.toUpperCase()} - ${database}`,
          host: host.trim(),
          port: Number(port),
          database: database.trim(),
          username: username.trim(),
          password,
          ssl,
          query: query.trim(),
          divisionId: metadata.divisionId,
          classification: metadata.classification,
          status: metadata.status,
          version: metadata.version,
          reviewDueDate: metadata.reviewDueDate,
          userGrants: metadata.userGrants,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyinkronkan data database');
      }

      toast.success(data.message || 'Data query database berhasil diindeks ke pgvector!');
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
      toast.error(err.message || 'Gagal menyinkronkan database');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
      {/* ── Database Engine Switcher ── */}
      <div>
        <label style={{ fontSize: '11px', fontWeight: 650, color: '#334155', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
          <Database size={12} color="#7E22CE" />
          <span>Pilih Mesin Database RDBMS</span>
        </label>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => handleDbTypeChange('postgres')}
            style={{
              flex: 1,
              padding: '6px',
              fontSize: '11px',
              fontWeight: dbType === 'postgres' ? 700 : 500,
              borderRadius: '6px',
              border: dbType === 'postgres' ? '1.5px solid #7E22CE' : '1px solid #CBD5E1',
              backgroundColor: dbType === 'postgres' ? '#FAF5FF' : '#FFFFFF',
              color: dbType === 'postgres' ? '#7E22CE' : '#475569',
              cursor: 'pointer',
            }}
          >
            PostgreSQL (Port 5432)
          </button>
          <button
            type="button"
            onClick={() => handleDbTypeChange('mysql')}
            style={{
              flex: 1,
              padding: '6px',
              fontSize: '11px',
              fontWeight: dbType === 'mysql' ? 700 : 500,
              borderRadius: '6px',
              border: dbType === 'mysql' ? '1.5px solid #7E22CE' : '1px solid #CBD5E1',
              backgroundColor: dbType === 'mysql' ? '#FAF5FF' : '#FFFFFF',
              color: dbType === 'mysql' ? '#7E22CE' : '#475569',
              cursor: 'pointer',
            }}
          >
            MySQL / MariaDB (Port 3306)
          </button>
        </div>
      </div>

      {/* ── Host, Port, Database Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: '6px' }}>
        <div>
          <label style={{ fontSize: '10px', fontWeight: 600, color: '#475569', marginBottom: '2px', display: 'block' }}>
            Host / IP Server
          </label>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="localhost / 10.0.0.5"
            style={{
              width: '100%',
              height: '28px',
              padding: '0 7px',
              fontSize: '11px',
              borderRadius: '5px',
              border: '1px solid #CBD5E1',
              outline: 'none',
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: '10px', fontWeight: 600, color: '#475569', marginBottom: '2px', display: 'block' }}>
            Port
          </label>
          <input
            type="text"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            style={{
              width: '100%',
              height: '28px',
              padding: '0 7px',
              fontSize: '11px',
              borderRadius: '5px',
              border: '1px solid #CBD5E1',
              outline: 'none',
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: '10px', fontWeight: 600, color: '#475569', marginBottom: '2px', display: 'block' }}>
            Nama Database
          </label>
          <input
            type="text"
            value={database}
            onChange={(e) => setDatabase(e.target.value)}
            placeholder="erp_production"
            style={{
              width: '100%',
              height: '28px',
              padding: '0 7px',
              fontSize: '11px',
              borderRadius: '5px',
              border: '1px solid #CBD5E1',
              outline: 'none',
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
            }}
          />
        </div>
      </div>

      {/* ── Username & Password ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        <div>
          <label style={{ fontSize: '10px', fontWeight: 600, color: '#475569', marginBottom: '2px', display: 'block' }}>
            Username (Read-Only)
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ro_ai_analyst"
            style={{
              width: '100%',
              height: '28px',
              padding: '0 7px',
              fontSize: '11px',
              borderRadius: '5px',
              border: '1px solid #CBD5E1',
              outline: 'none',
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: '10px', fontWeight: 600, color: '#475569', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Lock size={10} color="#16A34A" />
            <span>Password (AES-256)</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            style={{
              width: '100%',
              height: '28px',
              padding: '0 7px',
              fontSize: '11px',
              borderRadius: '5px',
              border: '1px solid #CBD5E1',
              outline: 'none',
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
            }}
          />
        </div>
      </div>

      {/* ── Test Connection Button & Status ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={isTesting}
          style={{
            height: '26px',
            padding: '0 10px',
            borderRadius: '5px',
            border: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            color: '#475569',
            fontSize: '10.5px',
            fontWeight: 600,
            cursor: isTesting ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {isTesting ? <Loader2 size={11} className="animate-spin" /> : <Server size={11} />}
          <span>{isTesting ? 'Menguji...' : 'Uji Koneksi Soket'}</span>
        </button>

        {testResult && (
          <span
            style={{
              fontSize: '10.5px',
              fontWeight: 600,
              color: testResult.success ? '#15803D' : '#DC2626',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {testResult.success ? <Check size={12} /> : <AlertCircle size={12} />}
            {testResult.success ? `Terhubung (${testResult.latencyMs}ms)` : 'Koneksi Gagal'}
          </span>
        )}
      </div>

      {/* ── SQL Query Box with Read-Only Guard Notice ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
          <label style={{ fontSize: '10.5px', fontWeight: 650, color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Terminal size={11} color="#7E22CE" />
            <span>Kueri SQL Terkurasi</span>
          </label>
          <span
            style={{
              fontSize: '9px',
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: '4px',
              backgroundColor: '#F3E8FF',
              color: '#7E22CE',
              border: '1px solid #E9D5FF',
            }}
          >
            🛡️ Read-Only Guard Aktif
          </span>
        </div>
        <textarea
          rows={3}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="SELECT id, nama, kategori FROM tabel_anda;"
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: '11px',
            fontFamily: 'monospace',
            borderRadius: '6px',
            border: '1px solid #CBD5E1',
            outline: 'none',
            backgroundColor: '#FFFFFF',
            color: '#0F172A',
            resize: 'vertical',
          }}
        />
      </div>

      {/* ── Preview & Sync Buttons ── */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          type="button"
          onClick={handlePreview}
          disabled={isPreviewing || isSubmitting}
          style={{
            height: '28px',
            padding: '0 12px',
            borderRadius: '6px',
            border: '1px solid #E9D5FF',
            backgroundColor: '#FAF5FF',
            color: '#7E22CE',
            fontSize: '11px',
            fontWeight: 650,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            cursor: isPreviewing ? 'not-allowed' : 'pointer',
          }}
        >
          {isPreviewing ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
          <span>{isPreviewing ? 'Mengeksekusi...' : 'Preview Query'}</span>
        </button>

        <button
          type="button"
          onClick={handleSync}
          disabled={isSubmitting || isPreviewing}
          style={{
            height: '28px',
            padding: '0 14px',
            borderRadius: '6px',
            border: '1px solid #7E22CE',
            backgroundColor: '#7E22CE',
            color: '#FFFFFF',
            fontSize: '11px',
            fontWeight: 650,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
          }}
        >
          {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          <span>{isSubmitting ? 'Mengindeks...' : 'Sinkronkan Database ke pgvector'}</span>
        </button>
      </div>

      {/* ── Preview Box ── */}
      {previewResult && (
        <div
          style={{
            borderRadius: '8px',
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '5px 8px',
              backgroundColor: '#F1F5F9',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '10.5px',
              fontWeight: 650,
              color: '#334155',
            }}
          >
            <span>Hasil Sampel Query ({previewResult.rowCount} Baris)</span>
            <span style={{ color: '#16A34A', fontSize: '10px' }}>✓ Valid SELECT</span>
          </div>
          <div
            style={{
              maxHeight: '110px',
              overflowY: 'auto',
              padding: '6px 8px',
              fontSize: '10px',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              backgroundColor: '#FFFFFF',
              color: '#1E293B',
              lineHeight: 1.35,
            }}
          >
            {previewResult.previewMarkdown}
          </div>
        </div>
      )}

      {/* ── Error Box ── */}
      {errorMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 8px',
            borderRadius: '6px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FEE2E2',
            color: '#DC2626',
            fontSize: '11px',
          }}
        >
          <AlertCircle size={13} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
