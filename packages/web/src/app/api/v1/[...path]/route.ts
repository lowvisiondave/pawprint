import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getServerSession } from "next-auth"
import { authOptions } from '@/auth';
import { randomUUID } from 'crypto';

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
  
  await db`
    CREATE TABLE IF NOT EXISTS workspace_invites (
      id SERIAL PRIMARY KEY,
      workspace_id INT REFERENCES workspaces(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      role TEXT DEFAULT 'member',
      used_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  
  await db`
    CREATE INDEX IF NOT EXISTS idx_workspace_invites_token ON workspace_invites(token);
  `;
  
  // New system metrics columns
  await db`ALTER TABLE readings ADD COLUMN IF NOT EXISTS system_platform TEXT`;
  await db`ALTER TABLE readings ADD COLUMN IF NOT EXISTS system_arch TEXT`;
  await db`ALTER TABLE readings ADD COLUMN IF NOT EXISTS system_cpu_count INT`;
  await db`ALTER TABLE readings ADD COLUMN IF NOT EXISTS system_cpu_usage_percent INT`;
  await db`ALTER TABLE readings ADD COLUMN IF NOT EXISTS system_memory_total_mb INT`;
  await db`ALTER TABLE readings ADD COLUMN IF NOT EXISTS system_disk_total_gb INT`;
  await db`ALTER TABLE readings ADD COLUMN IF NOT EXISTS system_uptime BIGINT`;
  await db`ALTER TABLE readings ADD COLUMN IF NOT EXISTS system_load_avg JSONB`;
  await db`ALTER TABLE readings ADD COLUMN IF NOT EXISTS endpoints JSONB`;
  await db`ALTER TABLE readings ADD COLUMN IF NOT EXISTS processes JSONB`;
  await db`ALTER TABLE readings ADD COLUMN IF NOT EXISTS custom_metrics JSONB`;
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
    platform?: string;
    arch?: string;
    cpuCount?: number;
    cpuUsagePercent?: number;
    memoryTotalMb?: number;
    memoryFreeMb?: number;
    memoryUsedPercent?: number;
    diskTotalGb?: number;
    diskFreeGb?: number;
    diskUsedPercent?: number;
    localIp?: string;
    uptime?: number;
    loadAvg?: number[];
  };
  endpoints?: Array<{
    name: string;
    url: string;
    status: 'up' | 'down' | 'error';
    responseTime?: number;
    statusCode?: number;
    error?: string;
  }>;
  processes?: Array<{
    name: string;
    running: boolean;
    pid?: number;
    cpu?: number;
    memory?: number;
  }>;
  custom?: Record<string, number | string | boolean | null>;
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
    const apiKey = 'pk_' + randomUUID();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + randomUUID().slice(0, 8);
    
    const result = await db`
      INSERT INTO workspaces (user_id, name, api_key, slug)
      VALUES (${userId}, ${name}, ${apiKey}, ${slug})
      RETURNING id, name, api_key, slug, created_at
    `;
    
    return NextResponse.json({ workspace: result[0] });
  }
  
  // Create workspace invite
  if (path[0] === 'workspace' && path[1] === 'invite') {
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
      SELECT id, name FROM workspaces WHERE id = ${parseInt(workspaceId)} AND user_id = ${currentUserId}
    `;
    if (verify.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const workspace = verify[0];
    
    // Generate invite token
    const token = 'inv_' + randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
    
    await db`
      INSERT INTO workspace_invites (workspace_id, token, expires_at)
      VALUES (${parseInt(workspaceId)}, ${token}, ${expiresAt})
    `;
    
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://pawprint.app'}/invite/${token}`;
    
    return NextResponse.json({ 
      inviteUrl,
      token,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      expiresAt
    });
  }
  
  // Validate invite token
  if (path[0] === 'invite' && path[1] === 'validate') {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }
    
    const invites = await db`
      SELECT wi.*, w.name as workspace_name, w.slug as workspace_slug
      FROM workspace_invites wi
      JOIN workspaces w ON wi.workspace_id = w.id
      WHERE wi.token = ${token}
    `;
    
    if (invites.length === 0) {
      return NextResponse.json({ error: 'Invalid invite' }, { status: 404 });
    }
    
    const invite = invites[0];
    
    if (invite.used_at) {
      return NextResponse.json({ error: 'Invite already used', workspaceName: invite.workspace_name }, { status: 410 });
    }
    
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invite expired', workspaceName: invite.workspace_name }, { status: 410 });
    }
    
    return NextResponse.json({ 
      valid: true,
      workspaceId: invite.workspace_id,
      workspaceName: invite.workspace_name,
      workspaceSlug: invite.workspace_slug,
      role: invite.role,
      expiresAt: invite.expires_at
    });
  }
  
  // Accept invite (join workspace)
  if (path[0] === 'invite' && path[1] === 'accept') {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Must be logged in to accept invite' }, { status: 401 });
    }
    
    const body = await request.json();
    const { token } = body;
    
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }
    
    // Get user
    const users = await db`
      SELECT id FROM users WHERE email = ${session.user.email}
    `;
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const currentUserId = users[0].id;
    
    // Validate token
    const invites = await db`
      SELECT wi.*, w.name as workspace_name
      FROM workspace_invites wi
      JOIN workspaces w ON wi.workspace_id = w.id
      WHERE wi.token = ${token}
    `;
    
    if (invites.length === 0) {
      return NextResponse.json({ error: 'Invalid invite' }, { status: 404 });
    }
    
    const invite = invites[0];
    
    if (invite.used_at) {
      return NextResponse.json({ error: 'Invite already used' }, { status: 410 });
    }
    
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invite expired' }, { status: 410 });
    }
    
    // Check if user already has access to this workspace
    const existing = await db`
      SELECT id FROM workspaces WHERE id = ${invite.workspace_id} AND user_id = ${currentUserId}
    `;
    
    if (existing.length > 0) {
      // Mark invite as used anyway
      await db`
        UPDATE workspace_invites SET used_at = NOW() WHERE id = ${invite.id}
      `;
      return NextResponse.json({ 
        message: 'You already have access to this workspace',
        workspaceId: invite.workspace_id,
        workspaceName: invite.workspace_name
      });
    }
    
    // Transfer workspace ownership to user (or create member record)
    // For now, just transfer ownership
    await db`
      UPDATE workspaces SET user_id = ${currentUserId} WHERE id = ${invite.workspace_id}
    `;
    
    // Mark invite as used
    await db`
      UPDATE workspace_invites SET used_at = NOW() WHERE id = ${invite.id}
    `;
    
    // Get updated workspace with API key
    const workspace = await db`
      SELECT id, name, api_key, slug FROM workspaces WHERE id = ${invite.workspace_id}
    `;
    
    return NextResponse.json({ 
      success: true,
      workspace: workspace[0]
    });
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
        SELECT id, name, api_key, alert_cost_threshold, alert_downtime_minutes, slack_webhook_url, alert_email
        FROM workspaces WHERE id = ${parseInt(workspaceId)}
      `;
      return NextResponse.json({ workspace: settings[0] });
    }
    
    // UPDATE settings
    if (request.method === 'POST') {
      const body = await request.json();
      const { name, alert_cost_threshold, alert_downtime_minutes, slack_webhook_url, alert_email, action } = body;
      
      // Regenerate API key
      if (action === 'regenerate_api_key') {
        const newApiKey = 'pk_' + randomUUID();
        
        await db`
          UPDATE workspaces SET api_key = ${newApiKey} WHERE id = ${parseInt(workspaceId)}
        `;
        
        return NextResponse.json({ success: true, apiKey: newApiKey });
      }
      
      // Ensure alert_email column exists
      await db`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS alert_email TEXT`;
      
      await db`
        UPDATE workspaces SET
          name = COALESCE(${name}, name),
          alert_cost_threshold = ${alert_cost_threshold ?? null},
          alert_downtime_minutes = ${alert_downtime_minutes ?? 5},
          slack_webhook_url = ${slack_webhook_url ?? null},
          alert_email = ${alert_email ?? null}
        WHERE id = ${parseInt(workspaceId)}
      `;
      
      return NextResponse.json({ success: true });
    }
  }
  
  // Get agents (grouped by hostname) - works with workspace_id param, no auth required
  if (path[0] === 'agents') {
    try {
      const url = new URL(request.url);
      const wsId = url.searchParams.get('workspace_id');
      
      if (!wsId) {
        return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
      }
      
      const workspaceIdNum = parseInt(wsId);
      if (isNaN(workspaceIdNum)) {
        return NextResponse.json({ error: 'Invalid workspace ID' }, { status: 400 });
      }
      
      // Calculate 24 hours ago in JS to avoid DB interval issues
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const result = await db`
        SELECT 
          COALESCE(system_hostname, 'unknown') as hostname,
          MAX(timestamp) as last_seen,
          BOOL_OR(gateway_online) as is_online,
          SUM(COALESCE(cost_today, 0)) as cost_24h,
          SUM(COALESCE(sessions_active, 0)) as total_sessions
        FROM readings 
        WHERE workspace_id = ${workspaceIdNum}
        AND timestamp > ${dayAgo}
        GROUP BY COALESCE(system_hostname, 'unknown')
        ORDER BY last_seen DESC
        LIMIT 20;
      `;
      
      return NextResponse.json({ 
        agents: result.map(row => ({
          hostname: row.hostname,
          lastSeen: row.last_seen,
          isOnline: row.is_online,
          cost24h: Number(row.cost_24h || 0),
          sessions: Number(row.total_sessions || 0),
        }))
      });
    } catch (err: any) {
      console.error('Agents endpoint error:', err.message);
      return NextResponse.json({ error: 'Failed to fetch agents', detail: err.message }, { status: 500 });
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
            platform: row.system_platform,
            arch: row.system_arch,
            cpuCount: row.system_cpu_count ? Number(row.system_cpu_count) : undefined,
            cpuUsagePercent: row.system_cpu_usage_percent ? Number(row.system_cpu_usage_percent) : undefined,
            memoryTotalMb: row.system_memory_total_mb ? Number(row.system_memory_total_mb) : undefined,
            memoryFreeMb: row.system_memory_free_mb ? Number(row.system_memory_free_mb) : undefined,
            memoryUsedPercent: row.system_memory_used_percent ? Number(row.system_memory_used_percent) : undefined,
            diskTotalGb: row.system_disk_total_gb ? Number(row.system_disk_total_gb) : undefined,
            diskFreeGb: row.system_disk_free_gb ? Number(row.system_disk_free_gb) : undefined,
            diskUsedPercent: row.system_disk_used_percent ? Number(row.system_disk_used_percent) : undefined,
            localIp: row.system_local_ip,
            uptime: row.system_uptime ? Number(row.system_uptime) : undefined,
            loadAvg: row.system_load_avg ? JSON.parse(row.system_load_avg) : undefined,
          } : undefined,
          endpoints: row.endpoints ? JSON.parse(row.endpoints) : undefined,
          processes: row.processes ? JSON.parse(row.processes) : undefined,
          custom: row.custom_metrics ? JSON.parse(row.custom_metrics) : undefined,
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
          system_cpu_usage_percent: row.system_cpu_usage_percent ? Number(row.system_cpu_usage_percent) : null,
          system_memory_used_percent: row.system_memory_used_percent ? Number(row.system_memory_used_percent) : null,
          system_disk_used_percent: row.system_disk_used_percent ? Number(row.system_disk_used_percent) : null,
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
  
  // Handle session-based auth for certain endpoints
  let userId: number | null = null;
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    const users = await db`
      SELECT id FROM users WHERE email = ${session.user.email}
    `;
    if (users.length > 0) {
      userId = users[0].id;
    }
  }
  
  // Invite creation via POST (preferred method)
  if (path[0] === 'workspace' && path[1] === 'invite') {
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { workspaceId } = body;
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
    }
    
    // Verify ownership
    const verify = await db`
      SELECT id, name FROM workspaces WHERE id = ${workspaceId} AND user_id = ${userId}
    `;
    if (verify.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const workspace = verify[0];
    const token = 'inv_' + randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    await db`
      INSERT INTO workspace_invites (workspace_id, token, expires_at)
      VALUES (${workspaceId}, ${token}, ${expiresAt})
    `;
    
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://pawprint.app'}/invite/${token}`;
    
    return NextResponse.json({ 
      inviteUrl,
      token,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      expiresAt
    });
  }
  
  // Require API key for other endpoints
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
      
      // Extract values for template literal
      const p = payload;
      const sys = p.system;
      const modelBreakdownStr = p.modelBreakdown ? JSON.stringify(p.modelBreakdown) : null;
      const loadAvgStr = sys?.loadAvg ? JSON.stringify(sys.loadAvg) : null;
      const endpointsStr = p.endpoints ? JSON.stringify(p.endpoints) : null;
      const processesStr = p.processes ? JSON.stringify(p.processes) : null;
      const customStr = p.custom ? JSON.stringify(p.custom) : null;
      
      await db`
        INSERT INTO readings (
          workspace_id,
          timestamp, gateway_online, gateway_uptime,
          sessions_active, sessions_total,
          crons_enabled, crons_total,
          cost_today, cost_month,
          tokens_input, tokens_output, model_breakdown,
          system_hostname, system_platform, system_arch, system_cpu_count, system_cpu_usage_percent,
          system_memory_total_mb, system_memory_used_percent, system_memory_free_mb,
          system_disk_total_gb, system_disk_used_percent, system_disk_free_gb,
          system_local_ip, system_uptime, system_load_avg,
          endpoints, processes, custom_metrics,
          errors_count, last_error_message, last_error_timestamp
        ) VALUES (
          ${workspace.id},
          ${p.timestamp || new Date().toISOString()},
          ${p.gateway?.online ?? null},
          ${p.gateway?.uptime ?? null},
          ${p.sessions?.active ?? null},
          ${p.sessions?.total ?? null},
          ${p.crons?.enabled ?? null},
          ${p.crons?.total ?? null},
          ${p.costs?.today ?? null},
          ${p.costs?.month ?? null},
          ${p.tokens?.input ?? null},
          ${p.tokens?.output ?? null},
          ${modelBreakdownStr},
          ${sys?.hostname ?? null},
          ${sys?.platform ?? null},
          ${sys?.arch ?? null},
          ${sys?.cpuCount ?? null},
          ${sys?.cpuUsagePercent ?? null},
          ${sys?.memoryTotalMb ?? null},
          ${sys?.memoryUsedPercent ?? null},
          ${sys?.memoryFreeMb ?? null},
          ${sys?.diskTotalGb ?? null},
          ${sys?.diskUsedPercent ?? null},
          ${sys?.diskFreeGb ?? null},
          ${sys?.localIp ?? null},
          ${sys?.uptime ?? null},
          ${loadAvgStr},
          ${endpointsStr},
          ${processesStr},
          ${customStr},
          ${p.errors?.last24h ?? 0},
          ${p.errors?.lastError?.message ?? null},
          ${p.errors?.lastError?.timestamp ?? null}
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
