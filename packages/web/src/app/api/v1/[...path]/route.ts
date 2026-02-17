import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize Redis - try Upstash first, then Vercel KV
let redis: Redis;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
} else if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
  // Fallback to Vercel KV (deprecated)
  redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
} else {
  throw new Error('No Redis configuration found. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN or KV_REST_API_URL and KV_REST_API_TOKEN');
}

// Types
interface Session {
  key: string;
  kind: 'direct' | 'group';
  model: string;
  tokensUsed: number;
  tokensMax: number;
  lastActivity: string;
}

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  lastRunAt?: string;
  lastStatus?: 'ok' | 'error';
  nextRunAt?: string;
  consecutiveErrors: number;
}

interface ReportPayload {
  sessions: Session[];
  crons: CronJob[];
  timestamp: string;
  agentId: string;
}

// KV keys
const KEY_LATEST = (apiKey: string) => `report:${apiKey}:latest`;
const KEY_HISTORY = (apiKey: string) => `report:${apiKey}:history`;
const MAX_HISTORY = 288; // 24 hours at 5-min intervals

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
    const latest = await redis.get<{ payload: ReportPayload; receivedAt: string }>(KEY_LATEST(apiKey));
    
    if (!latest) {
      return NextResponse.json({
        latestReport: null,
        reportedAt: null,
        gatewayOnline: false,
        message: 'No reports received yet.',
      });
    }
    
    const ageMs = Date.now() - new Date(latest.receivedAt).getTime();
    const gatewayOnline = ageMs < 10 * 60 * 1000;
    
    return NextResponse.json({
      latestReport: latest.payload,
      reportedAt: latest.receivedAt,
      gatewayOnline,
    });
  }
  
  if (path[0] === 'sessions') {
    const latest = await redis.get<{ payload: ReportPayload; receivedAt: string }>(KEY_LATEST(apiKey));
    return NextResponse.json({ 
      sessions: latest?.payload.sessions || [] 
    });
  }
  
  if (path[0] === 'crons') {
    const latest = await redis.get<{ payload: ReportPayload; receivedAt: string }>(KEY_LATEST(apiKey));
    return NextResponse.json({ 
      crons: latest?.payload.crons || [] 
    });
  }
  
  if (path[0] === 'history') {
    const history = await redis.lrange<{ payload: ReportPayload; receivedAt: string }>(KEY_HISTORY(apiKey), 0, -1);
    return NextResponse.json({ 
      history: history || [] 
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
  
  const apiKey = authHeader.slice(7);
  
  if (path[0] === 'report') {
    try {
      const payload = await request.json() as ReportPayload;
      const receivedAt = new Date().toISOString();
      
      const report = { payload, receivedAt };
      
      // Store latest report
      await redis.set(KEY_LATEST(apiKey), JSON.stringify(report));
      
      // Add to history (LPUSH + LTRIM to keep last N)
      await redis.lpush(KEY_HISTORY(apiKey), JSON.stringify(report));
      await redis.ltrim(KEY_HISTORY(apiKey), 0, MAX_HISTORY - 1);
      
      // Set TTL of 25 hours for auto-cleanup
      await redis.expire(KEY_LATEST(apiKey), 25 * 60 * 60);
      await redis.expire(KEY_HISTORY(apiKey), 25 * 60 * 60);
      
      return NextResponse.json({ 
        success: true, 
        received: {
          sessions: payload.sessions.length,
          crons: payload.crons.length,
        }
      });
    } catch {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
  }
  
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
