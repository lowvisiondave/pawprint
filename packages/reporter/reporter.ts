/**
 * PawPrint Universal Reporter 🐾
 * 
 * Full-system monitoring for any server or agent.
 * Works standalone or with OpenClaw.
 * 
 * Usage: 
 *   npx tsx reporter.ts                    # With config file
 *   npx tsx reporter.ts --openclaw        # OpenClaw mode (legacy)
 *   npx tsx reporter.ts --system-only      # System metrics only
 * 
 * Config: ~/.pawprint/config.json
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { homedir, hostname, platform, arch, totalmem, freemem, networkInterfaces, cpus, uptime as osUptime, loadavg } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

// ============================================================================
// CONFIG
// ============================================================================

interface Config {
  // API Configuration
  apiKey: string;
  apiUrl: string;
  
  // Monitoring Options
  openclaw?: boolean;
  system?: boolean;
  crons?: boolean;
  endpoints?: EndpointCheck[];
  processes?: ProcessCheck[];
  custom?: CustomMetric[];
  
  // Reporting
  intervalMinutes?: number;
}

interface EndpointCheck {
  name: string;
  url: string;
  expectedStatus?: number;
  timeout?: number;
}

interface ProcessCheck {
  name: string;
  expectedRunning?: boolean;
}

interface CustomMetric {
  name: string;
  command: string;
  parse?: 'number' | 'json' | 'text';
}

// ============================================================================
// MODEL PRICING
// ============================================================================

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

// ============================================================================
// TYPES
// ============================================================================

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
  cpuUsagePercent: number;
  memoryTotalMb: number;
  memoryFreeMb: number;
  memoryUsedPercent: number;
  diskTotalGb: number;
  diskFreeGb: number;
  diskUsedPercent: number;
  localIp: string;
  uptime: number;
  loadAvg: number[];
}

interface EndpointStatus {
  name: string;
  url: string;
  status: 'up' | 'down' | 'error';
  responseTime?: number;
  statusCode?: number;
  error?: string;
}

interface ProcessStatus {
  name: string;
  running: boolean;
  pid?: number;
  cpu?: number;
  memory?: number;
}

interface CronJob {
  name: string;
  schedule: string;
  lastRun?: string;
  lastStatus?: 'success' | 'failed' | 'running';
  lastDuration?: number;
}

interface CustomMetrics {
  [key: string]: number | string | boolean | null;
}

interface ReportPayload {
  timestamp: string;
  gateway: { online: boolean; uptime: number };
  sessions: { active: number; total: number };
  crons: { enabled: number; total: number };
  costs: { today: number; month: number };
  system?: SystemStats;
  endpoints?: EndpointStatus[];
  processes?: ProcessStatus[];
  custom?: CustomMetrics;
  errors?: {
    last24h: number;
    lastError?: { message: string; timestamp: string };
  };
}

// ============================================================================
// SYSTEM METRICS
// ============================================================================

function getSystemStats(): SystemStats {
  const totalMem = totalmem();
  const freeMem = freemem();
  const usedMem = totalMem - freeMem;
  
  // Get CPU usage
  const cpusData = cpus();
  let totalIdle = 0;
  let totalTick = 0;
  for (const cpu of cpusData) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  }
  const cpuUsagePercent = Math.round((1 - totalIdle / totalTick) * 100) || 0;
  
  // Get disk space
  let diskTotal = 0;
  let diskFree = 0;
  try {
    if (platform() === 'win32') {
      const output = execSync('wmic logicaldisk get size,freespace', { encoding: 'utf8', timeout: 5000 });
      const lines = output.trim().split('\n').slice(1);
      for (const line of lines) {
        const [free, total] = line.trim().split(/\s+/).map(Number);
        if (total > 0) {
          diskTotal += total;
          diskFree += free;
        }
      }
    } else {
      const output = execSync('df -k / 2>/dev/null || df -k . 2>/dev/null', { encoding: 'utf8', timeout: 5000 });
      const lines = output.trim().split('\n');
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        diskTotal = parseInt(parts[1] || '0') * 1024;
        diskFree = parseInt(parts[3] || '0') * 1024;
      }
    }
  } catch {}
  
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
    cpuCount: cpusData.length,
    cpuUsagePercent,
    memoryTotalMb: Math.round(totalMem / 1024 / 1024),
    memoryFreeMb: Math.round(freeMem / 1024 / 1024),
    memoryUsedPercent: Math.round((usedMem / totalMem) * 100),
    diskTotalGb: Math.round(diskTotal / 1024 / 1024 / 1024),
    diskFreeGb: Math.round(diskFree / 1024 / 1024 / 1024),
    diskUsedPercent: diskTotal > 0 ? Math.round(((diskTotal - diskFree) / diskTotal) * 100) : 0,
    localIp,
    uptime: Math.floor(osUptime()),
    loadAvg: platform() === 'win32' ? [0, 0, 0] : loadavg(),
  };
}

// ============================================================================
// ENDPOINT CHECKS
// ============================================================================

async function checkEndpoint(check: EndpointCheck): Promise<EndpointStatus> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), check.timeout || 5000);
    
    const response = await fetch(check.url, {
      signal: controller.signal,
      method: 'HEAD',
    });
    
    clearTimeout(timeout);
    const responseTime = Date.now() - start;
    const expectedStatus = check.expectedStatus || 200;
    
    return {
      name: check.name,
      url: check.url,
      status: response.status === expectedStatus ? 'up' : 'down',
      responseTime,
      statusCode: response.status,
    };
  } catch (err: any) {
    return {
      name: check.name,
      url: check.url,
      status: 'error',
      error: err.message || 'Unknown error',
      responseTime: Date.now() - start,
    };
  }
}

async function checkEndpoints(endpoints: EndpointCheck[]): Promise<EndpointStatus[]> {
  return Promise.all(endpoints.map(checkEndpoint));
}

// ============================================================================
// PROCESS MONITORING
// ============================================================================

function checkProcess(name: string): ProcessStatus {
  try {
    if (platform() === 'win32') {
      const output = execSync(`tasklist /FI "IMAGENAME eq ${name}" /FO CSV /NH`, { encoding: 'utf8', timeout: 5000 });
      const running = output.toLowerCase().includes(name.toLowerCase());
      return { name, running };
    } else {
      const output = execSync(`pgrep -f "${name}" || true`, { encoding: 'utf8', timeout: 5000 });
      const pids = output.trim().split('\n').filter(p => p);
      
      if (pids.length === 0 || (pids.length === 1 && !pids[0])) {
        return { name, running: false };
      }
      
      // Get first PID's stats
      try {
        const stats = execSync(`ps -p ${pids[0]} -o %cpu,%mem --no-headers`, { encoding: 'utf8', timeout: 5000 });
        const [cpu, mem] = stats.trim().split(/\s+/).map(Number);
        return { name, running: true, pid: parseInt(pids[0]), cpu, memory: mem };
      } catch {
        return { name, running: pids.length > 0, pid: parseInt(pids[0]) };
      }
    }
  } catch {
    return { name, running: false };
  }
}

function checkProcesses(processes: ProcessCheck[]): ProcessStatus[] {
  return processes.map(p => ({
    ...checkProcess(p.name),
    running: p.expectedRunning !== undefined ? (p.expectedRunning ? true : !checkProcess(p.name).running) : checkProcess(p.name).running,
  }));
}

// ============================================================================
// CRON MONITORING
// ============================================================================

function getCronJobs(): CronJob[] {
  const jobs: CronJob[] = [];
  
  try {
    if (platform() === 'win32') {
      // Windows: Check scheduled tasks
      const output = execSync('schtasks /query /fo CSV /NH', { encoding: 'utf8', timeout: 10000 });
      const lines = output.trim().split('\n').slice(0, 20); // Limit to 20
      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.split('","').map(p => p.replace(/"/g, ''));
        if (parts.length >= 3) {
          jobs.push({
            name: parts[0] || parts[1],
            schedule: parts[2] || 'unknown',
            lastStatus: parts[3]?.toLowerCase().includes('running') ? 'running' : 'success',
          });
        }
      }
    } else {
      // Unix: Check crontab
      const output = execSync('crontab -l 2>/dev/null || true', { encoding: 'utf8', timeout: 5000 });
      const lines = output.trim().split('\n');
      for (const line of lines) {
        if (!line.trim() || line.startsWith('#')) continue;
        const match = line.match(/^([^@]+)@(\S+)\s+(.+)$/);
        if (match) {
          jobs.push({
            name: match[3].split(' ').slice(-1).join(' ').substring(0, 50),
            schedule: match[2],
          });
        }
      }
    }
  } catch {}
  
  return jobs;
}

// ============================================================================
// OPENCLAW METRICS (Optional)
// ============================================================================

function getOpenClawMetrics(openclawDir: string): Partial<ReportPayload> {
  const result: Partial<ReportPayload> = {
    sessions: { active: 0, total: 0 },
    crons: { enabled: 0, total: 0 },
    costs: { today: 0, month: 0 },
  };
  
  try {
    // Sessions
    const sessionsFile = join(openclawDir, 'agents', 'main', 'sessions', 'sessions.json');
    if (existsSync(sessionsFile)) {
      const data = JSON.parse(readFileSync(sessionsFile, 'utf-8'));
      const sessions = Object.values(data) as any[];
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      
      for (const session of sessions) {
        result.sessions!.total++;
        const lastActivity = new Date(session.updatedAt || 0).getTime();
        if (lastActivity > tenMinutesAgo) {
          result.sessions!.active++;
        }
      }
    }
    
    // Crons
    const cronFile = join(openclawDir, 'config', 'cron.json');
    if (existsSync(cronFile)) {
      const config = JSON.parse(readFileSync(cronFile, 'utf-8'));
      const jobs = config.jobs || [];
      result.crons = {
        enabled: jobs.filter((j: any) => j.enabled !== false).length,
        total: jobs.length,
      };
    }
    
    // Gateway uptime
    const stateFile = join(openclawDir, 'gateway', 'state.json');
    if (existsSync(stateFile)) {
      const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
      const startedAt = state.startedAt || state.started_at;
      if (startedAt) {
        result.gateway = {
          online: true,
          uptime: Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000),
        };
      }
    }
  } catch (err) {
    console.error('OpenClaw metrics error:', err);
  }
  
  return result;
}

// ============================================================================
// CUSTOM METRICS
// ============================================================================

function getCustomMetrics(custom: CustomMetric[]): CustomMetrics {
  const results: CustomMetrics = {};
  
  for (const metric of custom) {
    try {
      const output = execSync(metric.command, { encoding: 'utf8', timeout: 10000 });
      
      if (metric.parse === 'number') {
        results[metric.name] = parseFloat(output.trim()) || 0;
      } else if (metric.parse === 'json') {
        const parsed = JSON.parse(output.trim());
        results[metric.name] = typeof parsed === 'number' ? parsed : JSON.stringify(parsed);
      } else {
        results[metric.name] = output.trim();
      }
    } catch (err: any) {
      results[metric.name] = null;
    }
  }
  
  return results;
}

// ============================================================================
// CONFIG LOADING
// ============================================================================

function loadConfig(): Config {
  const configPath = join(homedir(), '.pawprint', 'config.json');
  
  if (existsSync(configPath)) {
    try {
      return JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      console.warn('Failed to load config, using defaults');
    }
  }
  
  // Try environment variables
  const apiKey = process.env.PAWPRINT_API_KEY || process.env.API_KEY;
  const apiUrl = process.env.PAWPRINT_API_URL || process.env.API_URL || 'https://web-xi-khaki.vercel.app/api';
  
  if (!apiKey) {
    throw new Error('No API key found. Set PAWPRINT_API_KEY or create ~/.pawprint/config.json');
  }
  
  return {
    apiKey,
    apiUrl,
    system: true,
    crons: true,
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function postReport(payload: ReportPayload, config: Config): Promise<void> {
  const response = await fetch(`${config.apiUrl}/v1/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }
  
  console.log('✅ Report posted successfully');
}

async function main() {
  console.log('🐾 PawPrint Universal Reporter');
  console.log('================================');
  
  const config = loadConfig();
  
  const payload: ReportPayload = {
    timestamp: new Date().toISOString(),
    gateway: { online: true, uptime: 0 },
    sessions: { active: 0, total: 0 },
    crons: { enabled: 0, total: 0 },
    costs: { today: 0, month: 0 },
  };
  
  // System metrics
  if (config.system !== false) {
    console.log('\n📊 Collecting system metrics...');
    payload.system = getSystemStats();
    console.log(`   CPU: ${payload.system.cpuUsagePercent}%`);
    console.log(`   Memory: ${payload.system.memoryUsedPercent}%`);
    console.log(`   Disk: ${payload.system.diskUsedPercent}%`);
    console.log(`   Uptime: ${Math.floor(payload.system.uptime / 3600)}h`);
  }
  
  // Endpoint checks
  if (config.endpoints && config.endpoints.length > 0) {
    console.log('\n🌐 Checking endpoints...');
    payload.endpoints = await checkEndpoints(config.endpoints);
    const up = payload.endpoints.filter(e => e.status === 'up').length;
    console.log(`   ${up}/${payload.endpoints.length} healthy`);
  }
  
  // Process checks
  if (config.processes && config.processes.length > 0) {
    console.log('\n⚙️ Checking processes...');
    payload.processes = checkProcesses(config.processes);
    const running = payload.processes.filter(p => p.running).length;
    console.log(`   ${running}/${payload.processes.length} running`);
  }
  
  // Cron jobs
  if (config.crons) {
    console.log('\n⏰ Checking cron jobs...');
    const crons = getCronJobs();
    payload.crons = { enabled: crons.length, total: crons.length };
    console.log(`   ${crons.length} cron jobs found`);
  }
  
  // Custom metrics
  if (config.custom && config.custom.length > 0) {
    console.log('\n📈 Collecting custom metrics...');
    payload.custom = getCustomMetrics(config.custom);
    console.log(`   ${Object.keys(payload.custom).length} metrics collected`);
  }
  
  // OpenClaw metrics
  console.log('\n🤖 Checking OpenClaw...');
  const openclawDir = join(homedir(), '.openclaw');
  if (existsSync(openclawDir)) {
    console.log(`   OpenClaw dir: ${openclawDir}`);
    const sessionsFile = join(openclawDir, 'agents', 'main', 'sessions', 'sessions.json');
    console.log(`   Sessions file exists: ${existsSync(sessionsFile)}`);
    const ocMetrics = getOpenClawMetrics(openclawDir);
    console.log(`   Sessions from metrics: ${JSON.stringify(ocMetrics.sessions)}`);
    Object.assign(payload, ocMetrics);
    console.log(`   Sessions: ${payload.sessions.active} active, ${payload.sessions.total} total`);
    console.log(`   Crons: ${payload.crons.enabled} enabled`);
  } else {
    console.log('   OpenClaw directory not found');
  }
  
  // Gateway is online if we got this far
  payload.gateway.online = true;
  if (payload.system) {
    payload.gateway.uptime = payload.system.uptime;
  }
  
  console.log('\n📤 Posting report...');
  await postReport(payload, config);
  
  console.log('\n✨ Done!');
}

main().catch(err => {
  console.error('❌ Reporter failed:', err.message);
  process.exit(1);
});
