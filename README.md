# PawPrint 🐾

Monitor your AI agents in real-time. Track sessions, cron jobs, costs, and uptime.

## Features

- 📊 **Session Tracking** — Monitor active sessions, token usage, and model performance
- ⏰ **Cron Monitoring** — Keep tabs on scheduled jobs, see last run status
- 💰 **Cost Insights** — Track token usage and estimate costs
- 🔔 **Alerts** — Get notified when costs spike or your agent goes offline
- 📈 **History** — Visualize metrics over time with interactive charts

## Quick Start

### 1. Sign Up

Visit [pawprint.dev](https://web-xi-khaki.vercel.app) and sign in with GitHub.

### 2. Create a Workspace

After signing in, create your first workspace. This generates an API key for your agent.

### 3. Install the Reporter

The reporter collects data from your OpenClaw agent and sends it to PawPrint.

```bash
# Clone the reporter
git clone https://github.com/lowvisiondave/pawprint.git
cd pawprint/packages/reporter

# Install dependencies
npm install

# Configure (set environment variables)
export PAWPRINT_API_KEY="pk_your_workspace_api_key"
export PAWPRINT_API_URL="https://your-domain.com/api"

# Run manually
npx tsx reporter.ts
```

### 4. Set Up Cron

Run the reporter every 5 minutes:

```bash
# Add to your crontab
*/5 * * * * cd /path/to/pawprint/packages/reporter && PAWPRINT_API_KEY=pk_xxx npx tsx reporter.ts
```

Or use the OpenClaw cron system:

```
npx openclaw cron add --schedule "every 5m" --command "cd /path/to/reporter && npx tsx reporter.ts"
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PAWPRINT_API_KEY` | Your workspace API key from the dashboard | Yes |
| `PAWPRINT_API_URL` | API endpoint (default: `https://web-xi-khaki.vercel.app/api`) | No |

## Alert Configuration

Configure alerts in the Dashboard Settings:

1. **Cost Threshold** — Alert when daily spend exceeds this amount
2. **Downtime Threshold** — Alert when gateway is offline for N minutes
3. **Slack Webhook** — Receive alerts in Slack

## API Reference

### Endpoints

- `POST /api/v1/report` — Submit agent data (uses workspace API key)
- `GET /api/v1/dashboard` — Get latest dashboard data (requires auth)
- `GET /api/v1/history` — Get historical readings (requires auth)
- `GET /api/v1/workspaces` — List user's workspaces (requires auth)

### Report Payload

```json
{
  "timestamp": "2026-02-17T20:00:00Z",
  "gateway": { "online": true, "uptime": 3600 },
  "sessions": { "active": 5, "total": 100 },
  "crons": { "enabled": 3, "total": 3 },
  "costs": { "today": 1.50, "month": 45.00 }
}
```

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Auth**: NextAuth.js with GitHub OAuth
- **Database**: Neon (PostgreSQL)
- **Charts**: Recharts

## Development

```bash
# Clone and install
git clone https://github.com/lowvisiondave/pawprint.git
cd pawprint/packages/web

# Copy environment
cp .env.example .env.local

# Run locally
npm run dev
```

## License

MIT
