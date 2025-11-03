import type { Account, Status } from './types';

interface Env {
  DATA: R2Bucket;
}

interface PostsData {
  account: Account;
  statuses: Status[];
}

/**
 * PUBLIC READ-ONLY OAUTH MODEL
 *
 * This instance uses PUBLIC OAuth credentials for API compatibility.
 * Everyone uses the same credentials - no user authentication exists.
 *
 * Public credentials (documented and intentionally public):
 *   client_id: octodon_public_readonly
 *   client_secret: octodon_public_readonly
 *   access_token: octodon_public_readonly_token
 *
 * These credentials provide read-only access to public data.
 * Tokens are never validated - all requests treated equally.
 *
 * Unauthenticated access also works for public endpoints.
 * OAuth exists only because Mastodon clients require the flow.
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

    // OAuth: App registration (public credentials, same for everyone)
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

    // OAuth: Authorization (auto-approve, everyone gets same code)
    if (request.method === 'GET' && url.pathname === '/oauth/authorize') {
      const redirectUri = url.searchParams.get('redirect_uri');
      if (!redirectUri) return new Response('Bad Request', { status: 400 });

      const separator = redirectUri.includes('?') ? '&' : '?';
      return Response.redirect(`${redirectUri}${separator}code=octodon_public_readonly_code`, 302);
    }

    // OAuth: Token exchange (public token, same for everyone, never validated)
    if (request.method === 'POST' && url.pathname === '/oauth/token') {
      const body = await request.json() as any;
      if (body.grant_type !== 'authorization_code') {
        return new Response(JSON.stringify({ error: 'invalid_request' }), {
          status: 400,
          headers: CORS_HEADERS,
        });
      }

      return new Response(JSON.stringify({
        access_token: 'octodon_public_readonly_token',
        token_type: 'Bearer',
        scope: 'read write follow push',
        created_at: Math.floor(Date.now() / 1000),
      }), { headers: CORS_HEADERS });
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
      };
      return new Response(JSON.stringify(instance), { headers: CORS_HEADERS });
    }

    // Route: GET /api/v1/accounts/verify_credentials
    // Returns the authenticated user's account (always returns the single account)
    // MUST come before /api/v1/accounts/:id to avoid matching "verify_credentials" as an ID
    if (url.pathname === '/api/v1/accounts/verify_credentials') {
      return new Response(JSON.stringify(data.account), { headers: CORS_HEADERS });
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
