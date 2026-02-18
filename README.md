# PawPrint 🐾

Monitor your AI agents in real-time. Track sessions, cron jobs, costs, and uptime.

## Features

- 📊 **Session Tracking** — Monitor active sessions, token usage, and model performance
- ⏰ **Cron Monitoring** — Keep tabs on scheduled jobs, see last run status
- 💰 **Cost Insights** — Track token usage and estimate costs
- 🔔 **Alerts** — Get notified when costs spike or your agent goes offline
- 📈 **History** — Visualize metrics over time with interactive charts

## Quick Start

### Option 1: Agent Sets Up (Recommended)

The agent creates the workspace and hands off to you:

1. **Agent generates an invite link** via the API:
   ```bash
   curl -X POST "https://web-xi-khaki.vercel.app/api/v1/workspace/invite" \
     -H "Authorization: Bearer YOUR_GITHUB_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"workspaceId": 1}'
   ```

2. **Agent shares the invite URL** with you

3. **You click the link** → sign in with GitHub → get your API key

### Option 2: Manual Setup

1. Visit [pawprint.dev](https://web-xi-khaki.vercel.app) and sign in with GitHub

2. Create your first workspace → get your API key

3. Copy the install command from the dashboard

## Installation

### One-Line Installer

```bash
curl -fsSL https://pawprint.dev/install.sh | bash -s YOUR_API_KEY
```

This installer will:
- Download the reporter script
- Set up a cron job to run every 5 minutes
- Configure your API key

### Manual Setup

If you prefer to run it manually:

```bash
# Create a script at ~/pawprint-reporter.sh
cat > ~/pawprint-reporter.sh << 'EOF'
#!/bin/bash
API_KEY="YOUR_API_KEY"
API_URL="https://web-xi-khaki.vercel.app/api"

curl -X POST "$API_URL/v1/report" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d "{\"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","online\": true \"gateway\": {\, \"uptime\": $(awk '{print $1}' /proc/uptime)}, \"sessions\": {\"active\": 1, \"total\": 1}, \"crons\": {\"enabled\": 1, \"total\": 1}, \"costs\": {\"today\": 0, \"month\": 0}}"
EOF

chmod +x ~/pawprint-reporter.sh
```

Add to crontab:
```bash
*/5 * * * * ~/pawprint-reporter.sh
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

- `POST /api/v1/workspace/invite` — Generate an invite link (requires auth)
- `GET /api/v1/invite/validate?token=xxx` — Check if invite is valid
- `POST /api/v1/invite/accept` — Accept invite and join workspace
- `POST /api/v1/report` — Submit agent data (uses workspace API key)
- `GET /api/v1/dashboard` — Get latest dashboard data (requires auth)
- `GET /api/v1/history` — Get historical readings (requires auth)
- `GET /api/v1/workspaces` — List user's workspaces (requires auth)

### Agent Onboarding Flow

```bash
# 1. Agent creates workspace (via GitHub session)
curl -X GET "https://web-xi-khaki.vercel.app/api/v1/workspace/create?name=MyAgent" \
  -H "Authorization: Bearer YOUR_GITHUB_TOKEN"

# 2. Agent generates invite for human
curl -X POST "https://web-xi-khaki.vercel.app/api/v1/workspace/invite" \
  -H "Authorization: Bearer YOUR_GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workspaceId": 1}'

# Returns: { "inviteUrl": "https://web-xi-khaki.vercel.app/invite/abc123", ... }

# 3. Human clicks link → GitHub auth → gets API key
# 4. Human gives API key to agent
```

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
