/**
 * pawprint reporter 🐾
 * 
 * Collects OpenClaw session and cron data, posts to pawprint API.
 * Install as a cron job in your OpenClaw instance.
 * 
 * Usage: npx tsx reporter.ts
 * 
 * Environment:
 *   PAWPRINT_API_KEY - Your pawprint API key
 *   PAWPRINT_API_URL - API endpoint (default: https://api.pawprint.dev)
 */

import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join, resolve } from 'path';

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

const API_URL = process.env.PAWPRINT_API_URL || 'https://web-zeta-ecru-50.vercel.app/api';
const API_KEY = process.env.PAWPRINT_API_KEY;

function getOpenClawDir(): string {
  // Check common locations
  const candidates = [
    join(homedir(), '.openclaw'),
    '/home/dave/.openclaw', // fallback
  ];
  
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  
  throw new Error('OpenClaw directory not found');
}

function collectSessions(openclawDir: string): Session[] {
  const sessions: Session[] = [];
  const agentsDir = join(openclawDir, 'agents');
  
  if (!existsSync(agentsDir)) {
    console.warn('No agents directory found');
    return sessions;
  }
  
  // Find all agent session files
  const agents = ['main']; // TODO: discover all agents
  
  for (const agent of agents) {
    const sessionsFile = join(agentsDir, agent, 'sessions', 'sessions.json');
    
    if (existsSync(sessionsFile)) {
      try {
        const data = JSON.parse(readFileSync(sessionsFile, 'utf-8'));
        
        // Parse session data - structure may vary
        if (Array.isArray(data)) {
          for (const session of data) {
            sessions.push({
              key: truncateKey(session.key || session.id || 'unknown'),
              kind: session.kind || 'direct',
              model: extractModel(session.model || session.defaultModel || 'unknown'),
              tokensUsed: session.tokensUsed || session.tokens?.used || 0,
              tokensMax: session.tokensMax || session.tokens?.max || 200000,
              lastActivity: session.lastActivity || session.updatedAt || new Date().toISOString(),
            });
          }
        } else if (typeof data === 'object') {
          // Handle object-keyed sessions
          for (const [key, session] of Object.entries(data)) {
            const s = session as any;
            sessions.push({
              key: truncateKey(key),
              kind: s.kind || 'direct',
              model: extractModel(s.model || s.defaultModel || 'unknown'),
              tokensUsed: s.tokensUsed || s.tokens?.used || 0,
              tokensMax: s.tokensMax || s.tokens?.max || 200000,
              lastActivity: s.lastActivity || s.updatedAt || new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.error(`Failed to parse sessions for agent ${agent}:`, err);
      }
    }
  }
  
  return sessions;
}

function truncateKey(key: string): string {
  if (key.length <= 20) return key;
  return key.slice(0, 10) + '...' + key.slice(-6);
}

function extractModel(model: string): string {
  // Extract just the model name from provider/model format
  const parts = model.split('/');
  return parts[parts.length - 1];
}

function formatSchedule(schedule: any): string {
  if (!schedule) return 'unknown';
  
  if (schedule.kind === 'cron') {
    return `cron: ${schedule.expr}`;
  } else if (schedule.kind === 'every') {
    const mins = Math.round(schedule.everyMs / 60000);
    if (mins < 60) return `every ${mins}m`;
    const hours = Math.round(mins / 60);
    return `every ${hours}h`;
  } else if (schedule.kind === 'at') {
    return `at ${schedule.at}`;
  }
  
  return JSON.stringify(schedule);
}

async function collectCrons(): Promise<CronJob[]> {
  // In a real implementation, this would call the OpenClaw cron API
  // For now, we'll read from the config or use the tool
  
  // This is a placeholder - the actual implementation would use
  // the OpenClaw internal API or read from cron state files
  
  console.log('Cron collection requires OpenClaw tool access');
  return [];
}

async function postReport(payload: ReportPayload): Promise<void> {
  if (!API_KEY) {
    throw new Error('PAWPRINT_API_KEY environment variable required');
  }
  
  const response = await fetch(`${API_URL}/v1/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }
  
  console.log('Report posted successfully');
}

async function main() {
  console.log('🐾 pawprint reporter starting...');
  
  const openclawDir = getOpenClawDir();
  console.log(`OpenClaw dir: ${openclawDir}`);
  
  const sessions = collectSessions(openclawDir);
  console.log(`Collected ${sessions.length} sessions`);
  
  const crons = await collectCrons();
  console.log(`Collected ${crons.length} cron jobs`);
  
  const payload: ReportPayload = {
    sessions,
    crons,
    timestamp: new Date().toISOString(),
    agentId: 'main', // TODO: make configurable
  };
  
  if (API_KEY) {
    await postReport(payload);
  } else {
    console.log('No API key set - dry run mode');
    console.log('Payload:', JSON.stringify(payload, null, 2));
  }
}

main().catch(err => {
  console.error('Reporter failed:', err);
  process.exit(1);
});
