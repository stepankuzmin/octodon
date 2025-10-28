---
date: 2025-01-20T14:45:00.000Z
visibility: public
language: en
---

## Why static Mastodon?

I wanted a simple way to publish thoughts that:

1. **Works with existing Mastodon clients** - no need to build a custom app
2. **Requires no database** - just markdown files in Git
3. **Deploys instantly** - push to GitHub, auto-deploy to Cloudflare
4. **Costs nothing** - Cloudflare's free tier is generous

The result is this: a tiny TypeScript implementation that serves Mastodon API endpoints from static JSON.

Pretty cool, right? 🚀
