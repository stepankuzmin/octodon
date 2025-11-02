# Octodon 🐘

A tiny Mastodon API implementation using Markdown files as a source and Cloudflare Workers as the API endpoint.

## Features

- ✅ **Zero runtime dependencies** - Pure TypeScript, no external libraries at runtime
- ✅ **Markdown-based** - Write your toots in markdown files with YAML frontmatter
- ✅ **Build-time generation** - Static JSON files generated from markdown
- ✅ **Cloudflare Workers** - Edge-deployed, globally distributed API
- ✅ **Mastodon-compatible** - Works with existing Mastodon clients
- ✅ **Git-based workflow** - Version control for your social media posts
- ✅ **Fast & free** - Instant responses, fits in Cloudflare's free tier

## Architecture

```
┌─────────────┐
│  Markdown   │
│   Files     │  ──┐
│ (toots/*.md)│    │
└─────────────┘    │
                   │ Build Script
┌─────────────┐    │ (Node.js)
│ config.json │  ──┤
└─────────────┘    │
                   ↓
              ┌──────────┐
              │   JSON   │
              │  Files   │
              └──────────┘
                   │
        ┌──────────┼──────────┐
        ↓          ↓          ↓
   statuses.json  index.json  instance.json
   (Workers KV)   (embedded)  (embedded)
        │          │          │
        └──────────┼──────────┘
                   ↓
            ┌─────────────┐
            │  Cloudflare │
            │   Workers   │
            └─────────────┘
                   │
                   ↓
           Mastodon API Endpoints
```

## Getting Started

### Prerequisites

- Node.js 20+
- Cloudflare account (free tier works)
- Wrangler CLI
- Git

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/octodon.git
cd octodon
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure your instance**

Edit `config.json` with your details:

```json
{
  "instance": {
    "domain": "your-worker.workers.dev",
    "title": "My Octodon Instance",
    "version": "0.1.0",
    "description": "Your description",
    "sourceUrl": "https://github.com/yourusername/octodon",
    "languages": ["en"]
  },
  "account": {
    "id": "1",
    "username": "yourusername",
    "display_name": "Your Name",
    "note": "<p>Your bio</p>",
    "avatar": "https://example.com/avatar.jpg",
    "header": "https://example.com/header.jpg"
  }
}
```

4. **Create Workers KV namespace**

```bash
npx wrangler kv namespace create STATUSES_KV
npx wrangler kv namespace create STATUSES_KV --preview
```

Update `wrangler.toml` with your namespace IDs:

```toml
[[kv_namespaces]]
binding = "STATUSES_KV"
id = "YOUR_KV_NAMESPACE_ID"
preview_id = "YOUR_PREVIEW_KV_NAMESPACE_ID"
```

5. **Build and deploy locally**

```bash
# Build static JSON from markdown
npm run build

# Upload to KV (get namespace ID from wrangler.toml)
npx wrangler kv key put statuses "$(cat dist/statuses.json)" --namespace-id=YOUR_KV_NAMESPACE_ID

# Deploy worker
npm run deploy
```

## Writing Toots

Create markdown files in the `toots/` directory:

```markdown
---
id: "109382936587234001"
created_at: "2025-01-15T10:00:00Z"
visibility: public
sensitive: false
language: en
replies_count: 0
reblogs_count: 0
favourites_count: 0
---

Your toot content here! You can use **markdown** formatting.

- Lists work
- [Links](https://example.com) too
- And `code` blocks

```

### Required Frontmatter Fields

- `id` - Unique identifier (string)
- `created_at` - ISO 8601 timestamp

### Optional Frontmatter Fields

- `visibility` - `public`, `unlisted`, `private`, or `direct` (default: `public`)
- `sensitive` - Boolean (default: `false`)
- `spoiler_text` - Content warning text (default: `""`)
- `language` - ISO 639-1 language code (default: `null`)
- `in_reply_to_id` - ID of parent status (default: `null`)
- `replies_count` - Number of replies (default: `0`)
- `reblogs_count` - Number of boosts (default: `0`)
- `favourites_count` - Number of favorites (default: `0`)

## API Endpoints

