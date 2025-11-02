# Deployment Guide

This guide walks you through deploying Octodon to Cloudflare Workers and R2.

## Prerequisites

1. A Cloudflare account (free tier works fine)
2. Node.js 20+ installed
3. Git repository (for GitHub Actions, optional)

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Authenticate with Cloudflare

```bash
npx wrangler login
```

This will open a browser window to authorize Wrangler CLI.

## Step 3: Create R2 Bucket

```bash
npx wrangler r2 bucket create octodon-data
```

## Step 4: Customize Your Instance

### Edit `account.json`

Update with your information:
- `username`, `display_name`, `note` (bio)
- `avatar` (profile image URL)
- `header` (banner image URL)
- `url` (will be your worker URL)

### Edit `wrangler.toml`

Update the `name` field if you want a different worker name:

```toml
name = "octodon"  # Your worker will be at: https://octodon.YOUR_USERNAME.workers.dev
```

### Create Posts

Add markdown files to `posts/` directory:

```bash
# Example
echo "---
date: $(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
---

My first post!" > posts/$(date +"%Y-%m-%d")-first-post.md
```

## Step 5: Build

```bash
npm run build
```

This creates `dist/posts.json`.

## Step 6: Upload to R2

```bash
npx wrangler r2 object put octodon-data/posts.json --file=dist/posts.json --remote
```

## Step 7: Deploy Worker

```bash
npm run deploy
```

Wrangler will output your worker URL, e.g., `https://octodon.YOUR_USERNAME.workers.dev`

## Step 8: Test

```bash
# Get public timeline
curl https://octodon.YOUR_USERNAME.workers.dev/api/v1/timelines/public

# Get instance info
curl https://octodon.YOUR_USERNAME.workers.dev/api/v1/instance
```

## Step 9: Connect with Mastodon Client (Optional)

Some Mastodon clients support adding custom instances:

1. Open your Mastodon client (e.g., Ivory, Elk, Phanpy)
2. Add a new instance
3. Enter your worker URL: `octodon.YOUR_USERNAME.workers.dev`
4. Browse your timeline!

Note: Authentication won't work (read-only), but you can browse posts.

## GitHub Actions (Automated Deployment)

To enable automatic deployment on push:

### 1. Get Cloudflare API Token

1. Go to Cloudflare Dashboard → My Profile → API Tokens
2. Create Token → Use template "Edit Cloudflare Workers"
3. Copy the token

### 2. Get Account ID

```bash
npx wrangler whoami
```

Or find it in your Cloudflare Dashboard URL.

### 3. Add GitHub Secrets

Go to your repo → Settings → Secrets and variables → Actions → New repository secret

Add two secrets:
- `CLOUDFLARE_API_TOKEN` - Your API token
- `CLOUDFLARE_ACCOUNT_ID` - Your account ID

### 4. Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

GitHub Actions will automatically build and deploy on every push to `main`.

## Updating Content

### Manual Deploy

1. Edit markdown files in `posts/`
2. Run `npm run build`
3. Upload to R2: `npx wrangler r2 object put octodon-data/posts.json --file=dist/posts.json --remote`
4. Done! (Worker automatically fetches new data)

### With GitHub Actions

1. Edit markdown files in `posts/`
2. Commit and push to `main`
3. GitHub Actions handles the rest

## Troubleshooting

### Worker returns 500 error

Check if `posts.json` exists in R2:

```bash
npx wrangler r2 object get octodon-data/posts.json --file=test.json --remote
cat test.json
```

### Build fails

Check that:
- All markdown files have valid frontmatter
- Dates are in ISO 8601 format
- `account.json` is valid JSON

### CORS errors

CORS headers are included in the worker. If you still see errors, check browser console for details.

## Cost

With Cloudflare's free tier:
- Workers: 100,000 requests/day
- R2: 10 GB storage, 1M reads/month

This should be more than enough for a personal blog.

## Next Steps

- Add more posts
- Customize your profile
- Share your instance URL
- Consider adding pagination if you have 100+ posts
