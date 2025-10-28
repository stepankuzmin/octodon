# Octodon

A static Mastodon-compatible API server powered by markdown files and Cloudflare Workers.

## Features

- **Write in Markdown** - Create posts as simple markdown files with frontmatter
- **Mastodon-Compatible** - Works with existing Mastodon clients
- **No Database** - All data compiled to static JSON at build time
- **Serverless** - Runs on Cloudflare Workers, serves from R2
- **Simple** - ~200 lines of TypeScript total

## Project Structure

```
octodon/
├── posts/              # Your markdown posts
├── account.json        # Your account information
├── src/
│   ├── build.ts       # Compiles markdown → JSON
│   └── worker.ts      # Cloudflare Worker (API endpoints)
├── wrangler.toml      # Cloudflare config
└── package.json
```

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Your Account

Edit `account.json` with your information.

### 3. Write Posts

Create markdown files in `posts/` with frontmatter:

```markdown
---
date: 2025-01-15T10:30:00.000Z
visibility: public
---

Your post content in **markdown** format.
```

### 4. Build

```bash
npm run build
```

This generates `dist/posts.json`.

### 5. Create R2 Bucket

```bash
npx wrangler r2 bucket create octodon-data
```

### 6. Upload Data to R2

```bash
npx wrangler r2 object put octodon-data/posts.json --file=dist/posts.json
```

### 7. Deploy Worker

```bash
npm run deploy
```

### 8. Test

```bash
# Get public timeline
curl https://octodon.YOUR_USERNAME.workers.dev/api/v1/timelines/public

# Get instance info
curl https://octodon.YOUR_USERNAME.workers.dev/api/v1/instance
```

## Development

Test locally with:

```bash
npm run dev
```

Note: Local dev mode won't have access to R2. You'll need to mock the data or test after deploying.

## API Endpoints

- `GET /api/v1/timelines/public` - Public timeline
- `GET /api/v1/statuses/:id` - Individual status
- `GET /api/v1/instance` - Instance information
- `GET /api/v1/accounts/:id` - Account information

## Post Frontmatter Options

- `date` - ISO 8601 timestamp (or extracted from filename)
- `visibility` - `public`, `unlisted`, `private`, `direct` (default: `public`)
- `sensitive` - Boolean (default: `false`)
- `spoiler_text` - Content warning text (default: `""`)
- `language` - ISO 639-1 code (default: `en`)

## What's Not Implemented (Yet)

- Pagination (returns all posts, clients handle display)
- ActivityPub federation
- Replies, boosts, favorites
- Media uploads (can link to external images in markdown)
- Search
- Authentication (read-only API)

## License

MIT
