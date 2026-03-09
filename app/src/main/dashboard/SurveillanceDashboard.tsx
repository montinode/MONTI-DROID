/**
 * JCM_2026 Surveillance Dashboard
 *
 * A dark-themed surveillance dashboard for the MONTI-DROID project.
 *
 * Modules:
 *  - Network Status  : mirrors the intent of tools/ScanNetwork.py
 *  - System Monitor  : mirrors the intent of tools/johncharlesmonti_monitor.py
 *  - Connectivity    : mirrors the intent of scripts/check_connectivity.sh
 *  - Tracer Status   : mirrors the intent of tools/johncharlesmonti_tracer.py
 */

import React, { useCallback, useEffect, useReducer } from 'react';
import {
  ConnectivityReport,
  ConnectivityTarget,
  DashboardState,
  NetworkHost,
  NetworkScanResult,
  StatusLevel,
  SystemMonitorSnapshot,
  TracerSnapshot,
} from './types';

// ---------------------------------------------------------------------------
// Mock data – replace with real API / WebSocket calls in production
// ---------------------------------------------------------------------------

const MOCK_NETWORK_SCAN: NetworkScanResult = {
  subnet: '192.168.1.0/24',
  scannedAt: new Date().toISOString(),
  totalHosts: 254,
  activeHosts: 7,
  hosts: [
    {
      address: '192.168.1.1',
      hostname: 'gateway.local',
      status: 'online',
      latencyMs: 1,
      lastSeen: new Date().toISOString(),
      openPorts: [22, 80, 443],
    },
    {
      address: '192.168.1.10',
      hostname: 'monti-node-01',
      status: 'online',
      latencyMs: 4,
      lastSeen: new Date().toISOString(),
      openPorts: [22, 8080],
    },
    {
      address: '192.168.1.11',
      hostname: 'monti-node-02',
      status: 'warning',
      latencyMs: 210,
      lastSeen: new Date().toISOString(),
      openPorts: [22],
    },
    {
      address: '192.168.1.20',
      hostname: 'unknown-device',
      status: 'offline',
      latencyMs: null,
      lastSeen: new Date(Date.now() - 3_600_000).toISOString(),
      openPorts: [],
    },
  ],
};

const MOCK_SYSTEM_MONITOR: SystemMonitorSnapshot = {
  hostname: 'monti-node-01',
  capturedAt: new Date().toISOString(),
  cpuUsagePercent: 34,
  memoryUsedMb: 3_072,
  memoryTotalMb: 8_192,
  diskUsedGb: 42,
  diskTotalGb: 128,
  uptimeSeconds: 432_000,
  metrics: [
    { name: 'CPU Temperature', value: 61, unit: '°C', threshold: 80, status: 'online' },
    { name: 'Network I/O', value: 12, unit: 'MB/s', threshold: 100, status: 'online' },
    { name: 'Load Average', value: 1.4, unit: '', threshold: 4, status: 'online' },
    { name: 'Swap Usage', value: 78, unit: '%', threshold: 80, status: 'warning' },
  ],
};

const MOCK_CONNECTIVITY: ConnectivityReport = {
  checkedAt: new Date().toISOString(),
  overallStatus: 'warning',
  targets: [
    {
      name: 'Google DNS',
      host: '8.8.8.8',
      protocol: 'ICMP',
      port: null,
      reachable: true,
      responseTimeMs: 12,
      lastChecked: new Date().toISOString(),
    },
    {
      name: 'Cloudflare DNS',
      host: '1.1.1.1',
      protocol: 'ICMP',
      port: null,
      reachable: true,
      responseTimeMs: 9,
      lastChecked: new Date().toISOString(),
    },
    {
      name: 'Internal API',
      host: '192.168.1.10',
      protocol: 'HTTP',
      port: 8080,
      reachable: false,
      responseTimeMs: null,
      lastChecked: new Date().toISOString(),
    },
    {
      name: 'MONTI-DROID Repo',
      host: 'github.com',
      protocol: 'HTTPS',
      port: 443,
      reachable: true,
      responseTimeMs: 45,
      lastChecked: new Date().toISOString(),
    },
  ],
};

