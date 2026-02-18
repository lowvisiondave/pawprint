import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getServerSession } from "next-auth"
import { authOptions } from '@/auth';

// Database client
const db = neon(process.env.DATABASE_URL || '');

// Ensure tables exist
async function ensureTables() {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL not configured');
    return;
  }
  
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
      api_key TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  
  await db`
    ALTER TABLE readings ADD COLUMN IF NOT EXISTS workspace_id INT REFERENCES workspaces(id);
  `;
  
  await db`
    ALTER TABLE readings ADD COLUMN IF NOT EXISTS errors_count INT DEFAULT 0;
  `;
  
  await db`
    ALTER TABLE readings ADD COLUMN IF NOT EXISTS last_error_message TEXT;
  `;
  
  await db`
    ALTER TABLE readings ADD COLUMN IF NOT EXISTS last_error_timestamp TIMESTAMPTZ;
  `;
  
  await db`
    ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
  `;
  
  await db`
    CREATE INDEX IF NOT EXISTS idx_readings_workspace ON readings(workspace_id, timestamp DESC);
  `;
}

ensureTables().catch(console.error);

// Types matching reporter payload
interface ReportPayload {
  timestamp: string;
  gateway: { online: boolean; uptime: number };
  sessions: { active: number; total: number };
  crons: { enabled: number; total: number };
  costs: { today: number; month: number };
  tokens?: { input: number; output: number };
  modelBreakdown?: Record<string, number>;
  system?: {
    hostname?: string;
    memoryUsedPercent?: number;
    memoryFreeMb?: number;
    diskUsedPercent?: number;
    diskFreeGb?: number;
    localIp?: string;
  };
  errors?: {
    last24h: number;
    lastError?: { message: string; timestamp: string };
  };
}

// Get workspace from API key
async function getWorkspaceFromKey(apiKey: string) {
  if (!process.env.DATABASE_URL) return null;
  
  const result = await db`
    SELECT w.*, u.id as user_id 
    FROM workspaces w 
    JOIN users u ON w.user_id = u.id 
    WHERE w.api_key = ${apiKey}
  `;
  
  return result.length > 0 ? result[0] : null;
}