The worker implements these Mastodon API endpoints:

- `GET /api/v1/instance` - Instance metadata
- `GET /api/v1/accounts/:id` - Account information
- `GET /api/v1/accounts/:id/statuses` - Account's statuses
- `GET /api/v1/timelines/public` - Public timeline
- `GET /api/v1/statuses/:id` - Individual status

All endpoints support CORS and return standard Mastodon JSON responses.

## GitHub Actions CI/CD

The repository includes a GitHub Actions workflow that:

1. Triggers on push to `main` branch (when `toots/`, `config.json`, or `src/` changes)
2. Runs the build script to generate JSON files
3. Uploads `statuses.json` to Workers KV
4. Deploys the worker to Cloudflare

### Required Secrets

Add these secrets to your GitHub repository:

- `CLOUDFLARE_API_TOKEN` - API token with Workers edit permissions
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `KV_NAMESPACE_ID` - Your production KV namespace ID
- `KV_PREVIEW_NAMESPACE_ID` - Your preview KV namespace ID

## Development

```bash
# Run build script
npm run build

# Start local development server
npm run dev

# Deploy to production
npm run deploy

# Generate TypeScript types
npm run types
```

## Project Structure

```
octodon/
├── src/
│   ├── index.ts          # Worker entry point
│   └── types.ts          # TypeScript types
├── scripts/
│   └── build.ts          # Build script
├── toots/
│   ├── 001-hello.md      # Your toots
│   └── ...
├── dist/                  # Generated (git-ignored)
│   ├── statuses.json     # Full statuses (for KV)
│   ├── index.json        # Timeline index (embedded)
│   ├── account.json      # Account data (embedded)
│   └── instance.json     # Instance data (embedded)
├── .github/
│   └── workflows/
│       └── deploy.yml    # CI/CD pipeline
├── config.json           # Instance configuration
├── package.json
├── tsconfig.json
└── wrangler.toml
```

## Limitations

This is a minimal implementation with some limitations:

- **Read-only** - No posting, liking, or boosting (it's static content)
- **Single account** - Only supports one user
- **No media uploads** - Can link to external images/videos
- **No authentication** - All content is public
- **Basic pagination** - Uses `limit` and `max_id` parameters
- **No search** - No full-text search functionality
- **No real-time updates** - Static content, no WebSocket streaming

## Use Cases

Perfect for:

- 📚 **Personal archives** - Migrate old tweets or posts to a self-hosted format
- 💼 **Portfolio** - Share updates in a federated way
- 📖 **Blogs** - Markdown-based microblogging
- 🔍 **Read-only feeds** - Public announcements or status pages
- 🎓 **Learning** - Understand Mastodon API and Workers

## Size Limits

- Worker bundle: ~100 KB (well under 1 MB limit)
- Workers KV: Up to 25 MB (supports ~16,000 toots)
- Timeline index: ~50 bytes per toot
- Full status: ~1.5 KB per toot

With the current architecture:
- ✅ 1,000 toots: ~150 KB bundle + 1.5 MB in KV
- ✅ 10,000 toots: ~500 KB bundle + 15 MB in KV

## Testing with Mastodon Clients

Once deployed, you can test with any Mastodon client:

1. **Web clients:**
   - Elk: `https://elk.zone/your-worker.workers.dev`
   - Phanpy: `https://phanpy.social/#/your-worker.workers.dev`

2. **Mobile apps:**
   - Enter your worker URL as the instance
   - Most clients will show public timeline without login

3. **cURL:**
```bash
curl https://your-worker.workers.dev/api/v1/instance
curl https://your-worker.workers.dev/api/v1/timelines/public
```

## Contributing

This is a minimal implementation designed for simplicity. Feel free to:

- Add more Mastodon API endpoints
- Implement media attachment support
- Add search functionality
- Improve markdown parsing
- Enhance error handling

## License

MIT

## Credits

Built with:
- [Cloudflare Workers](https://workers.cloudflare.com/)
- [gray-matter](https://github.com/jonschlinkert/gray-matter)
- [marked](https://github.com/markedjs/marked)
- [Mastodon API](https://docs.joinmastodon.org/api/)