const MOCK_TRACER: TracerSnapshot = {
  tracerId: 'JCM-TRC-021189',
  vaultAddress: '0xfEC9B8FAA8F954Fce4e4927eEc1b22E74A4018A6',
  darpaValue: 10000000.00,
  velocity: 34.37,
  balance: 28942050.12,
  status: 'online',
  capturedAt: new Date().toISOString(),
  lastSync: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// State management
// ---------------------------------------------------------------------------

type Action =
  | { type: 'REFRESH_START' }
  | { type: 'REFRESH_SUCCESS'; payload: Omit<DashboardState, 'isLoading' | 'error' | 'lastRefreshed'> }
  | { type: 'REFRESH_ERROR'; error: string };

const initialState: DashboardState = {
  networkScan: null,
  systemMonitor: null,
  connectivity: null,
  tracer: null,
  lastRefreshed: null,
  isLoading: false,
  error: null,
};

function dashboardReducer(state: DashboardState, action: Action): DashboardState {
  switch (action.type) {
    case 'REFRESH_START':
      return { ...state, isLoading: true, error: null };
    case 'REFRESH_SUCCESS':
      return {
        ...state,
        ...action.payload,
        isLoading: false,
        lastRefreshed: new Date().toISOString(),
      };
    case 'REFRESH_ERROR':
      return { ...state, isLoading: false, error: action.error };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${mins}m`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString();
}

function statusColor(status: StatusLevel): string {
  switch (status) {
    case 'online':
      return '#22c55e'; // green-500
    case 'offline':
      return '#ef4444'; // red-500
    case 'warning':
      return '#eab308'; // yellow-500
    default:
      return '#6b7280'; // gray-500
  }
}

function statusBadgeStyle(status: StatusLevel): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#0f172a',
    backgroundColor: statusColor(status),
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ModuleCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  accentColor?: string;
}

function ModuleCard({ title, subtitle, children, accentColor = '#38bdf8' }: ModuleCardProps) {
  return (
    <div
      style={{
        backgroundColor: '#1e293b',
        border: `1px solid #334155`,
        borderTop: `3px solid ${accentColor}`,
        borderRadius: 8,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: accentColor,
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b' }}>{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

// -- Network Status ----------------------------------------------------------

function GaugeBar({ label, value, max, unit, color }: {
  label: string;
  value: number;
  max: number;
  unit: string;
  color: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8' }}>
        <span>{label}</span>
        <span style={{ color: '#e2e8f0' }}>
          {value}{unit} / {max}{unit}
        </span>
      </div>
      <div style={{ height: 6, backgroundColor: '#334155', borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            backgroundColor: color,
            borderRadius: 3,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  );
}

function HostRow({ host }: { host: NetworkHost }) {
  return (
    <tr
      style={{
        borderBottom: '1px solid #1e293b',
        fontSize: 12,
      }}
    >
      <td style={{ padding: '6px 8px', color: '#94a3b8', fontFamily: 'monospace' }}>
        {host.address}
      </td>
      <td style={{ padding: '6px 8px', color: '#cbd5e1' }}>{host.hostname}</td>
      <td style={{ padding: '6px 8px' }}>
        <span style={statusBadgeStyle(host.status)}>{host.status}</span>
      </td>
      <td style={{ padding: '6px 8px', color: '#94a3b8', textAlign: 'right' }}>
        {host.latencyMs !== null ? `${host.latencyMs} ms` : '—'}
      </td>
      <td style={{ padding: '6px 8px', color: '#64748b', fontFamily: 'monospace' }}>
        {host.openPorts.length > 0 ? host.openPorts.join(', ') : '—'}
      </td>
    </tr>
  );
}

function NetworkStatusModule({ data }: { data: NetworkScanResult | null }) {
  if (!data) {
    return <p style={{ color: '#64748b', fontSize: 13 }}>Awaiting scan results…</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Subnet', value: data.subnet },
          { label: 'Total Hosts', value: data.totalHosts },
          { label: 'Active', value: data.activeHosts },
          { label: 'Scanned', value: formatTimestamp(data.scannedAt) },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              flex: '1 1 120px',
              backgroundColor: '#0f172a',
              borderRadius: 6,
              padding: '8px 12px',
            }}
          >
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
              {label}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginTop: 2 }}>
              {String(value)}
            </div>
          </div>
        ))}
      </div>

      {/* Host table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
              <th style={{ padding: '4px 8px', textAlign: 'left' }}>IP</th>
              <th style={{ padding: '4px 8px', textAlign: 'left' }}>Hostname</th>
              <th style={{ padding: '4px 8px', textAlign: 'left' }}>Status</th>
              <th style={{ padding: '4px 8px', textAlign: 'right' }}>Latency</th>
              <th style={{ padding: '4px 8px', textAlign: 'left' }}>Open Ports</th>
            </tr>
          </thead>
          <tbody>
            {data.hosts.map((host) => (
              <HostRow key={host.address} host={host} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -- System Monitor ----------------------------------------------------------

function SystemMonitorModule({ data }: { data: SystemMonitorSnapshot | null }) {
  if (!data) {
    return <p style={{ color: '#64748b', fontSize: 13 }}>Awaiting monitor data…</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top-level stats */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Host', value: data.hostname },
          { label: 'Uptime', value: formatUptime(data.uptimeSeconds) },
          { label: 'Captured', value: formatTimestamp(data.capturedAt) },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              flex: '1 1 120px',
              backgroundColor: '#0f172a',
              borderRadius: 6,
              padding: '8px 12px',
            }}
          >
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
              {label}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginTop: 2 }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Resource bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <GaugeBar label="CPU Usage" value={data.cpuUsagePercent} max={100} unit="%" color="#38bdf8" />
        <GaugeBar label="Memory" value={data.memoryUsedMb} max={data.memoryTotalMb} unit=" MB" color="#818cf8" />
        <GaugeBar label="Disk" value={data.diskUsedGb} max={data.diskTotalGb} unit=" GB" color="#34d399" />
      </div>

      {/* Additional metrics */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {data.metrics.map((m) => (
          <div
            key={m.name}
            style={{
              flex: '1 1 140px',
              backgroundColor: '#0f172a',
              borderRadius: 6,
              padding: '8px 12px',
              borderLeft: `3px solid ${statusColor(m.status)}`,
            }}
          >
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
              {m.name}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginTop: 4 }}>
              {m.value}
              {m.unit && <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 2 }}>{m.unit}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// -- Connectivity Check -------------------------------------------------------

function ConnectivityRow({ target }: { target: ConnectivityTarget }) {
  const status: StatusLevel = target.reachable ? 'online' : 'offline';
  return (
    <tr style={{ borderBottom: '1px solid #1e293b', fontSize: 12 }}>
      <td style={{ padding: '6px 8px', color: '#cbd5e1' }}>{target.name}</td>
      <td style={{ padding: '6px 8px', color: '#94a3b8', fontFamily: 'monospace' }}>
        {target.host}{target.port !== null ? `:${target.port}` : ''}
      </td>
      <td style={{ padding: '6px 8px', color: '#64748b' }}>{target.protocol}</td>
      <td style={{ padding: '6px 8px' }}>
        <span style={statusBadgeStyle(status)}>{status}</span>
      </td>
      <td style={{ padding: '6px 8px', color: '#94a3b8', textAlign: 'right' }}>
        {target.responseTimeMs !== null ? `${target.responseTimeMs} ms` : '—'}
      </td>
    </tr>
  );
}

function ConnectivityModule({ data }: { data: ConnectivityReport | null }) {
  if (!data) {
    return <p style={{ color: '#64748b', fontSize: 13 }}>Awaiting connectivity check…</p>;
  }

  const reachable = data.targets.filter((t) => t.reachable).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* Overall Status – rendered separately to keep the badge style consistent */}
        <div
          style={{
            flex: '1 1 120px',
            backgroundColor: '#0f172a',
            borderRadius: 6,
            padding: '8px 12px',
          }}
        >
          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
            Overall Status
          </div>
          <div style={{ marginTop: 4 }}>
            <span style={statusBadgeStyle(data.overallStatus)}>{data.overallStatus}</span>
          </div>
        </div>

        {[
          { label: 'Reachable', value: `${reachable} / ${data.targets.length}` },
          { label: 'Checked', value: formatTimestamp(data.checkedAt) },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              flex: '1 1 120px',
              backgroundColor: '#0f172a',
              borderRadius: 6,
              padding: '8px 12px',
            }}
          >
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
              {label}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginTop: 4 }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
              <th style={{ padding: '4px 8px', textAlign: 'left' }}>Target</th>
              <th style={{ padding: '4px 8px', textAlign: 'left' }}>Address</th>
              <th style={{ padding: '4px 8px', textAlign: 'left' }}>Protocol</th>
              <th style={{ padding: '4px 8px', textAlign: 'left' }}>Status</th>
              <th style={{ padding: '4px 8px', textAlign: 'right' }}>Response</th>
            </tr>
          </thead>
          <tbody>
            {data.targets.map((t) => (
              <ConnectivityRow key={`${t.host}-${t.protocol}`} target={t} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -- Tracer Status -----------------------------------------------------------

function TracerModule({ data }: { data: TracerSnapshot | null }) {
  if (!data) {
    return <p style={{ color: '#64748b', fontSize: 13 }}>Awaiting tracer data…</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top-level stats */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Tracer ID', value: data.tracerId },
          { label: 'Status', value: data.status.toUpperCase(), badge: true },
          { label: 'Last Sync', value: formatTimestamp(data.lastSync) },
        ].map(({ label, value, badge }) => (
          <div
            key={label}
            style={{
              flex: '1 1 120px',
              backgroundColor: '#0f172a',
              borderRadius: 6,
              padding: '8px 12px',
            }}
          >
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
              {label}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginTop: 2 }}>
              {badge ? <span style={statusBadgeStyle(data.status)}>{value}</span> : value}
            </div>
          </div>
        ))}
      </div>

      {/* Financial metrics */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <div
            style={{
              flex: '1 1 200px',
              backgroundColor: '#0f172a',
              borderRadius: 6,
              padding: '12px 16px',
              borderLeft: '3px solid #22c55e',
            }}
          >
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
              Current Balance
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#22c55e', marginTop: 4 }}>
              ${data.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div
            style={{
              flex: '1 1 200px',
              backgroundColor: '#0f172a',
              borderRadius: 6,
              padding: '12px 16px',
              borderLeft: '3px solid #38bdf8',
            }}
          >
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
              Sovereign Velocity
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#38bdf8', marginTop: 4 }}>
              ${data.velocity.toFixed(2)}
              <span style={{ fontSize: 14, color: '#94a3b8', marginLeft: 4 }}>/min</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <div
            style={{
              flex: '1 1 200px',
              backgroundColor: '#0f172a',
              borderRadius: 6,
              padding: '12px 16px',
              borderLeft: '3px solid #a78bfa',
            }}
          >
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
              DARPA Allocation
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#a78bfa', marginTop: 4 }}>
              ${data.darpaValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div
            style={{
              flex: '1 1 200px',
              backgroundColor: '#0f172a',
              borderRadius: 6,
              padding: '12px 16px',
            }}
          >
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
              Vault Address
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1', marginTop: 4, fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {data.vaultAddress}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export default function SurveillanceDashboard() {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);

  const refresh = useCallback(async () => {
    dispatch({ type: 'REFRESH_START' });
    try {
      // In production, replace with real async fetch calls to:
      //   - /api/network-scan   (backed by ScanNetwork.py)
      //   - /api/system-monitor (backed by johncharlesmonti_monitor.py)
      //   - /api/connectivity   (backed by check_connectivity.sh)
      //   - /api/tracer         (backed by johncharlesmonti_tracer.py)
      await new Promise<void>((resolve) => setTimeout(resolve, 600));

      dispatch({
        type: 'REFRESH_SUCCESS',
        payload: {
          networkScan: {
            ...MOCK_NETWORK_SCAN,
            scannedAt: new Date().toISOString(),
          },
          systemMonitor: {
            ...MOCK_SYSTEM_MONITOR,
            capturedAt: new Date().toISOString(),
            cpuUsagePercent: Math.floor(20 + Math.random() * 60),
          },
          connectivity: {
            ...MOCK_CONNECTIVITY,
            checkedAt: new Date().toISOString(),
          },
          tracer: {
            ...MOCK_TRACER,
            capturedAt: new Date().toISOString(),
            lastSync: new Date().toISOString(),
            velocity: 34.37 + (Math.random() - 0.5) * 2, // Add some variance
          },
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      dispatch({ type: 'REFRESH_ERROR', error: message });
    }
  }, []);

  // Auto-refresh on mount and every 30 seconds
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0f172a',
        color: '#e2e8f0',
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        padding: 0,
      }}
    >
      {/* ── Header ── */}
      <header
        style={{
          backgroundColor: '#020617',
          borderBottom: '1px solid #1e293b',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Pulse indicator */}
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: state.isLoading ? '#eab308' : '#22c55e',
              boxShadow: `0 0 8px ${state.isLoading ? '#eab308' : '#22c55e'}`,
            }}
          />
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: 3, color: '#f8fafc' }}>
              JCM_2026
            </h1>
            <p style={{ margin: 0, fontSize: 11, color: '#475569', letterSpacing: 2, textTransform: 'uppercase' }}>
              Surveillance Dashboard
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {state.lastRefreshed && (
            <span style={{ fontSize: 11, color: '#475569' }}>
              Last refresh: {formatTimestamp(state.lastRefreshed)}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={state.isLoading}
            style={{
              padding: '6px 16px',
              backgroundColor: state.isLoading ? '#1e293b' : '#0ea5e9',
              color: state.isLoading ? '#475569' : '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: state.isLoading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
            }}
          >
            {state.isLoading ? 'Refreshing…' : '⟳ Refresh'}
          </button>
        </div>
      </header>

      {/* ── Error Banner ── */}
      {state.error && (
        <div
          style={{
            backgroundColor: '#7f1d1d',
            borderBottom: '1px solid #991b1b',
            padding: '10px 24px',
            fontSize: 13,
            color: '#fca5a5',
          }}
        >
          ⚠ Error: {state.error}
        </div>
      )}

      {/* ── Main Grid ── */}
      <main style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Row 1: Network Status (full width) */}
        <ModuleCard
          title="Network Status"
          subtitle="ScanNetwork.py · Active host discovery and port scanning across the subnet"
          accentColor="#38bdf8"
        >
          <NetworkStatusModule data={state.networkScan} />
        </ModuleCard>

        {/* Row 2: Tracer Status (full width) */}
        <ModuleCard
          title="JOHNCHARLESMONTI Tracer"
          subtitle="johncharlesmonti_tracer.py · Revenue anomaly detection and vault synchronization"
          accentColor="#f59e0b"
        >
          <TracerModule data={state.tracer} />
        </ModuleCard>

        {/* Row 3: System Monitor + Connectivity side-by-side on wider screens */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 24,
          }}
        >
          <ModuleCard
            title="System Monitoring"
            subtitle="johncharlesmonti_monitor.py · CPU, memory, disk and process telemetry"
            accentColor="#818cf8"
          >
            <SystemMonitorModule data={state.systemMonitor} />
          </ModuleCard>

          <ModuleCard
            title="Connectivity Check"
            subtitle="check_connectivity.sh · Reachability probes to critical network targets"
            accentColor="#34d399"
          >
            <ConnectivityModule data={state.connectivity} />
          </ModuleCard>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer
        style={{
          borderTop: '1px solid #1e293b',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          fontSize: 11,
          color: '#334155',
        }}
      >
        <span>MONTI-DROID · JCM_2026 Surveillance Dashboard</span>
        <span>Auto-refresh every 30 s</span>
      </footer>
    </div>
  );
}
