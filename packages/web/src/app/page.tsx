import Dashboard from "./dashboard-client";
import { neon } from "@neondatabase/serverless";

async function getDashboardData(workspaceId: string) {
  if (!process.env.DATABASE_URL) {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
    try {
      const res = await fetch(`${API_URL}/api/v1/dashboard?workspace_id=${workspaceId}`, {
        next: { revalidate: 30 }
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
  
  const db = neon(process.env.DATABASE_URL);
  const wsId = parseInt(workspaceId) || 1;
  
  const result = await db`
    SELECT 
      timestamp, gateway_online, gateway_uptime,
      sessions_active, sessions_total,
      crons_enabled, crons_total, cron_jobs,
      cost_today, cost_month,
      tokens_input, tokens_output,
      system_hostname, system_platform, system_arch, system_cpu_count,
      system_cpu_usage_percent, system_memory_total_mb, system_memory_used_percent,
      system_memory_free_mb, system_disk_total_gb, system_disk_used_percent,
      system_disk_free_gb, system_local_ip, system_uptime
    FROM readings 
    WHERE workspace_id = ${wsId}
    ORDER BY timestamp DESC 
    LIMIT 1;
  `;
  
  if (result.length === 0) {
    return { latestReport: null, reportedAt: null, gatewayOnline: false };
  }
  
  const row = result[0];
  return {
    latestReport: {
      timestamp: row.timestamp,
      gateway: { online: row.gateway_online, uptime: row.gateway_uptime },
      sessions: { active: row.sessions_active, total: row.sessions_total },
      crons: { enabled: row.crons_enabled, total: row.crons_total, jobs: row.cron_jobs || [] },
      costs: { today: Number(row.cost_today), month: Number(row.cost_month) },
      tokens: row.tokens_output ? { 
        input: Number(row.tokens_input || 0), 
        output: Number(row.tokens_output) 
      } : undefined,
      system: row.system_hostname ? {
        hostname: row.system_hostname,
        platform: row.system_platform,
        arch: row.system_arch,
        cpuCount: row.system_cpu_count,
        cpuUsagePercent: row.system_cpu_usage_percent,
        memoryTotalMb: row.system_memory_total_mb,
        memoryFreeMb: row.system_memory_free_mb,
        memoryUsedPercent: row.system_memory_used_percent,
        diskTotalGb: row.system_disk_total_gb,
        diskFreeGb: row.system_disk_free_gb,
        diskUsedPercent: row.system_disk_used_percent,
        localIp: row.system_local_ip,
        uptime: row.system_uptime,
      } : undefined,
    },
    reportedAt: row.timestamp,
    gatewayOnline: row.gateway_online,
  };
}

async function getAgentsData(workspaceId: string) {
  if (!process.env.DATABASE_URL) {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
    try {
      const res = await fetch(`${API_URL}/api/v1/agents?workspace_id=${workspaceId}`, {
        next: { revalidate: 30 }
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.agents || [];
    } catch {
      return [];
    }
  }
  
  const db = neon(process.env.DATABASE_URL);
  const wsId = parseInt(workspaceId) || 1;
  
  // Get last 24 hours of readings grouped by hostname
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const result = await db`
    SELECT 
      COALESCE(system_hostname, 'unknown') as hostname,
      MAX(timestamp) as last_seen,
      BOOL_OR(gateway_online) as is_online,
      SUM(COALESCE(sessions_active, 0)) as sessions_24h,
      SUM(COALESCE(sessions_total, 0)) as total_sessions,
      SUM(COALESCE(tokens_input, 0)) as tokens_input,
      SUM(COALESCE(tokens_output, 0)) as tokens_output,
      SUM(COALESCE(cost_today, 0)) as cost_24h,
      MAX(system_platform) as platform,
      MAX(system_arch) as arch,
      MAX(system_cpu_count) as cpu_count,
      AVG(COALESCE(system_cpu_usage_percent, 0)) as avg_cpu,
      AVG(COALESCE(system_memory_used_percent, 0)) as avg_memory,
      MAX(system_uptime) as uptime,
      MAX(system_local_ip) as ip
    FROM readings 
    WHERE workspace_id = ${wsId}
    AND timestamp > ${dayAgo}
    GROUP BY COALESCE(system_hostname, 'unknown')
    ORDER BY sessions_24h DESC
    LIMIT 20;
  `;
  
  return result.map(row => ({
    hostname: row.hostname,
    lastSeen: row.last_seen,
    isOnline: row.is_online,
    sessions24h: Number(row.sessions_24h || 0),
    totalSessions: Number(row.total_sessions || 0),
    tokensInput: Number(row.tokens_input || 0),
    tokensOutput: Number(row.tokens_output || 0),
    cost24h: Number(row.cost_24h || 0),
    platform: row.platform,
    arch: row.arch,
    cpuCount: row.cpu_count,
    avgCpu: Math.round(Number(row.avg_cpu || 0)),
    avgMemory: Math.round(Number(row.avg_memory || 0)),
    uptime: row.uptime,
    ip: row.ip,
  }));
}

import Settings from "../settings/page";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace_id?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const workspaceId = params.workspace_id || "1";
  const tab = params.tab || "dashboard";
  
  // Render settings page if tab=settings
  if (tab === "settings") {
    return <Settings workspaceId={workspaceId} />;
  }
  
  const [data, agents] = await Promise.all([
    getDashboardData(workspaceId),
    getAgentsData(workspaceId)
  ]);
  
  return <Dashboard initialData={data} agents={agents} workspaceId={workspaceId} />;
}
