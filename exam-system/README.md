# Exam System

Next.js based mock exam and grading system.

## Development

```bash
npm install
npm run dev
```

## Durable storage on Vercel

This app now stores submissions and grades through a storage adapter:

- Local development: filesystem under the repository root
- Vercel production: Vercel Blob via `BLOB_READ_WRITE_TOKEN`

Without `BLOB_READ_WRITE_TOKEN`, Vercel deployments cannot persist grading results reliably because the server filesystem is not durable.

Set the following environment variables in Vercel:

```bash
OPENAI_API_KEY=...
BLOB_READ_WRITE_TOKEN=...
```

## What changed

- Student submissions are saved through a shared storage layer
- Grade results are saved through the same durable storage layer
- Submission listing and file serving now read from the same storage backend
- The exam screen shows score and per-question `○ / ×` even if persistence fails after local grading
