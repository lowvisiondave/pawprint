/**
 * pawprint reporter 🐾
 * 
 * Collects OpenClaw gateway data and posts to pawprint API.
 * Install as a cron job in your OpenClaw instance.
 * 
 * Usage: npx tsx reporter.ts
 * 
 * Environment:
 *   PAWPRINT_API_KEY - Your pawprint API key
 *   PAWPRINT_API_URL - API endpoint (default: https://web-xi-khaki.vercel.app/api)
 */

import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

interface ReportPayload {
  timestamp: string;
  gateway: { online: boolean; uptime: number };
  sessions: { active: number; total: number };
  crons: { enabled: number; total: number };
  costs: { today: number; month: number };
}

const API_URL = process.env.PAWPRINT_API_URL || 'https://web-xi-khaki.vercel.app/api';
const API_KEY = process.env.PAWPRINT_API_KEY;

function getOpenClawDir(): string {
  const candidates = [
    join(homedir(), '.openclaw'),
    '/home/dave/.openclaw',
  ];
  
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  
  throw new Error('OpenClaw directory not found');
}

function countSessions(openclawDir: string): { active: number; total: number } {
  const sessionsDir = join(openclawDir, 'agents', 'main', 'sessions');
  
  if (!existsSync(sessionsDir)) {
    return { active: 0, total: 0 };
  }
  
  try {
    const sessionsFile = join(sessionsDir, 'sessions.json');
    if (!existsSync(sessionsFile)) {
      return { active: 0, total: 0 };
    }
    
    const data = JSON.parse(readFileSync(sessionsFile, 'utf-8'));
    const sessions = Array.isArray(data) ? data : Object.values(data);
    
    // Count active sessions (activity in last 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const active = sessions.filter((s: any) => {
      const lastActivity = new Date(s.lastActivity || s.updatedAt || 0).getTime();
      return lastActivity > tenMinutesAgo;
    }).length;
    
    return { active, total: sessions.length };
  } catch (err) {
    console.error('Failed to count sessions:', err);
    return { active: 0, total: 0 };
  }
}

function getGatewayUptime(openclawDir: string): number {
  // Read gateway start time from config or state
  const stateFile = join(openclawDir, 'gateway', 'state.json');
  
  if (!existsSync(stateFile)) {
    return 0;
  }
  
  try {
    const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
    const startedAt = state.startedAt || state.started_at;
    if (startedAt) {
      return Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    }
  } catch (err) {
    // Ignore
  }
  
  return 0;
}

function getCronStats(openclawDir: string): { enabled: number; total: number } {
  // Try to read cron config
  const cronConfigFile = join(openclawDir, 'config', 'cron.json');
  
  if (!existsSync(cronConfigFile)) {
    return { enabled: 0, total: 0 };
  }
  
  try {
    const config = JSON.parse(readFileSync(cronConfigFile, 'utf-8'));
    const jobs = config.jobs || [];
    return {
      enabled: jobs.filter((j: any) => j.enabled !== false).length,
      total: jobs.length
    };
  } catch (err) {
    return { enabled: 0, total: 0 };
  }
}

function estimateCosts(sessions: { total: number }): { today: number; month: number } {
  // Rough estimate: $0.01 per session per hour
  const hourlyRate = 0.01;
  const hoursThisMonth = new Date().getDate() * 24; // rough
  
  return {
    today: sessions.total * hourlyRate,
    month: sessions.total * hourlyRate * hoursThisMonth
  };
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
  
  const sessions = countSessions(openclawDir);
  console.log(`Sessions: ${sessions.active} active, ${sessions.total} total`);
  
  const uptime = getGatewayUptime(openclawDir);
  console.log(`Gateway uptime: ${uptime}s`);
  
  const crons = getCronStats(openclawDir);
  console.log(`Crons: ${crons.enabled} enabled, ${crons.total} total`);
  
  const costs = estimateCosts(sessions);
  console.log(`Costs: $${costs.today.toFixed(4)} today, $${costs.month.toFixed(4)} month`);
  
  const payload: ReportPayload = {
    timestamp: new Date().toISOString(),
    gateway: {
      online: true,
      uptime,
    },
    sessions,
    crons,
    costs,
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
