import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const workspaceId = searchParams.get("workspace_id") || "1";
  
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ agents: [] }, { status: 200 });
  }
  
  const db = neon(process.env.DATABASE_URL);
  const wsId = parseInt(workspaceId) || 1;
  
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  try {
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
    
    const agents = result.map(row => ({
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
    
    return NextResponse.json({ agents });
  } catch (error) {
    console.error("Agents API error:", error);
    return NextResponse.json({ agents: [], error: "Failed to fetch agents" }, { status: 500 });
  }
}
