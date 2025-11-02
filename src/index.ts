/**
 * Octodon - A tiny Mastodon API implementation
 * Serves static content from markdown files via Cloudflare Workers
 */

import type { Env, Status, StatusIndex, Account, Instance } from './types';

// Import generated data (will be created by build script)
import statusIndex from '../dist/index.json';
import account from '../dist/account.json';
import instance from '../dist/instance.json';

/**
 * CORS headers for all responses
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/**
 * Create a JSON response with CORS headers
 */
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
    },
  });
}

/**
 * Handle CORS preflight requests
 */
function handleOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * GET /api/v1/instance
 * Returns instance information
 */
function handleInstance(): Response {
  return jsonResponse(instance);
}

/**
 * GET /api/v1/accounts/:id
 * Returns account information
 */
function handleAccount(id: string): Response {
  // We only have one account in this implementation
  if (id !== (account as Account).id) {
    return jsonResponse({ error: 'Account not found' }, 404);
  }

  return jsonResponse(account);
}

/**
 * GET /api/v1/accounts/:id/statuses
 * Returns statuses for an account
 */
function handleAccountStatuses(id: string, searchParams: URLSearchParams): Response {
  // We only have one account in this implementation
  if (id !== (account as Account).id) {
    return jsonResponse({ error: 'Account not found' }, 404);
  }

  // Parse pagination parameters
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 40);
  const maxId = searchParams.get('max_id');
  const sinceId = searchParams.get('since_id');
  const minId = searchParams.get('min_id');

  let statuses = statusIndex as StatusIndex[];

  // Apply pagination filters
  if (maxId) {
    const maxIdIndex = statuses.findIndex(s => s.id === maxId);
    if (maxIdIndex !== -1) {
      statuses = statuses.slice(maxIdIndex + 1);
    }
  }

  if (sinceId) {
    const sinceIdIndex = statuses.findIndex(s => s.id === sinceId);
    if (sinceIdIndex !== -1) {
      statuses = statuses.slice(0, sinceIdIndex);
    }
  }

  if (minId) {
    const minIdIndex = statuses.findIndex(s => s.id === minId);
    if (minIdIndex !== -1) {
      statuses = statuses.slice(0, minIdIndex).reverse();
    }
  }

  // Apply limit
  statuses = statuses.slice(0, limit);

  return jsonResponse(statuses);
}

/**
 * GET /api/v1/timelines/public
 * Returns public timeline (same as account statuses for single-user instance)
 */
function handlePublicTimeline(searchParams: URLSearchParams): Response {
  return handleAccountStatuses((account as Account).id, searchParams);
}

/**
 * GET /api/v1/statuses/:id
 * Returns a single status by ID
 */
async function handleStatus(id: string, env: Env): Promise<Response> {
  try {
    // Fetch full status from Workers KV
    const statusesJson = await env.STATUSES_KV.get('statuses');

    if (!statusesJson) {
      return jsonResponse({ error: 'Statuses not found in KV store' }, 500);
    }

    const statuses: Record<string, Status> = JSON.parse(statusesJson);
    const status = statuses[id];

    if (!status) {
      return jsonResponse({ error: 'Status not found' }, 404);
    }

    return jsonResponse(status);
  } catch (error) {
    console.error('Error fetching status:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

/**
 * Handle routing for all requests
 */
async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { pathname, searchParams } = url;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return handleOptions();
  }

  // Only allow GET requests
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // Route API requests
  // GET /api/v1/instance
  if (pathname === '/api/v1/instance') {
    return handleInstance();
  }

  // GET /api/v1/accounts/:id
  const accountMatch = pathname.match(/^\/api\/v1\/accounts\/([^/]+)$/);
  if (accountMatch) {
    return handleAccount(accountMatch[1]);
  }

  // GET /api/v1/accounts/:id/statuses
  const accountStatusesMatch = pathname.match(/^\/api\/v1\/accounts\/([^/]+)\/statuses$/);
  if (accountStatusesMatch) {
    return handleAccountStatuses(accountStatusesMatch[1], searchParams);
  }

  // GET /api/v1/timelines/public
  if (pathname === '/api/v1/timelines/public') {
    return handlePublicTimeline(searchParams);
  }

  // GET /api/v1/statuses/:id
  const statusMatch = pathname.match(/^\/api\/v1\/statuses\/([^/]+)$/);
  if (statusMatch) {
    return await handleStatus(statusMatch[1], env);
  }

  // Root endpoint - return basic info
  if (pathname === '/' || pathname === '') {
    return jsonResponse({
      name: 'Octodon',
      version: (instance as Instance).version,
      description: 'A tiny Mastodon API implementation using Markdown files',
      endpoints: [
        'GET /api/v1/instance',
        'GET /api/v1/accounts/:id',
        'GET /api/v1/accounts/:id/statuses',
        'GET /api/v1/timelines/public',
        'GET /api/v1/statuses/:id',
      ],
    });
  }

  // 404 for all other routes
  return jsonResponse({ error: 'Not found' }, 404);
}

/**
 * Cloudflare Workers entry point
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error('Unhandled error:', error);
      return jsonResponse(
        {
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  },
};
