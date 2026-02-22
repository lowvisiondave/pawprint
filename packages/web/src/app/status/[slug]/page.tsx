import StatusClient from "./status-client";
import { neon } from "@neondatabase/serverless";

interface StatusData {
  error?: string;
  workspace?: { name: string; slug: string };
  status?: string;
  lastCheck?: string;
  sessions?: { active: number; total: number };
  system?: { hostname: string; platform: string; cpuUsagePercent: number; memoryUsedPercent: number; diskUsedPercent: number };
  uptime?: { day: number; week: number; month: number };
}

async function getStatus(slug: string): Promise<StatusData> {
  if (!process.env.DATABASE_URL) {
    return { error: "Database not configured" };
  }
  
  const db = neon(process.env.DATABASE_URL);
  
  // Try to find by slug first
  let result = await db`
    SELECT w.id, w.name, w.slug, w.is_public
    FROM workspaces w
    WHERE w.slug = ${slug}
  `;
  
  // If not found by slug, try to find by hostname
  if (result.length === 0) {
    result = await db`
      SELECT DISTINCT w.id, w.name, w.slug, w.is_public
      FROM workspaces w
      JOIN readings r ON r.workspace_id = w.id
      WHERE LOWER(r.system_hostname) = LOWER(${slug})
      ORDER BY w.id
      LIMIT 1
    `;
  }
  
  if (result.length === 0) {
    return { error: "Status page not found" };
  }
  
  const workspace = result[0];
  
  // Check if workspace is private (default to public for backwards compatibility)
  if (workspace.is_public === false || workspace.is_public === 0) {
    return { error: "private", workspace: { name: workspace.name, slug: workspace.slug || slug } };
  }
  
  // Get latest reading
  const latest = await db`
    SELECT * FROM readings 
    WHERE workspace_id = ${workspace.id}
    ORDER BY timestamp DESC 
    LIMIT 1;
  `;
  
  if (latest.length === 0) {
    return { workspace: { name: workspace.name, slug: workspace.slug }, status: "no_data" };
  }
  
  const r = latest[0];
  
  // Calculate uptime for different periods
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  // Get readings for uptime calculation
  const dayReadings = await db`
    SELECT COUNT(*) as total, SUM(CASE WHEN gateway_online THEN 1 ELSE 0 END) as online
    FROM readings 
    WHERE workspace_id = ${workspace.id} AND timestamp > ${dayAgo.toISOString()}
  `;
  
  const weekReadings = await db`
    SELECT COUNT(*) as total, SUM(CASE WHEN gateway_online THEN 1 ELSE 0 END) as online
    FROM readings 
    WHERE workspace_id = ${workspace.id} AND timestamp > ${weekAgo.toISOString()}
  `;
  
  const monthReadings = await db`
    SELECT COUNT(*) as total, SUM(CASE WHEN gateway_online THEN 1 ELSE 0 END) as online
    FROM readings 
    WHERE workspace_id = ${workspace.id} AND timestamp > ${monthAgo.toISOString()}
  `;
  
  const calcUptime = (row: any) => {
    if (!row || !row.total || row.total === 0) return null;
    return Math.round((row.online / row.total) * 100);
  };
  
  return {
    workspace: { name: workspace.name, slug: workspace.slug },
    status: r.gateway_online ? "online" : "offline",
    lastCheck: r.timestamp,
    sessions: { active: r.sessions_active, total: r.sessions_total },
    system: r.system_hostname ? {
      hostname: r.system_hostname,
      platform: r.system_platform,
      cpuUsagePercent: r.system_cpu_usage_percent,
      memoryUsedPercent: r.system_memory_used_percent,
      diskUsedPercent: r.system_disk_used_percent,
    } : undefined,
    uptime: {
      day: calcUptime(dayReadings[0]) || 0,
      week: calcUptime(weekReadings[0]) || 0,
      month: calcUptime(monthReadings[0]) || 0,
    },
  };
}

export default async function StatusPage({
  params,
}: {
  params: Promise<{ slug?: string }>;
}) {
  const resolvedParams = await params;
  const slug = String(resolvedParams.slug || "");
  const data = await getStatus(slug);
  
  return <StatusClient data={data} slug={slug} />;
}
