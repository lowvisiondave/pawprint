import { NextRequest, NextResponse } from 'next/server';

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

// In-memory store (replace with database later)
const reports: Map<string, { payload: ReportPayload; receivedAt: Date }> = new Map();

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
    const report = reports.get(apiKey);
    
    if (!report) {
      return NextResponse.json({
        latestReport: null,
        reportedAt: null,
        gatewayOnline: false,
        message: 'No reports received yet.',
      });
    }
    
    const ageMs = Date.now() - report.receivedAt.getTime();
    const gatewayOnline = ageMs < 10 * 60 * 1000;
    
    return NextResponse.json({
      latestReport: report.payload,
      reportedAt: report.receivedAt.toISOString(),
      gatewayOnline,
    });
  }
  
  if (path[0] === 'sessions') {
    const report = reports.get(apiKey);
    return NextResponse.json({ 
      sessions: report?.payload.sessions || [] 
    });
  }
  
  if (path[0] === 'crons') {
    const report = reports.get(apiKey);
    return NextResponse.json({ 
      crons: report?.payload.crons || [] 
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
      const payload = await request.json<ReportPayload>();
      
      reports.set(apiKey, {
        payload,
        receivedAt: new Date(),
      });
      
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
