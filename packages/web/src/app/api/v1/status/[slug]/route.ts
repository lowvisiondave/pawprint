import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const db = neon(process.env.DATABASE_URL || '');

// Ensure tables exist
async function ensureTables() {
  if (!process.env.DATABASE_URL) return;
  
  await db`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      avatar_url TEXT,
      github_id TEXT UNIQUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  
  await db`
    CREATE TABLE IF NOT EXISTS workspaces (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      api_key TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  
  await db`
    CREATE TABLE IF NOT EXISTS readings (
      id SERIAL PRIMARY KEY,
      workspace_id INT REFERENCES workspaces(id) ON DELETE CASCADE,
      timestamp TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  
  await db`
    ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
  `;
  
  await db`
    ALTER TABLE readings ADD COLUMN IF NOT EXISTS workspace_id INT REFERENCES workspaces(id);
  `;
  
  await db`
    CREATE INDEX IF NOT EXISTS idx_readings_workspace ON readings(workspace_id, timestamp DESC);
  `;
}

ensureTables().catch(console.error);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  
  if (!slug) {
    return NextResponse.json({ error: 'Slug required' }, { status: 400 });
  }
  
  // Get workspace by slug
  const workspaces = await db`
    SELECT w.id, w.name, w.slug
    FROM workspaces w
    WHERE w.slug = ${slug}
  `;
  
  if (workspaces.length === 0) {
    return NextResponse.json({ error: 'Status page not found' }, { status: 404 });
  }
  
  const workspace = workspaces[0];
  
  // Get latest reading
  const latest = await db`
    SELECT * FROM readings 
    WHERE workspace_id = ${workspace.id}
    ORDER BY timestamp DESC 
    LIMIT 1;
  `;
  
  // Get last 24h, 7d, 30d uptime
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  
  const [uptime24h, uptime7d, uptime30d] = await Promise.all([
    db`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN gateway_online = true THEN 1 ELSE 0 END) as online
      FROM readings 
      WHERE workspace_id = ${workspace.id}
      AND timestamp > ${dayAgo}
    `,
    db`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN gateway_online = true THEN 1 ELSE 0 END) as online
      FROM readings 
      WHERE workspace_id = ${workspace.id}
      AND timestamp > ${weekAgo}
    `,
    db`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN gateway_online = true THEN 1 ELSE 0 END) as online
      FROM readings 
      WHERE workspace_id = ${workspace.id}
      AND timestamp > ${monthAgo}
    `
  ]);
  
  const calcUptime = (data: any) => data[0]?.total > 0 
    ? Math.round((Number(data[0]?.online || 0) / Number(data[0]?.total || 1)) * 100)
    : null;
  
  // Get recent incidents (last 24h of downtime)
  const incidents = await db`
    SELECT timestamp, gateway_online, errors_count, last_error_message
    FROM readings 
    WHERE workspace_id = ${workspace.id}
    AND timestamp > ${dayAgo}
    ORDER BY timestamp DESC
    LIMIT 10
  `;
  
  // Get cost data
  const costData = await db`
    SELECT SUM(cost_today) as total_cost
    FROM readings 
    WHERE workspace_id = ${workspace.id}
    AND timestamp > ${dayAgo}
  `;
  
  const cost = Number(costData[0]?.total_cost || 0);
  
  // Format incidents
  const recentIncidents = incidents
    .filter(r => !r.gateway_online || r.errors_count > 0)
    .slice(0, 5)
    .map(r => ({
      timestamp: r.timestamp,
      type: !r.gateway_online ? 'downtime' : 'error',
      message: r.last_error_message || (!r.gateway_online ? 'Gateway offline' : `${r.errors_count} errors`)
    }));
  
  return NextResponse.json({
    workspace: {
      name: workspace.name,
      slug: workspace.slug,
    },
    status: latest[0]?.gateway_online ? 'online' : 'offline',
    uptime: {
     24h: calcUptime(uptime24h),
     7d: calcUptime(uptime7d),
     30d: calcUptime(uptime30d),
    },
    lastCheck: latest[0]?.timestamp,
    cost24h: cost.toFixed(2),
    incidents: recentIncidents,
    updatedAt: new Date().toISOString(),
  });
}
