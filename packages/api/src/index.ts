/**
 * pawprint API 🐾
 * 
 * Receives reports from OpenClaw instances, serves dashboard data.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bearerAuth } from 'hono/bearer-auth';

const app = new Hono();

// CORS for frontend
app.use('/*', cors({
  origin: ['http://localhost:3000', 'https://pawprint.dev'],
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

// In-memory store (replace with Postgres later)
const reports: Map<string, { payload: ReportPayload; receivedAt: Date }> = new Map();

// Receive reports from OpenClaw instances
app.post('/v1/report', async (c) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing API key' }, 401);
  }
  
  const apiKey = authHeader.slice(7);
  
  // TODO: Validate API key against database
  // For now, accept any non-empty key
  if (!apiKey) {
    return c.json({ error: 'Invalid API key' }, 401);
  }
  
  try {
    const payload = await c.req.json<ReportPayload>();
    
    // Store report (keyed by API key for now)
    reports.set(apiKey, {
      payload,
      receivedAt: new Date(),
    });
    
    console.log(`Report received: ${payload.sessions.length} sessions, ${payload.crons.length} crons`);
    
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
  
  // Consider gateway "online" if report is < 10 minutes old
  const ageMs = Date.now() - report.receivedAt.getTime();
  const gatewayOnline = ageMs < 10 * 60 * 1000;
  
  return c.json({
    latestReport: report.payload,
    reportedAt: report.receivedAt.toISOString(),
    gatewayOnline,
  });
});

// List sessions (convenience endpoint)
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

// List cron jobs (convenience endpoint)
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

// Start server
import { serve } from '@hono/node-server';

const port = Number(process.env.PORT) || 3001;

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`🐾 pawprint API running on http://localhost:${info.port}`);
});
