/**
 * pawprint API 🐾 (Vercel serverless)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handle } from 'hono/vercel';

const app = new Hono().basePath('/api');

// CORS for frontend
app.use('/*', cors({
  origin: ['http://localhost:3000', 'https://pawprint.vercel.app', 'https://*.vercel.app'],
}));

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

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

// In-memory store (will need KV or DB for production)
const reports: Map<string, { payload: ReportPayload; receivedAt: Date }> = new Map();

// Receive reports from OpenClaw instances
app.post('/v1/report', async (c) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing API key' }, 401);
  }
  
  const apiKey = authHeader.slice(7);
  
  if (!apiKey) {
    return c.json({ error: 'Invalid API key' }, 401);
  }
  
  try {
    const payload = await c.req.json<ReportPayload>();
    
    reports.set(apiKey, {
      payload,
      receivedAt: new Date(),
    });
    
    return c.json({ 
      success: true, 
      received: {
        sessions: payload.sessions.length,
        crons: payload.crons.length,
      }
    });
  } catch (err) {
    return c.json({ error: 'Invalid payload' }, 400);
  }
});

// Get dashboard data
app.get('/v1/dashboard', async (c) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing API key' }, 401);
  }
  
  const apiKey = authHeader.slice(7);
  const report = reports.get(apiKey);
  
  if (!report) {
    return c.json({ 
      latestReport: null,
      reportedAt: null,
      gatewayOnline: false,
      message: 'No reports received yet. Install the reporter cron job.',
    });
  }
  
  const ageMs = Date.now() - report.receivedAt.getTime();
  const gatewayOnline = ageMs < 10 * 60 * 1000;
  
  return c.json({
    latestReport: report.payload,
    reportedAt: report.receivedAt.toISOString(),
    gatewayOnline,
  });
});

// List sessions
app.get('/v1/sessions', async (c) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing API key' }, 401);
  }
  
  const apiKey = authHeader.slice(7);
  const report = reports.get(apiKey);
  
  if (!report) {
    return c.json({ sessions: [], message: 'No reports received yet' });
  }
  
  return c.json({ sessions: report.payload.sessions });
});

// List cron jobs
app.get('/v1/crons', async (c) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing API key' }, 401);
  }
  
  const apiKey = authHeader.slice(7);
  const report = reports.get(apiKey);
  
  if (!report) {
    return c.json({ crons: [], message: 'No reports received yet' });
  }
  
  return c.json({ crons: report.payload.crons });
});

export const GET = handle(app);
export const POST = handle(app);