// GET handler
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const path = (await params).path;
  
  // Check for workspace API key
  const authHeader = request.headers.get('Authorization');
  let workspaceId: number | null = null;
  let userId: number | null = null;
  
  if (authHeader?.startsWith('Bearer ')) {
    const apiKey = authHeader.slice(7);
    const workspace = await getWorkspaceFromKey(apiKey);
    if (workspace) {
      workspaceId = workspace.id;
      userId = workspace.user_id;
    }
  }
  
  // Also check session auth
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    const users = await db`
      SELECT id FROM users WHERE email = ${session.user.email}
    `;
    if (users.length > 0) {
      userId = users[0].id;
    }
  }
  
  if (path[0] === 'workspaces') {
    // List user's workspaces
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const workspaces = await db`
      SELECT id, name, api_key, created_at 
      FROM workspaces 
      WHERE user_id = ${userId}
    `;
    
    return NextResponse.json({ workspaces });
  }
  
  if (path[0] === 'workspace' && path[1] === 'create') {
    // Create workspace
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const url = new URL(request.url);
    const name = url.searchParams.get('name') || 'My Agent';
    
    // Generate API key and slug
    const apiKey = 'pk_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).slice(2, 6);
    
    const result = await db`
      INSERT INTO workspaces (user_id, name, api_key, slug)
      VALUES (${userId}, ${name}, ${apiKey}, ${slug})
      RETURNING id, name, api_key, slug, created_at
    `;
    
    return NextResponse.json({ workspace: result[0] });
  }
  
  // Workspace settings (get/update)
  if (path[0] === 'workspace' && path[1] === 'settings') {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get user_id
    const users = await db`
      SELECT id FROM users WHERE email = ${session.user.email}
    `;
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const currentUserId = users[0].id;
    
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get('id');
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
    }
    
    // Verify ownership
    const verify = await db`
      SELECT id FROM workspaces WHERE id = ${parseInt(workspaceId)} AND user_id = ${currentUserId}
    `;
    if (verify.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // GET settings
    if (request.method === 'GET') {
      const settings = await db`
        SELECT id, name, api_key, alert_cost_threshold, alert_downtime_minutes, slack_webhook_url
        FROM workspaces WHERE id = ${parseInt(workspaceId)}
      `;
      return NextResponse.json({ workspace: settings[0] });
    }
    
    // UPDATE settings
    if (request.method === 'POST') {
      const body = await request.json();
      const { name, alert_cost_threshold, alert_downtime_minutes, slack_webhook_url } = body;
      
      await db`
        UPDATE workspaces SET
          name = COALESCE(${name}, name),
          alert_cost_threshold = ${alert_cost_threshold ?? null},
          alert_downtime_minutes = ${alert_downtime_minutes ?? 5},
          slack_webhook_url = ${slack_webhook_url ?? null}
        WHERE id = ${parseInt(workspaceId)}
      `;
      
      return NextResponse.json({ success: true });
    }
  }
  
  if (path[0] === 'dashboard' || path[0] === 'history') {
    // Get workspace ID from query param or use first workspace for logged-in user
    const url = new URL(request.url);
    const wsId = url.searchParams.get('workspace_id');
    
    if (wsId) {
      workspaceId = parseInt(wsId);
    } else if (userId) {
      // Auto-select first workspace for logged-in user
      const userWorkspaces = await db`
        SELECT id FROM workspaces WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 1
      `;
      if (userWorkspaces.length > 0) {
        workspaceId = userWorkspaces[0].id;
      }
    }
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace required' }, { status: 400 });
    }
    
    // Verify user owns workspace
    if (userId) {
      const verify = await db`
        SELECT id FROM workspaces WHERE id = ${workspaceId} AND user_id = ${userId}
      `;
      if (verify.length === 0) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    
    if (path[0] === 'dashboard') {
      const result = await db`
        SELECT * FROM readings 
        WHERE workspace_id = ${workspaceId}
        ORDER BY timestamp DESC 
        LIMIT 1;
      `;
      
      if (result.length === 0) {
        return NextResponse.json({
          latestReport: null,
          reportedAt: null,
          gatewayOnline: false,
          message: 'No reports received yet.',
        });
      }
      
      const row = result[0];
      const ageMs = Date.now() - new Date(row.timestamp).getTime();
      const gatewayOnline = ageMs < 10 * 60 * 1000;
      
      return NextResponse.json({
        latestReport: {
          timestamp: row.timestamp,
          gateway: { online: row.gateway_online, uptime: row.gateway_uptime },
          sessions: { active: row.sessions_active, total: row.sessions_total },
          crons: { enabled: row.crons_enabled, total: row.crons_total },
          costs: { today: Number(row.cost_today), month: Number(row.cost_month) },
          tokens: row.tokens_output ? { 
            input: Number(row.tokens_input || 0), 
            output: Number(row.tokens_output) 
          } : undefined,
          modelBreakdown: row.model_breakdown,
          system: row.system_hostname ? {
            hostname: row.system_hostname,
            memoryUsedPercent: row.system_memory_used_percent ? Number(row.system_memory_used_percent) : undefined,
            memoryFreeMb: row.system_memory_free_mb,
            diskUsedPercent: row.system_disk_used_percent ? Number(row.system_disk_used_percent) : undefined,
            diskFreeGb: row.system_disk_free_gb ? Number(row.system_disk_free_gb) : undefined,
            localIp: row.system_local_ip,
          } : undefined,
        },
        reportedAt: row.timestamp,
        gatewayOnline,
      });
    }
    
    if (path[0] === 'history') {
      const url = new URL(request.url);
      const hoursParam = url.searchParams.get('hours');
      const hours = hoursParam ? parseInt(hoursParam) : 24;
      const limit = Math.min(Math.floor(hours * 12), 1000); // 12 readings per hour max, cap at 1000
      
      const result = await db`
        SELECT * FROM readings 
        WHERE workspace_id = ${workspaceId}
        ORDER BY timestamp DESC 
        LIMIT ${limit};
      `;
      
      return NextResponse.json({ 
        history: result.map(row => ({
          timestamp: row.timestamp,
          gateway_online: row.gateway_online,
          gateway_uptime: row.gateway_uptime,
          sessions_active: row.sessions_active,
          sessions_total: row.sessions_total,
          crons_enabled: row.crons_enabled,
          crons_total: row.crons_total,
          cost_today: Number(row.cost_today),
          cost_month: Number(row.cost_month),
        }))
      });
    }
  }
  
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// POST handler
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const path = (await params).path;
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 401 });
  }
  
  const apiKey = authHeader.slice(7);
  const workspace = await getWorkspaceFromKey(apiKey);
  
  if (!workspace) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }
  
  if (path[0] === 'report') {
    try {
      const payload = await request.json() as ReportPayload;
      
      await db`
        INSERT INTO readings (
          workspace_id,
          timestamp, gateway_online, gateway_uptime,
          sessions_active, sessions_total,
          crons_enabled, crons_total,
          cost_today, cost_month,
          tokens_input, tokens_output, model_breakdown,
          system_hostname, system_memory_used_percent, system_memory_free_mb,
          system_disk_used_percent, system_disk_free_gb, system_local_ip,
          errors_count, last_error_message, last_error_timestamp
        ) VALUES (
          ${workspace.id},
          ${payload.timestamp || new Date().toISOString()},
          ${payload.gateway?.online ?? null},
          ${payload.gateway?.uptime ?? null},
          ${payload.sessions?.active ?? null},
          ${payload.sessions?.total ?? null},
          ${payload.crons?.enabled ?? null},
          ${payload.crons?.total ?? null},
          ${payload.costs?.today ?? null},
          ${payload.costs?.month ?? null},
          ${payload.tokens?.input ?? null},
          ${payload.tokens?.output ?? null},
          ${payload.modelBreakdown ? JSON.stringify(payload.modelBreakdown) : null},
          ${payload.system?.hostname ?? null},
          ${payload.system?.memoryUsedPercent ?? null},
          ${payload.system?.memoryFreeMb ?? null},
          ${payload.system?.diskUsedPercent ?? null},
          ${payload.system?.diskFreeGb ?? null},
          ${payload.system?.localIp ?? null},
          ${payload.errors?.last24h ?? 0},
          ${payload.errors?.lastError?.message ?? null},
          ${payload.errors?.lastError?.timestamp ?? null}
        )
      `;
      
      // Check alerts
      if (workspace.alert_cost_threshold && payload.costs?.today > Number(workspace.alert_cost_threshold)) {
        if (workspace.slack_webhook_url) {
          await fetch(workspace.slack_webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `💰 Cost Alert: $${payload.costs.today.toFixed(2)} today (threshold: $${workspace.alert_cost_threshold})`
            })
          }).catch(console.error);
        }
      }
      
      // Check uptime - get readings from last N minutes
      if (workspace.alert_downtime_minutes) {
        const cutoff = new Date(Date.now() - workspace.alert_downtime_minutes * 60 * 1000).toISOString();
        const recentReadings = await db`
          SELECT gateway_online FROM readings 
          WHERE workspace_id = ${workspace.id} AND timestamp > ${cutoff}
          ORDER BY timestamp DESC
        `;
        
        // If most recent reading is offline and no online readings in window
        if (recentReadings.length > 0 && !recentReadings[0].gateway_online) {
          const hasOnline = recentReadings.some(r => r.gateway_online);
          if (!hasOnline && workspace.slack_webhook_url) {
            await fetch(workspace.slack_webhook_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: `🔴 Downtime Alert: Gateway offline for ${workspace.alert_downtime_minutes}+ minutes`
              })
            }).catch(console.error);
          }
        }
      }
      
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error('Report insert error:', err);
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
  }
  
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
