import { neon } from '@neondatabase/serverless';

const sql = neon('postgresql://neondb_owner:npg_QsULYIBt3kF1@ep-cool-block-ain0l1y0-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

const result = await sql`SELECT id, name, api_key FROM workspaces LIMIT 5`;
console.log(JSON.stringify(result, null, 2));
