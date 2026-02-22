import StatusClient from "./status-client";
import { neon } from "@neondatabase/serverless";

async function getStatus(slug: string): Promise<{ error?: string; workspace?: { name: string; slug: string }; status?: string; lastCheck?: string; sessions?: { active: number; total: number }; system?: { hostname: string; platform: string; cpuUsagePercent: number; memoryUsedPercent: number; diskUsedPercent: number } }> {
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
