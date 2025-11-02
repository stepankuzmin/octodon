import type { Account, Status } from './types';

interface Env {
  DATA: R2Bucket;
}

interface PostsData {
  account: Account;
  statuses: Status[];
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Add CORS headers for Mastodon clients
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json',
    };

    // Handle OPTIONS for CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route: POST /api/v1/apps (OAuth app registration for clients)
    // Returns mock credentials - no storage needed for read-only API
    if (request.method === 'POST' && url.pathname === '/api/v1/apps') {
      try {
        const body = await request.json() as any;
        const clientName = body.client_name || 'Unknown App';

        // Generate deterministic client_id from client_name
        const encoder = new TextEncoder();
        const data = encoder.encode(clientName);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const clientId = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
        const clientSecret = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(32, 64);

        const app = {
          id: clientId.slice(0, 16),
          name: clientName,
          website: body.website || null,
          redirect_uri: body.redirect_uris || 'urn:ietf:wg:oauth:2.0:oob',
          client_id: clientId,
          client_secret: clientSecret,
          vapid_key: '',
        };

        return new Response(JSON.stringify(app), { headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
          status: 400,
          headers: corsHeaders,
        });
      }
    }

    // Route: GET /oauth/authorize (OAuth authorization endpoint)
    // Auto-approve and redirect back with authorization code
    if (request.method === 'GET' && url.pathname === '/oauth/authorize') {
      const clientId = url.searchParams.get('client_id');
      const redirectUri = url.searchParams.get('redirect_uri');
      const responseType = url.searchParams.get('response_type');

      if (!clientId || !redirectUri || responseType !== 'code') {
        return new Response('Invalid OAuth request', { status: 400 });
      }

      try {
        // Generate deterministic authorization code from client_id
        const encoder = new TextEncoder();
        const data = encoder.encode(clientId + ':auth_code');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const authCode = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);

        // Redirect back to client with authorization code
        // Handle complex redirect URIs by manually appending the code parameter
        const separator = redirectUri.includes('?') ? '&' : '?';
        const redirectUrlWithCode = `${redirectUri}${separator}code=${authCode}`;

        return Response.redirect(redirectUrlWithCode, 302);
      } catch (error) {
        return new Response('Failed to process OAuth request', { status: 500 });
      }
    }

    // Route: POST /oauth/token (OAuth token exchange endpoint)
    // Exchange authorization code for access token
    if (request.method === 'POST' && url.pathname === '/oauth/token') {
      try {
        const body = await request.json() as any;
        const grantType = body.grant_type;
        const code = body.code;
        const clientId = body.client_id;

        if (grantType !== 'authorization_code' || !code || !clientId) {
          return new Response(JSON.stringify({ error: 'invalid_request' }), {
            status: 400,
            headers: corsHeaders,
          });
        }

        // Generate deterministic access token from client_id
        const encoder = new TextEncoder();
        const data = encoder.encode(clientId + ':access_token');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const accessToken = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const tokenResponse = {
          access_token: accessToken,
          token_type: 'Bearer',
          scope: 'read write follow push',
          created_at: Math.floor(Date.now() / 1000),
        };

        return new Response(JSON.stringify(tokenResponse), { headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'invalid_request' }), {
          status: 400,
          headers: corsHeaders,
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
          headers: corsHeaders,
        });
      }
      data = await object.json() as PostsData;
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to load data' }), {
        status: 500,
        headers: corsHeaders,
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
      return new Response(JSON.stringify(statuses), { headers: corsHeaders });
    }

    // Route: GET /api/v1/statuses/:id
    if (url.pathname.startsWith('/api/v1/statuses/')) {
      const id = url.pathname.split('/').pop();
      const status = data.statuses.find((s: any) => s.id === id);
      if (!status) {
        return new Response(JSON.stringify({ error: 'Record not found' }), {
          status: 404,
          headers: corsHeaders,
        });
      }
      return new Response(JSON.stringify(status), { headers: corsHeaders });
    }

    // Route: GET /api/v1/instance
    if (url.pathname === '/api/v1/instance') {
      const instance = {
        uri: url.hostname,
        title: 'Octodon',
        short_description: 'A static Mastodon instance powered by markdown',
        description: 'A static Mastodon instance powered by markdown files and Cloudflare Workers',
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
      return new Response(JSON.stringify(instance), { headers: corsHeaders });
    }

    // Route: GET /api/v1/accounts/verify_credentials
    // Returns the authenticated user's account (always returns the single account)
    // MUST come before /api/v1/accounts/:id to avoid matching "verify_credentials" as an ID
    if (url.pathname === '/api/v1/accounts/verify_credentials') {
      return new Response(JSON.stringify(data.account), { headers: corsHeaders });
    }

    // Route: GET /api/v1/accounts/:id
    if (url.pathname.startsWith('/api/v1/accounts/')) {
      const id = url.pathname.split('/').pop();
      if (id === '1' || id === data.account.id) {
        return new Response(JSON.stringify(data.account), { headers: corsHeaders });
      }
      return new Response(JSON.stringify({ error: 'Record not found' }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Route: GET /api/v1/preferences
    // Returns user preferences (minimal defaults for read-only)
    if (url.pathname === '/api/v1/preferences') {
      const preferences = {
        'posting:default:visibility': 'public',
        'posting:default:sensitive': false,
        'posting:default:language': 'en',
        'reading:expand:media': 'default',
        'reading:expand:spoilers': false,
      };
      return new Response(JSON.stringify(preferences), { headers: corsHeaders });
    }

    // Route: GET /api/v1/timelines/home
    // For static instance, home timeline = public timeline (no following)
    if (url.pathname === '/api/v1/timelines/home') {
      const limit = Math.min(
        parseInt(url.searchParams.get('limit') || '20'),
        40
      );
      const statuses = data.statuses.slice(0, limit);
      return new Response(JSON.stringify(statuses), { headers: corsHeaders });
    }

    // 404 for everything else
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: corsHeaders,
    });
  },
};
