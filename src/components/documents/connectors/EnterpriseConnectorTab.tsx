'use client';

import React, { useState } from 'react';
import {
  Building2,
  Server,
  Key,
  Layers,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  EnterprisePlatform,
  ENTERPRISE_SAMPLE_ENTITIES,
} from '@lib/connectors/enterpriseConnectorService';

interface EnterpriseConnectorTabProps {
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

export default function EnterpriseConnectorTab({
  metadata,
  isSubmitting,
  setIsSubmitting,
  onSuccess,
  onClose,
}: EnterpriseConnectorTabProps) {
  const [platform, setPlatform] = useState<EnterprisePlatform>('sap');
  const [sourceName, setSourceName] = useState<string>('');
  const [instanceUrl, setInstanceUrl] = useState<string>(
    'https://sap.company.internal/sap/opu/odata/sap/C_PURCHASEORDER_FS_SRV/'
  );
  const [apiToken, setApiToken] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<string>('PurchaseOrders');
  const [filterQuery, setFilterQuery] = useState<string>('');

  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs: number; message: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePlatformChange = (p: EnterprisePlatform) => {
    setPlatform(p);
    setTestResult(null);
    if (p === 'sap') {
      setInstanceUrl('https://sap.company.internal/sap/opu/odata/sap/C_PURCHASEORDER_FS_SRV/');
      setSelectedEntity('PurchaseOrders');
    } else if (p === 'salesforce') {
      setInstanceUrl('https://perusahaan.my.salesforce.com/services/data/v59.0/');
      setSelectedEntity('Account');
    } else {
      setInstanceUrl('https://denodo.company.internal:9443/denodo-restfulws/');
      setSelectedEntity('unified_customer_360');
    }
  };

  const handleTestConnection = async () => {
    if (!instanceUrl.trim()) {
      toast.error('Instance URL wajib diisi.');
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/connectors/enterprise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          platform,
          instanceUrl: instanceUrl.trim(),
          apiToken: apiToken.trim() || undefined,
        }),
      });

      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        toast.success(data.message || 'Gateway enterprise terhubung!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal menguji koneksi');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSync = async () => {
    if (!instanceUrl.trim() || !selectedEntity.trim()) {
      toast.error('Instance URL dan Nama Entitas wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/connectors/enterprise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync',
          platform,
          sourceName: sourceName.trim() || `${platform.toUpperCase()} - ${selectedEntity}`,
          instanceUrl: instanceUrl.trim(),
          apiToken: apiToken.trim() || undefined,
          entityName: selectedEntity.trim(),
          filterQuery: filterQuery.trim() || undefined,
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
        throw new Error(data.error || 'Gagal menyinkronkan data enterprise');
      }

      toast.success(data.message || 'Data sistem enterprise berhasil diindeks ke pgvector!');
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
      toast.error(err.message || 'Gagal menyinkronkan sistem enterprise');
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableEntities = ENTERPRISE_SAMPLE_ENTITIES[platform] || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
      {/* ── Enterprise Platform Switcher ── */}
      <div>
        <label style={{ fontSize: '11px', fontWeight: 650, color: '#334155', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
          <Building2 size={12} color="#2563EB" />
          <span>Pilih Platform Enterprise (ERP / CRM)</span>
        </label>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => handlePlatformChange('sap')}
            style={{
              flex: 1,
              padding: '6px',
              fontSize: '11px',
              fontWeight: platform === 'sap' ? 700 : 500,
              borderRadius: '6px',
              border: platform === 'sap' ? '1.5px solid #2563EB' : '1px solid #CBD5E1',
              backgroundColor: platform === 'sap' ? '#EFF6FF' : '#FFFFFF',
              color: platform === 'sap' ? '#2563EB' : '#475569',
              cursor: 'pointer',
            }}
          >
            SAP S/4HANA (OData)
          </button>
          <button
            type="button"
            onClick={() => handlePlatformChange('salesforce')}
            style={{
              flex: 1,
              padding: '6px',
              fontSize: '11px',
              fontWeight: platform === 'salesforce' ? 700 : 500,
              borderRadius: '6px',
              border: platform === 'salesforce' ? '1.5px solid #0284C7' : '1px solid #CBD5E1',
              backgroundColor: platform === 'salesforce' ? '#F0F9FF' : '#FFFFFF',
              color: platform === 'salesforce' ? '#0284C7' : '#475569',
              cursor: 'pointer',
            }}
          >
            Salesforce CRM
          </button>
          <button
            type="button"
            onClick={() => handlePlatformChange('denodo')}
            style={{
              flex: 1,
              padding: '6px',
              fontSize: '11px',
              fontWeight: platform === 'denodo' ? 700 : 500,
              borderRadius: '6px',
              border: platform === 'denodo' ? '1.5px solid #4338CA' : '1px solid #CBD5E1',
              backgroundColor: platform === 'denodo' ? '#EEF2FF' : '#FFFFFF',
              color: platform === 'denodo' ? '#4338CA' : '#475569',
              cursor: 'pointer',
            }}
          >
            Denodo Data Fabric
          </button>
        </div>
      </div>

      {/* ── Instance URL ── */}
      <div>
        <label style={{ fontSize: '10px', fontWeight: 600, color: '#475569', marginBottom: '2px', display: 'block' }}>
          Instance Endpoint URL Gateway
        </label>
        <input
          type="url"
          value={instanceUrl}
          onChange={(e) => setInstanceUrl(e.target.value)}
          placeholder="https://sap-gateway.company.internal/sap/opu/odata/sap/"
          style={{
            width: '100%',
            height: '28px',
            padding: '0 8px',
            fontSize: '11px',
            borderRadius: '5px',
            border: '1px solid #CBD5E1',
            outline: 'none',
            backgroundColor: '#FFFFFF',
            color: '#0F172A',
          }}
        />
      </div>

      {/* ── Token & Auth ── */}
      <div>
        <label style={{ fontSize: '10px', fontWeight: 600, color: '#475569', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
          <Key size={10} color="#2563EB" />
          <span>OAuth 2.0 Bearer Token / API Secret</span>
        </label>
        <input
          type="password"
          value={apiToken}
          onChange={(e) => setApiToken(e.target.value)}
          placeholder="eyJhbGciOiJSUzI1NiIs..."
          style={{
            width: '100%',
            height: '28px',
            padding: '0 8px',
            fontSize: '11px',
            borderRadius: '5px',
            border: '1px solid #CBD5E1',
            outline: 'none',
            backgroundColor: '#FFFFFF',
            color: '#0F172A',
          }}
        />
      </div>

      {/* ── Entity Selection & Filter ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '6px' }}>
        <div>
          <label style={{ fontSize: '10px', fontWeight: 600, color: '#475569', marginBottom: '2px', display: 'block' }}>
            Pilih Objek / Entitas
          </label>
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            style={{
              width: '100%',
              height: '28px',
              padding: '0 6px',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '5px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
              cursor: 'pointer',
            }}
          >
            {availableEntities.map((ent) => (
              <option key={ent.entity} value={ent.entity}>
                {ent.entity}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '10px', fontWeight: 600, color: '#475569', marginBottom: '2px', display: 'block' }}>
            Filter Kueri (Opsional OData / SOQL)
          </label>
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Status eq 'Approved'"
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

      {/* ── Test & Sync Buttons ── */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={isTesting}
          style={{
            height: '28px',
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
          <span>{isTesting ? 'Menguji Gateway...' : 'Uji Koneksi Enterprise'}</span>
        </button>

        <button
          type="button"
          onClick={handleSync}
          disabled={isSubmitting}
          style={{
            height: '28px',
            padding: '0 14px',
            borderRadius: '6px',
            border: '1px solid #2563EB',
            backgroundColor: '#2563EB',
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
          <span>{isSubmitting ? 'Mengindeks Entitas...' : 'Tarik & Indeks ke pgvector'}</span>
        </button>

        {testResult && (
          <span style={{ fontSize: '10px', fontWeight: 600, color: '#16A34A', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <Check size={11} />
            <span>Terhubung ({testResult.latencyMs}ms)</span>
          </span>
        )}
      </div>

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
