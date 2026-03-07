/**
 * JCM_2026 Surveillance Dashboard - Type Definitions
 */

export type StatusLevel = 'online' | 'offline' | 'warning' | 'unknown';

export interface NetworkHost {
  address: string;
  hostname: string;
  status: StatusLevel;
  latencyMs: number | null;
  lastSeen: string;
  openPorts: number[];
}

export interface NetworkScanResult {
  subnet: string;
  scannedAt: string;
  totalHosts: number;
  activeHosts: number;
  hosts: NetworkHost[];
}

export interface SystemMetric {
  name: string;
  value: number;
  unit: string;
  threshold: number;
  status: StatusLevel;
}

export interface SystemMonitorSnapshot {
  hostname: string;
  capturedAt: string;
  cpuUsagePercent: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  diskUsedGb: number;
  diskTotalGb: number;
  uptimeSeconds: number;
  metrics: SystemMetric[];
}

export interface ConnectivityTarget {
  name: string;
  host: string;
  protocol: 'ICMP' | 'HTTP' | 'HTTPS' | 'TCP';
  port: number | null;
  reachable: boolean;
  responseTimeMs: number | null;
  lastChecked: string;
}

export interface ConnectivityReport {
  checkedAt: string;
  overallStatus: StatusLevel;
  targets: ConnectivityTarget[];
}

export interface DashboardState {
  networkScan: NetworkScanResult | null;
  systemMonitor: SystemMonitorSnapshot | null;
  connectivity: ConnectivityReport | null;
  lastRefreshed: string | null;
  isLoading: boolean;
  error: string | null;
}
