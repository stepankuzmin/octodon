interface Env {
  DATA: R2Bucket;
}

interface PostsData {
  account: unknown;
  statuses: unknown[];
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Add CORS headers for Mastodon clients
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };

    // Handle OPTIONS for CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
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

    // 404 for everything else
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: corsHeaders,
    });
  },
};
