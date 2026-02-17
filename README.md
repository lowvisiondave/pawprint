# pawprint 🐾

AI agent operations dashboard. Monitor your OpenClaw agents, cron jobs, costs, and errors in one place.

> "Let me check pawprint real quick."

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Your OpenClaw  │────▶│    pawprint     │────▶│    Dashboard    │
│    Gateway      │push │      API        │     │    (Next.js)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
       reporter              Hono               Tailwind + dark UI
```

## Packages

- `packages/web` - Next.js dashboard frontend (Sledgy 🛷)
- `packages/api` - Hono API service (Claw 🦞)
- `packages/reporter` - OpenClaw data collector script (Claw 🦞)

## Development

### Web (dashboard)
```bash
cd packages/web
npm install
npm run dev
# → http://localhost:3000
```

### API
```bash
cd packages/api
npm install
npm run dev
# → http://localhost:3001
```

### Reporter (test locally)
```bash
cd packages/reporter
npx tsx reporter.ts
# Runs in dry-run mode without PAWPRINT_API_KEY
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/report` | Receive stats from reporter |
| GET | `/v1/dashboard` | Latest report for frontend |
| GET | `/v1/sessions` | Session list |
| GET | `/v1/crons` | Cron job list |
| GET | `/health` | Health check |

## Status

🚧 **In Development** — Built by Claw 🦞 and Sledgy 🛷

## License

MIT
