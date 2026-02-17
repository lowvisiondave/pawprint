import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

// Initialize Neon database client
const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

// Types matching reporter payload
interface ReportPayload {
  timestamp: string;
  gateway: { online: boolean; uptime: number };
  sessions: { active: number; total: number };
  crons: { enabled: number; total: number };
  costs: { today: number; month: number };
}

// Ensure table exists (run once on startup)
async function ensureTable() {
  if (!sql) return;
  
  await sql`
    CREATE TABLE IF NOT EXISTS readings (
      id SERIAL PRIMARY KEY,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      gateway_online BOOLEAN,
      gateway_uptime INTEGER,
      sessions_active INTEGER,
      sessions_total INTEGER,
      crons_enabled INTEGER,
      crons_total INTEGER,
      cost_today DECIMAL(10,4),
      cost_month DECIMAL(10,4)
    );
  `;
  
  await sql`
    CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON readings(timestamp DESC);
  `;
}

// Initialize on module load
ensureTable().catch(console.error);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const path = (await params).path;
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 401 });
  }
  
  const apiKey = authHeader.slice(7);
  
  if (path[0] === 'dashboard') {
    if (!sql) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    
    const result = await sql`
      SELECT * FROM readings 
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
    if (!sql) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    
    const result = await sql`
      SELECT * FROM readings 
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
  
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const path = (await params).path;
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 401 });
  }
  
  if (!sql) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  
  const apiKey = authHeader.slice(7);
  
  if (path[0] === 'report') {
    try {
      const payload = await request.json() as ReportPayload;
      
      await sql`
        INSERT INTO readings (
          timestamp, gateway_online, gateway_uptime,
          sessions_active, sessions_total,
          crons_enabled, crons_total,
          cost_today, cost_month
        ) VALUES (
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
      
      return NextResponse.json({ 
        success: true
      });
    } catch (err) {
      console.error('Report insert error:', err);
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
  }
  
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
