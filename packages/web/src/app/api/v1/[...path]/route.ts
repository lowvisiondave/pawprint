import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { auth } from '@/auth';

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

// Ensure tables exist
async function ensureTables() {
  if (!sql) return;
  
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      avatar_url TEXT,
      github_id TEXT UNIQUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  
  await sql`
    CREATE TABLE IF NOT EXISTS workspaces (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      api_key TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  
  await sql`
    ALTER TABLE readings ADD COLUMN IF NOT EXISTS workspace_id INT REFERENCES workspaces(id);
  `;
  
  await sql`
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
}

// Get workspace from API key
async function getWorkspaceFromKey(apiKey: string) {
  if (!sql) return null;
  
  const result = await sql`
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
  const session = await auth();
  if (session?.user?.id) {
    userId = parseInt(session.user.id);
  }
  
  if (path[0] === 'workspaces') {
    // List user's workspaces
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const workspaces = await sql`
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
    
    // Generate API key
    const apiKey = 'pk_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    
    const result = await sql`
      INSERT INTO workspaces (user_id, name, api_key)
      VALUES (${userId}, ${name}, ${apiKey})
      RETURNING id, name, api_key, created_at
    `;
    
    return NextResponse.json({ workspace: result[0] });
  }
  
  if (path[0] === 'dashboard' || path[0] === 'history') {
    // Need workspace ID
    const url = new URL(request.url);
    const wsId = url.searchParams.get('workspace_id');
    
    if (wsId) {
      workspaceId = parseInt(wsId);
    }
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace required' }, { status: 400 });
    }
    
    // Verify user owns workspace
    if (userId) {
      const verify = await sql`
        SELECT id FROM workspaces WHERE id = ${workspaceId} AND user_id = ${userId}
      `;
      if (verify.length === 0) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    
    if (path[0] === 'dashboard') {
      const result = await sql`
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
        },
        reportedAt: row.timestamp,
        gatewayOnline,
      });
    }
    
    if (path[0] === 'history') {
      const result = await sql`
        SELECT * FROM readings 
        WHERE workspace_id = ${workspaceId}
        ORDER BY timestamp DESC 
        LIMIT 288;
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
      
      await sql`
        INSERT INTO readings (
          workspace_id,
          timestamp, gateway_online, gateway_uptime,
          sessions_active, sessions_total,
          crons_enabled, crons_total,
          cost_today, cost_month
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
          ${payload.costs?.month ?? null}
        )
      `;
      
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error('Report insert error:', err);
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
  }
  
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
