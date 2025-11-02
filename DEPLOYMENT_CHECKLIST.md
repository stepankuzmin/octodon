# Deployment Checklist

Use this checklist to deploy your Octodon instance.

## Prerequisites

- [ ] Node.js 20+ installed
- [ ] Cloudflare account created (free tier works)
- [ ] Git repository created (for your toots)
- [ ] GitHub account (for CI/CD, optional)

## Local Setup

- [ ] Clone/download the project
- [ ] Run `npm install`
- [ ] Verify installation: `npm run build`

## Configuration

### 1. Instance Configuration

- [ ] Edit `config.json`
- [ ] Set `instance.domain` to your worker URL
- [ ] Set `instance.title` and `instance.description`
- [ ] Set `instance.sourceUrl` to your repository URL
- [ ] Update `instance.email` for contact info

### 2. Account Configuration

- [ ] Set `account.username`
- [ ] Set `account.display_name`
- [ ] Set `account.note` (your bio, can include HTML)
- [ ] Upload avatar image somewhere and set `account.avatar` URL
- [ ] Upload header image somewhere and set `account.header` URL
- [ ] Set `account.url` to match your worker URL

### 3. Cloudflare Setup

- [ ] Log in to Cloudflare: `npx wrangler login`
- [ ] Create production KV namespace:
  ```bash
  npx wrangler kv namespace create STATUSES_KV
  ```
- [ ] Create preview KV namespace:
  ```bash
  npx wrangler kv namespace create STATUSES_KV --preview
  ```
- [ ] Copy namespace IDs to `wrangler.toml`:
  ```toml
  [[kv_namespaces]]
  binding = "STATUSES_KV"
  id = "YOUR_PRODUCTION_ID"
  preview_id = "YOUR_PREVIEW_ID"
  ```

## Content Creation

- [ ] Write your first toot in `toots/001-first-toot.md`
- [ ] Ensure it has required frontmatter:
  - `id`: Unique identifier (string)
  - `created_at`: ISO 8601 timestamp
- [ ] Run `npm run build` to test parsing
- [ ] Verify output in `dist/` directory

## First Deployment

- [ ] Build: `npm run build`
- [ ] Check build output for errors
- [ ] Upload to KV:
  ```bash
  npx wrangler kv key put statuses "$(cat dist/statuses.json)" \
    --namespace-id=YOUR_PRODUCTION_ID
  ```
- [ ] Deploy worker: `npm run deploy`
- [ ] Note the worker URL from deployment output

## Testing

- [ ] Update `config.json` with actual worker URL
- [ ] Rebuild: `npm run build`
- [ ] Re-upload to KV (use same command as before)
- [ ] Redeploy: `npm run deploy`
- [ ] Test endpoints:
  ```bash
  curl https://your-worker.workers.dev/api/v1/instance
  curl https://your-worker.workers.dev/api/v1/timelines/public
  curl https://your-worker.workers.dev/api/v1/statuses/YOUR_FIRST_ID
  ```
- [ ] Verify JSON responses look correct

## Mastodon Client Testing

- [ ] Try in web client: `https://elk.zone/your-worker.workers.dev`
- [ ] Or Phanpy: `https://phanpy.social/#/your-worker.workers.dev`
- [ ] Or mobile app (enter your worker URL as instance)
- [ ] Verify timeline appears
- [ ] Verify individual toots open
- [ ] Verify account profile displays

## CI/CD Setup (Optional but Recommended)

### GitHub Secrets

- [ ] Go to your repository → Settings → Secrets and variables → Actions
- [ ] Add `CLOUDFLARE_API_TOKEN`:
  - Get from: https://dash.cloudflare.com/profile/api-tokens
  - Use "Edit Cloudflare Workers" template
- [ ] Add `CLOUDFLARE_ACCOUNT_ID`:
  - Get from: https://dash.cloudflare.com/ (right sidebar)
- [ ] Add `KV_NAMESPACE_ID` (production ID)
- [ ] Add `KV_PREVIEW_NAMESPACE_ID` (preview ID)

### Test CI/CD

- [ ] Make a small change to a toot
- [ ] Commit and push to `main` branch
- [ ] Go to Actions tab in GitHub
- [ ] Verify workflow runs successfully
- [ ] Check your worker URL to see the update

## Custom Domain (Optional)

- [ ] Add custom domain in Cloudflare dashboard
- [ ] Update `config.json` with custom domain
- [ ] Rebuild and redeploy
- [ ] Test with custom domain

## Post-Deployment

- [ ] Share your instance URL!
- [ ] Write more toots
- [ ] Monitor worker analytics in Cloudflare dashboard
- [ ] Check for errors in worker logs if needed

## Maintenance

### Adding New Toots

- [ ] Create new `.md` file in `toots/`
- [ ] Use unique ID and current timestamp
- [ ] Commit to repository
- [ ] If using CI/CD: Push and it auto-deploys
- [ ] If manual: `npm run build` → upload to KV → deploy

### Updating Existing Toots

- [ ] Edit the markdown file
- [ ] Follow same deployment process
- [ ] Note: Mastodon clients may cache old versions

### Updating Configuration

- [ ] Edit `config.json`
- [ ] Rebuild and redeploy
- [ ] Instance metadata updates immediately

## Troubleshooting

If something doesn't work:

- [ ] Check build output for errors
- [ ] Verify KV namespace IDs in `wrangler.toml`
- [ ] Ensure statuses were uploaded to KV
- [ ] Check worker logs: `npx wrangler tail`
- [ ] Verify CORS headers in responses
- [ ] Test API endpoints with curl first
- [ ] Check GitHub Actions logs if using CI/CD

## Common Issues

**"Status not found in KV store"**
- [ ] Did you upload `statuses.json` to KV?
- [ ] Are you using the correct namespace ID?

**"Account not found"**
- [ ] Check account ID in `config.json` matches
- [ ] Default is "1", verify in requests

**Worker won't deploy**
- [ ] Run `npx wrangler login` again
- [ ] Check account ID in `wrangler.toml`
- [ ] Verify namespace IDs are correct

**Build fails**
- [ ] Check all toots have `id` and `created_at`
- [ ] Validate YAML frontmatter syntax
- [ ] Ensure `config.json` is valid JSON

## Success Indicators

You know it's working when:

- ✅ Build completes without errors
- ✅ Deploy shows success message
- ✅ `/api/v1/instance` returns your instance info
- ✅ `/api/v1/timelines/public` returns your toots
- ✅ Mastodon clients can load your timeline
- ✅ Individual toots open correctly
- ✅ CI/CD deploys automatically on push

## Next Steps

- [ ] Star the repository!
- [ ] Share your instance URL
- [ ] Write more toots
- [ ] Customize styling (if using web client)
- [ ] Consider adding more API endpoints
- [ ] Join the Fediverse community

---

**Need help?** Check README.md and SETUP.md for detailed documentation.

**Found a bug?** Open an issue on GitHub.

**Want to contribute?** Pull requests welcome!
