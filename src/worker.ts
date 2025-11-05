import type { Account, Status } from './types';
import { Octokit } from 'octokit';

interface Env {
  DATA: R2Bucket;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_REPO: string;
  OWNER_GITHUB_USERNAME: string;
}

interface PostsData {
  account: Account;
  statuses: Status[];
}

/**
 * GITHUB OAUTH BRIDGE FOR AUTHENTICATED POSTING
 *
 * Bridges Mastodon OAuth to GitHub OAuth for real authentication.
 *
 * Flow:
 * 1. Client initiates OAuth → Redirect to GitHub
 * 2. User authorizes GitHub → Validate owner
 * 3. Return GitHub token to client
 * 4. Client posts → Commit to GitHub as markdown
 *
 * Read access: Public, no auth needed
 * Write access: GitHub OAuth, owner only
 * Stateless: No database or KV storage
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
} as const;

const DEFAULT_PREFERENCES = {
  'posting:default:visibility': 'public',
  'posting:default:sensitive': false,
  'posting:default:language': 'en',
  'reading:expand:media': 'default',
  'reading:expand:spoilers': false,
} as const;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // OAuth: App registration (returns public credentials for compatibility)
    if (request.method === 'POST' && url.pathname === '/api/v1/apps') {
      const body = await request.json() as any;
      return new Response(JSON.stringify({
        id: '1',
        name: body.client_name || 'App',
        website: body.website || null,
        redirect_uri: body.redirect_uris || 'urn:ietf:wg:oauth:2.0:oob',
        client_id: 'octodon_public_readonly',
        client_secret: 'octodon_public_readonly',
        vapid_key: '',
      }), { headers: CORS_HEADERS });
    }

    // OAuth: Redirect to GitHub for authentication
    if (request.method === 'GET' && url.pathname === '/oauth/authorize') {
      const redirectUri = url.searchParams.get('redirect_uri');
      if (!redirectUri) return new Response('Bad Request', { status: 400 });

      const state = btoa(JSON.stringify({
        clientRedirect: redirectUri,
        ts: Date.now()
      }));

      const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(
        `${url.origin}/oauth/github/callback`
      )}&state=${encodeURIComponent(state)}&scope=repo`;

      return Response.redirect(githubAuthUrl, 302);
    }

    // OAuth: GitHub callback handler
    if (request.method === 'GET' && url.pathname === '/oauth/github/callback') {
      try {
        const code = url.searchParams.get('code');
        const encodedState = url.searchParams.get('state');
        if (!code || !encodedState) return new Response('Bad Request', { status: 400 });

        const state = JSON.parse(atob(encodedState));
        if (Date.now() - state.ts > 600000) {
          return new Response('State expired', { status: 400 });
        }

        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code,
          }),
        });

        const { access_token: githubToken } = await tokenResponse.json() as any;
        if (!githubToken) return new Response('GitHub auth failed', { status: 500 });

        const octokit = new Octokit({ auth: githubToken });
        const { data: user } = await octokit.rest.users.getAuthenticated();

        if (user.login !== env.OWNER_GITHUB_USERNAME) {
          return new Response('Unauthorized: Not the instance owner', { status: 403 });
        }

        const separator = state.clientRedirect.includes('?') ? '&' : '?';
        return Response.redirect(`${state.clientRedirect}${separator}code=${encodeURIComponent(githubToken)}`, 302);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Response(`OAuth error: ${message}`, { status: 500 });
      }
    }

    // OAuth: Token exchange (return GitHub token as-is)
    if (request.method === 'POST' && url.pathname === '/oauth/token') {
      const body = await request.json() as any;
      if (body.grant_type !== 'authorization_code' || !body.code) {
        return new Response(JSON.stringify({ error: 'invalid_request' }), {
          status: 400,
          headers: CORS_HEADERS,
        });
      }

      return new Response(JSON.stringify({
        access_token: body.code,
        token_type: 'Bearer',
        scope: 'read write follow push',
        created_at: Math.floor(Date.now() / 1000),
      }), { headers: CORS_HEADERS });
    }

    // POST: Create status (requires GitHub OAuth)
    if (request.method === 'POST' && url.pathname === '/api/v1/statuses') {
      try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: CORS_HEADERS,
          });
        }

        const githubToken = authHeader.slice(7);
        const octokit = new Octokit({ auth: githubToken });

        const { data: user } = await octokit.rest.users.getAuthenticated();
        if (user.login !== env.OWNER_GITHUB_USERNAME) {
          return new Response(JSON.stringify({ error: 'Forbidden: Not the instance owner' }), {
            status: 403,
            headers: CORS_HEADERS,
          });
        }

        const body = await request.json() as any;
        const content = body.status || '';
        const visibility = body.visibility || 'public';
        const sensitive = body.sensitive || false;

        const now = new Date();
        const filename = `${now.toISOString().split('T')[0]}-${Date.now()}.md`;
        const frontmatter = `---
date: ${now.toISOString()}
visibility: ${visibility}
sensitive: ${sensitive}
---

${content}`;

        const repo = env.GITHUB_REPO || 'octodon';
        await octokit.rest.repos.createOrUpdateFileContents({
          owner: env.OWNER_GITHUB_USERNAME,
          repo,
          path: `posts/${filename}`,
          message: `Add post via Elk`,
          content: btoa(frontmatter),
        });

        const status = {
          id: Date.now().toString(),
          created_at: now.toISOString(),
          content,
          visibility,
          sensitive,
        };

        return new Response(JSON.stringify(status), {
          status: 201,
          headers: CORS_HEADERS,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create status';
        return new Response(JSON.stringify({ error: message }), {
          status: 500,
          headers: CORS_HEADERS,
        });
      }
    }

    // Fetch data from R2
    let data: PostsData;
    try {
      const object = await env.DATA.get('posts.json');
      if (!object) {
        return new Response(JSON.stringify({ error: 'Data not found' }), {
          status: 500,
          headers: CORS_HEADERS,
        });
      }
      data = await object.json() as PostsData;
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to load data' }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }

    // Route: GET /api/v1/timelines/public
    if (url.pathname === '/api/v1/timelines/public') {
      // Get limit from query params (default 20, max 40)
      const limit = Math.min(
        parseInt(url.searchParams.get('limit') || '20'),
        40
      );
      const statuses = data.statuses.slice(0, limit);
      return new Response(JSON.stringify(statuses), { headers: CORS_HEADERS });
    }

    // Route: GET /api/v1/statuses/:id
    if (url.pathname.startsWith('/api/v1/statuses/')) {
      const id = url.pathname.split('/').pop();
      const status = data.statuses.find((s: any) => s.id === id);
      if (!status) {
        return new Response(JSON.stringify({ error: 'Record not found' }), {
          status: 404,
          headers: CORS_HEADERS,
        });
      }
      return new Response(JSON.stringify(status), { headers: CORS_HEADERS });
    }

    // Route: GET /api/v1/instance
    if (url.pathname === '/api/v1/instance') {
      const instance = {
        uri: url.hostname,
        title: 'Octodon',
        short_description: 'Public read-only Mastodon instance',
        description: 'Single-user static Mastodon instance powered by markdown files and Cloudflare Workers. All data is public and read-only. OAuth credentials are public and documented for API compatibility.',
        email: '',
        version: '4.2.0 (compatible)',
        languages: ['en'],
        registrations: false,
        approval_required: false,
        invites_enabled: false,
        urls: {
          streaming_api: '',
        },
        stats: {
          user_count: 1,
          status_count: data.statuses.length,
          domain_count: 1,
        },
        thumbnail: '',
        contact_account: data.account,
        configuration: {
          statuses: {
            max_characters: 500,
            max_media_attachments: 0,
            characters_reserved_per_url: 23,
          },
        },
      };
      return new Response(JSON.stringify(instance), { headers: CORS_HEADERS });
    }

    // Route: GET /api/v1/accounts/verify_credentials
    // MUST come before /api/v1/accounts/:id to avoid matching as an ID
    if (url.pathname === '/api/v1/accounts/verify_credentials') {
      return new Response(JSON.stringify(data.account), { headers: CORS_HEADERS });
    }

    // Route: GET /api/v1/accounts/lookup
    // MUST come before /api/v1/accounts/:id to avoid matching "lookup" as an ID
    if (url.pathname === '/api/v1/accounts/lookup') {
      const acct = url.searchParams.get('acct');
      if (acct === data.account.username || acct === data.account.acct) {
        return new Response(JSON.stringify(data.account), { headers: CORS_HEADERS });
      }
      return new Response(JSON.stringify({ error: 'Record not found' }), {
        status: 404,
        headers: CORS_HEADERS,
      });
    }

    // Route: GET /api/v1/accounts/:id/statuses
    if (url.pathname.match(/^\/api\/v1\/accounts\/[^/]+\/statuses$/)) {
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 40);
      const pinned = url.searchParams.get('pinned') === 'true';

      if (pinned) {
        return new Response(JSON.stringify([]), { headers: CORS_HEADERS });
      }

      const statuses = data.statuses.slice(0, limit);
      return new Response(JSON.stringify(statuses), { headers: CORS_HEADERS });
    }

    // Route: GET /api/v1/accounts/:id/relationships
    if (url.pathname.match(/^\/api\/v1\/accounts\/[^/]+\/relationships$/)) {
      return new Response(JSON.stringify([{
        id: data.account.id,
        following: false,
        followed_by: false,
        blocking: false,
        muting: false,
        requested: false,
        domain_blocking: false,
      }]), { headers: CORS_HEADERS });
    }

    // Route: GET /api/v1/accounts/:id
    if (url.pathname.startsWith('/api/v1/accounts/')) {
      const id = url.pathname.split('/').pop();
      if (id === '1' || id === data.account.id) {
        return new Response(JSON.stringify(data.account), { headers: CORS_HEADERS });
      }
      return new Response(JSON.stringify({ error: 'Record not found' }), {
        status: 404,
        headers: CORS_HEADERS,
      });
    }

    // Route: GET /api/v1/preferences
    if (url.pathname === '/api/v1/preferences') {
      return new Response(JSON.stringify(DEFAULT_PREFERENCES), { headers: CORS_HEADERS });
    }

    // Route: GET /api/v1/timelines/home
    // For static instance, home timeline = public timeline (no following)
    if (url.pathname === '/api/v1/timelines/home') {
      const limit = Math.min(
        parseInt(url.searchParams.get('limit') || '20'),
        40
      );
      const statuses = data.statuses.slice(0, limit);
      return new Response(JSON.stringify(statuses), { headers: CORS_HEADERS });
    }

    // 404 for everything else
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: CORS_HEADERS,
    });
  },
};
