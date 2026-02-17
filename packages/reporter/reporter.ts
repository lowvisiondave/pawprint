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

import { readFileSync, existsSync, statSync } from 'fs';
import { homedir, hostname, platform, arch, totalmem, freemem, networkInterfaces, cpus } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

// Model pricing per 1M tokens (input/output)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-5': { input: 15, output: 75 },
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'claude-sonnet-4': { input: 3, output: 15 },
  'claude-haiku-3-5': { input: 0.25, output: 1.25 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'deepseek-v3': { input: 0.27, output: 1.1 },
  'default': { input: 3, output: 15 },
};

interface TokenStats {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface SystemStats {
  hostname: string;
  platform: string;
  arch: string;
  cpuCount: number;
  memoryTotalMb: number;
  memoryFreeMb: number;
  memoryUsedPercent: number;
  diskTotalGb: number;
  diskFreeGb: number;
  diskUsedPercent: number;
  localIp: string;
}

interface SessionData {
  active: number;
  total: number;
  tokens: TokenStats;
  modelBreakdown: Record<string, number>;
}

interface ReportPayload {
  timestamp: string;
  gateway: { online: boolean; uptime: number };
  sessions: { active: number; total: number };
  crons: { enabled: number; total: number };
  costs: { today: number; month: number };
  tokens?: TokenStats;
  modelBreakdown?: Record<string, number>;
  system?: SystemStats;
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

function getSystemStats(): SystemStats {
  const totalMem = totalmem();
  const freeMem = freemem();
  const usedMem = totalMem - freeMem;
  
  // Get disk space
  let diskTotal = 0;
  let diskFree = 0;
  try {
    if (platform() === 'win32') {
      // Windows: use wmic
      const output = execSync('wmic logicaldisk get size,freespace', { encoding: 'utf8' });
      const lines = output.trim().split('\n').slice(1);
      for (const line of lines) {
        const [free, total] = line.trim().split(/\s+/).map(Number);
        if (total > 0) {
          diskTotal += total;
          diskFree += free;
        }
      }
    } else {
      // Unix: use df
      const output = execSync('df -k / 2>/dev/null || df -k . 2>/dev/null', { encoding: 'utf8' });
      const lines = output.trim().split('\n');
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        diskTotal = parseInt(parts[1] || '0') * 1024;
        diskFree = parseInt(parts[3] || '0') * 1024;
      }
    }
  } catch (err) {
    // Ignore disk errors
  }
  
  // Get local IP
  let localIp = '127.0.0.1';
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        localIp = net.address;
        break;
      }
    }
  }
  
  return {
    hostname: hostname(),
    platform: platform(),
    arch: arch(),
    cpuCount: cpus().length,
    memoryTotalMb: Math.round(totalMem / 1024 / 1024),
    memoryFreeMb: Math.round(freeMem / 1024 / 1024),
    memoryUsedPercent: Math.round((usedMem / totalMem) * 100),
    diskTotalGb: Math.round(diskTotal / 1024 / 1024 / 1024),
    diskFreeGb: Math.round(diskFree / 1024 / 1024 / 1024),
    diskUsedPercent: diskTotal > 0 ? Math.round(((diskTotal - diskFree) / diskTotal) * 100) : 0,
    localIp,
  };
}

function getSessionStats(openclawDir: string): SessionData {
  const sessionsDir = join(openclawDir, 'agents', 'main', 'sessions');
  const result: SessionData = {
    active: 0,
    total: 0,
    tokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    modelBreakdown: {},
  };
  
  if (!existsSync(sessionsDir)) {
    return result;
  }
  
  try {
    const sessionsFile = join(sessionsDir, 'sessions.json');
    if (!existsSync(sessionsFile)) {
      return result;
    }
    
    const data = JSON.parse(readFileSync(sessionsFile, 'utf-8'));
    const sessions = Object.values(data) as any[];
    
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    
    for (const session of sessions) {
      result.total++;
      
      const lastActivity = new Date(session.updatedAt || 0).getTime();
      if (lastActivity > tenMinutesAgo) {
        result.active++;
      }
      
      if (lastActivity > todayMs) {
        const inputTokens = session.inputTokens || 0;
        const outputTokens = session.outputTokens || 0;
        
        result.tokens.inputTokens += inputTokens;
        result.tokens.outputTokens += outputTokens;
        result.tokens.totalTokens += session.totalTokens || (inputTokens + outputTokens);
        
        const model = session.model || session.modelOverride || 'unknown';
        result.modelBreakdown[model] = (result.modelBreakdown[model] || 0) + 1;
      }
    }
    
    return result;
  } catch (err) {
    console.error('Failed to get session stats:', err);
    return result;
  }
}

function calculateCosts(tokens: TokenStats, modelBreakdown: Record<string, number>): { today: number; month: number } {
  const primaryModel = Object.entries(modelBreakdown)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'default';
  
  const modelKey = Object.keys(MODEL_PRICING).find(k => primaryModel.includes(k)) || 'default';
  const pricing = MODEL_PRICING[modelKey];
  
  const inputCost = (tokens.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (tokens.outputTokens / 1_000_000) * pricing.output;
  const todayCost = inputCost + outputCost;
  
  const dayOfMonth = new Date().getDate();
  const monthCost = todayCost * dayOfMonth;
  
  return {
    today: Math.round(todayCost * 100) / 100,
    month: Math.round(monthCost * 100) / 100,
  };
}

function getGatewayUptime(openclawDir: string): number {
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
  
  const sessionStats = getSessionStats(openclawDir);
  console.log(`Sessions: ${sessionStats.active} active, ${sessionStats.total} total`);
  console.log(`Tokens today: ${sessionStats.tokens.inputTokens.toLocaleString()} in / ${sessionStats.tokens.outputTokens.toLocaleString()} out`);
  console.log(`Models: ${JSON.stringify(sessionStats.modelBreakdown)}`);
  
  const uptime = getGatewayUptime(openclawDir);
  console.log(`Gateway uptime: ${uptime}s`);
  
  const crons = getCronStats(openclawDir);
  console.log(`Crons: ${crons.enabled} enabled, ${crons.total} total`);
  
  const costs = calculateCosts(sessionStats.tokens, sessionStats.modelBreakdown);
  console.log(`Costs: $${costs.today.toFixed(2)} today, $${costs.month.toFixed(2)} month (estimated)`);
  
  const system = getSystemStats();
  console.log(`System: ${system.hostname} (${system.platform}/${system.arch})`);
  console.log(`Memory: ${system.memoryUsedPercent}% used (${system.memoryFreeMb}MB free)`);
  console.log(`Disk: ${system.diskUsedPercent}% used (${system.diskFreeGb}GB free)`);
  console.log(`Network: ${system.localIp}`);
  
  const payload: ReportPayload = {
    timestamp: new Date().toISOString(),
    gateway: {
      online: true,
      uptime,
    },
    sessions: {
      active: sessionStats.active,
      total: sessionStats.total,
    },
    crons,
    costs,
    tokens: sessionStats.tokens,
    modelBreakdown: sessionStats.modelBreakdown,
    system,
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
