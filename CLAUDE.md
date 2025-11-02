# CLAUDE.md

**Note**: This project uses [bd (beads)](https://github.com/steveyegge/beads) for issue tracking. Use `bd` commands instead of markdown TODOs. See AGENTS.md for workflow details.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Octodon is a static Mastodon-compatible API server. Posts are written as markdown files, compiled to JSON at build time, stored in Cloudflare R2, and served via a Cloudflare Worker that implements Mastodon API endpoints.

**Design Philosophy:** Intentionally simple (~200 lines total). No pagination, no database, no complex abstractions. Returns all posts; clients handle display.

## Architecture

### Two-Phase Data Flow

1. **Build Phase** (`src/build.ts`):
   - Reads markdown files from `posts/` directory
   - Parses frontmatter with `gray-matter`
   - Converts markdown body to HTML with `marked`
   - Generates timestamp-based IDs (sortable)
   - Produces single `dist/posts.json` with Mastodon-compatible Status objects
   - Updates account metadata (post count, last status date)

2. **Runtime Phase** (`src/worker.ts`):
   - Cloudflare Worker fetches `posts.json` from R2 on every request
   - Simple if/else routing (no router library)
   - Serves 4 Mastodon API endpoints with CORS headers

### Data Format

**Posts JSON structure:**
```json
{
  "account": { /* Mastodon Account object */ },
  "statuses": [ /* Array of Mastodon Status objects */ ]
}
```

**Post filenames:** `YYYY-MM-DD-slug.md` (date extracted from filename or frontmatter)

## Common Commands

### Development
```bash
npm run build           # Compile markdown → dist/posts.json
npm run dev            # Run worker locally (won't have R2 access)
npm run deploy         # Deploy worker to Cloudflare
```

### Deployment Workflow
```bash
# 1. Build data
npm run build

# 2. Upload to R2
npx wrangler r2 object put octodon-data/posts.json --file=dist/posts.json

# 3. Deploy worker
npm run deploy
```

### Cloudflare Setup (First Time)
```bash
npx wrangler login                          # Authenticate
npx wrangler r2 bucket create octodon-data  # Create bucket
npx wrangler whoami                         # Get account ID for CI
```

### Testing
```bash
# Test endpoints after deployment
curl https://YOUR-WORKER.workers.dev/api/v1/timelines/public
curl https://YOUR-WORKER.workers.dev/api/v1/instance
curl https://YOUR-WORKER.workers.dev/api/v1/statuses/1234567890000
```

## Post Format

Markdown files in `posts/` with frontmatter:

```markdown
---
date: 2025-01-15T10:30:00.000Z
visibility: public
sensitive: false
spoiler_text: ""
language: en
---

Post content in **markdown**.
```

- `date`: ISO 8601 timestamp (falls back to filename YYYY-MM-DD pattern)
- Other fields: optional, have sensible defaults

## Configuration Files

- `account.json`: Account profile (username, avatar, bio, etc.)
- `wrangler.toml`: Worker name and R2 bucket binding (`DATA`)
- `.github/workflows/deploy.yml`: CI/CD pipeline (build → upload → deploy on push to main)

## Key Constraints

- **No pagination implemented:** Worker returns all statuses (up to `limit` param). Intentional simplification.
- **Read-only API:** No authentication, posting, or interactions.
- **Single R2 object:** All data in one `posts.json` file (fine for <1000 posts).
- **Local dev limitation:** `npm run dev` won't have R2 access; test post-deploy or mock data.
- **Hardcoded URLs in build.ts:** Update `uri`/`url` fields (lines 102-103) if changing worker name.

## Mastodon API Endpoints

Implements minimal subset for timeline browsing:
- `GET /api/v1/timelines/public` - Returns statuses array (supports `limit` param)
- `GET /api/v1/statuses/:id` - Returns single status
- `GET /api/v1/instance` - Returns instance metadata
- `GET /api/v1/accounts/:id` - Returns account object (only account ID "1")

All responses include CORS headers for client compatibility.

## GitHub Actions CI/CD

Requires two secrets:
- `CLOUDFLARE_API_TOKEN` (create with "Edit Cloudflare Workers" template)
- `CLOUDFLARE_ACCOUNT_ID` (from `wrangler whoami`)

On push to `main`: builds → uploads to R2 → deploys worker automatically.
