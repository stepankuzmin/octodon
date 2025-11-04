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

### 8. Configure GitHub OAuth (Optional - for posting via Elk)

To enable posting from Mastodon clients like Elk:

**a) Create GitHub OAuth App:**
1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Configure:
   - Application name: `Octodon`
   - Homepage URL: `https://octodon.YOUR_USERNAME.workers.dev`
   - Callback URL: `https://octodon.YOUR_USERNAME.workers.dev/oauth/github/callback`
4. Save the Client ID and Client Secret

**b) Set Worker Secrets:**
```bash
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
```

### 9. Test

```bash
# Get public timeline (no auth needed)
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

## API Access

### Unauthenticated Access (Simplest)

All public endpoints work without authentication:

```bash
# Get public timeline
curl https://octodon.stepan-kuzmin.workers.dev/api/v1/timelines/public

# Get instance info
curl https://octodon.stepan-kuzmin.workers.dev/api/v1/instance

# Get specific post
curl https://octodon.stepan-kuzmin.workers.dev/api/v1/statuses/1737796500000
```

### OAuth Access (For Mastodon Clients - Posting Enabled)

When you configure GitHub OAuth (step 8), this instance bridges Mastodon OAuth to GitHub OAuth:

**Sign-in flow:**
1. Client initiates OAuth
2. Redirected to GitHub for authentication
3. Authorize via GitHub (real authentication!)
4. Validated as instance owner
5. GitHub token returned to client
6. Posts commit to GitHub as markdown → CI rebuilds

**Authentication model:**
- ✅ **Read access**: Public, no auth needed
- ✅ **Write access**: GitHub OAuth, owner only
- ✅ Real authentication via GitHub
- ✅ Posts as markdown (version control maintained)
- ✅ Stateless (no database or KV storage)

**Without GitHub OAuth configured:**
- Public read-only access works
- Posting returns 401 Unauthorized

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
