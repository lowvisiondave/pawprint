# PawPrint - Agent Ops Dashboard

## What is this?

AI agent operations dashboard. Monitor your OpenClaw agents, cron jobs, costs, and errors in one place.

## Architecture

- **Reporter**: Small script users install on their OpenClaw machine. Reads local session/cron data and pushes to our API.
- **API**: Receives reports, stores in Postgres, serves dashboard data.
- **Web**: Next.js dashboard UI.

## MVP Features

### v1 (This Week)
- [ ] Sessions list (active + recent)
- [ ] Cron job status (last run, next run, pass/fail)
- [ ] Cost tracking (tokens × model price)
- [ ] Simple dashboard UI

### v2
- [ ] Error log aggregation
- [ ] Alert integrations (Slack/Discord)
- [ ] Historical charts

## API Design

```
POST /v1/report    # Reporter pushes data
GET  /v1/dashboard  # Dashboard fetches data
```

## DB Schema (Prisma)

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  apiKey    String   @unique
  gateways  Gateway[]
  createdAt DateTime @default(now())
}

model Gateway {
  id        String   @id @default(cuid())
  userId    String
  name      String
  lastSeen  DateTime
  reports   Report[]
  user      User     @relation(fields: [userId], references: [id])
}

model Report {
  id          String   @id @default(cuid())
  gatewayId   String
  sessions    Json
  cronJobs    Json
  costs       Json
  createdAt   DateTime @default(now())
  gateway     Gateway  @relation(fields: [gatewayId], references: [id])
}
```

## Division of Labor

- **Sledgy**: `packages/web` - Next.js frontend, Vercel
- **Claw**: `packages/reporter` + `packages/api` - Push script, backend

## Timeline

- Day 1-2: Scaffold all packages
- Day 3-4: Connect reporter → API → DB
- Day 5: Dashboard UI ties it together
