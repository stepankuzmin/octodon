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
# GitHub OAuth credentials
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET

# Encryption keys (generate random 32-char strings)
wrangler secret put ENCRYPTION_KEY
wrangler secret put HMAC_SECRET
```

**c) Generate Encryption Keys:**
```bash
# On macOS/Linux:
openssl rand -base64 32  # Use for ENCRYPTION_KEY
openssl rand -base64 32  # Use for HMAC_SECRET
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

**What happens when you sign in via Elk:**
1. You click "Sign in" in Elk
2. Octodon redirects you to GitHub
3. You authorize via GitHub (real authentication!)
4. Octodon validates you're the instance owner
5. Returns encrypted GitHub token to Elk
6. You can now post from Elk → commits to GitHub → CI rebuilds

**Authentication model:**
- ✅ **Read access**: Public, no auth needed
- ✅ **Write access**: Requires GitHub OAuth (owner only)
- ✅ Real GitHub authentication validates identity
- ✅ Posts commit to Git (maintains version control)
- ✅ Stateless (no database, tokens encrypted in OAuth codes)

**Without GitHub OAuth configured:**
- Public read-only access still works
- Clients can browse timeline without authentication
- Posting disabled (returns 401)

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
