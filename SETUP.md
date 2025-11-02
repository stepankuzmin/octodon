# Quick Setup Guide

Follow these steps to deploy your own Octodon instance.

## Step 1: Clone and Install

```bash
git clone <your-repo>
cd octodon
npm install
```

## Step 2: Configure

Edit `config.json`:
- Change `domain` to your worker URL
- Update `username`, `display_name`, etc.
- Set your `avatar` and `header` URLs

## Step 3: Create KV Namespaces

```bash
# Create production namespace
npx wrangler kv namespace create STATUSES_KV

# Create preview namespace
npx wrangler kv namespace create STATUSES_KV --preview
```

You'll get output like:
```
🌀 Creating namespace with title "octodon-STATUSES_KV"
✨ Success!
Add the following to your configuration file:
[[kv_namespaces]]
binding = "STATUSES_KV"
id = "abc123..."
```

Copy these IDs to `wrangler.toml`.

## Step 4: Build and Deploy

```bash
# Build static JSON
npm run build

# Upload to KV (replace with your namespace ID)
npx wrangler kv key put statuses "$(cat dist/statuses.json)" \
  --namespace-id=YOUR_KV_NAMESPACE_ID

# Deploy worker
npm run deploy
```

## Step 5: Test

Visit your worker URL:
```bash
curl https://your-worker.workers.dev/api/v1/instance
curl https://your-worker.workers.dev/api/v1/timelines/public
```

Or test in a Mastodon client:
- Web: `https://elk.zone/your-worker.workers.dev`
- Mobile: Enter your worker URL as the instance

## Step 6: Set up CI/CD (Optional)

Add these secrets to your GitHub repository:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `KV_NAMESPACE_ID`
- `KV_PREVIEW_NAMESPACE_ID`

Now every push to main will automatically deploy!

## Writing Toots

Create `.md` files in `toots/`:

```markdown
---
id: "unique-id-here"
created_at: "2025-01-15T10:00:00Z"
---

Your content here!
```

Then:
```bash
npm run build
npx wrangler kv key put statuses "$(cat dist/statuses.json)" --namespace-id=YOUR_ID
npm run deploy
```

## Getting Cloudflare Credentials

### API Token
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Edit Cloudflare Workers" template
4. Copy the token

### Account ID
1. Go to https://dash.cloudflare.com/
2. Select your account
3. Copy the Account ID from the right sidebar

## Troubleshooting

### Build fails
- Check that all toots have `id` and `created_at` fields
- Validate YAML frontmatter syntax
- Ensure `config.json` is valid JSON

### Deploy fails
- Verify KV namespace IDs in `wrangler.toml`
- Check that you've uploaded to KV before deploying
- Run `npx wrangler login` if auth fails

### Client can't connect
- Verify CORS headers are present (they should be)
- Check your worker URL is correct
- Try accessing `/api/v1/instance` directly

### KV upload fails
- Make sure namespace exists
- Use correct namespace ID (not preview ID for production)
- Check file path to `dist/statuses.json`

## Development Workflow

```bash
# 1. Write or edit toots
vim toots/004-new-post.md

# 2. Build
npm run build

# 3. Test locally (starts dev server)
npm run dev

# 4. Deploy to production
npx wrangler kv key put statuses "$(cat dist/statuses.json)" --namespace-id=YOUR_ID
npm run deploy
```

## Next Steps

- Customize your instance metadata
- Add more toots
- Set up custom domain
- Configure GitHub Actions for automatic deployment
- Share your instance with the Fediverse!
