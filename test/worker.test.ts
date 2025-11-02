import { describe, it } from 'node:test';
import assert from 'node:assert';

const mockPostsData = {
  account: {
    id: '1',
    username: 'test',
    acct: 'test',
    display_name: 'Test User',
    locked: false,
    bot: false,
    discoverable: true,
    group: false,
    created_at: '2025-01-01T00:00:00.000Z',
    note: '<p>Test bio</p>',
    url: 'https://example.com/@test',
    avatar: 'https://example.com/avatar.jpg',
    avatar_static: 'https://example.com/avatar.jpg',
    followers_count: 0,
    following_count: 0,
    statuses_count: 2,
    last_status_at: '2025-01-25T09:15:00.000Z',
    emojis: [],
    fields: [],
  },
  statuses: [
    {
      id: '1737796500000',
      created_at: '2025-01-25T09:15:00.000Z',
      content: '<p>Post 1</p>',
      account: {} as any,
    },
    {
      id: '1737384300000',
      created_at: '2025-01-20T14:45:00.000Z',
      content: '<p>Post 2</p>',
      account: {} as any,
    },
  ],
};

const createMockEnv = () => ({
  DATA: {
    get: async () => ({
      json: async () => mockPostsData,
    }),
  },
});

const createRequest = (url: string, options?: RequestInit) => {
  return new Request(`https://test.workers.dev${url}`, options);
};

const importWorker = async () => {
  const module = await import('../src/worker.ts');
  return module.default;
};

describe('CORS', () => {
  it('handles OPTIONS preflight', async () => {
    const worker = await importWorker();
    const request = createRequest('/api/v1/timelines/public', { method: 'OPTIONS' });
    const response = await worker.fetch(request, createMockEnv());

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.strictEqual(response.headers.get('Access-Control-Allow-Methods'), 'GET, POST, OPTIONS');
    assert.strictEqual(response.headers.get('Access-Control-Allow-Headers'), 'Content-Type, Authorization');
  });
});

describe('OAuth Endpoints', () => {
  it('POST /api/v1/apps registers app', async () => {
    const worker = await importWorker();
    const request = createRequest('/api/v1/apps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'TestApp',
        redirect_uris: 'https://example.com/callback',
        scopes: 'read',
      }),
    });
    const response = await worker.fetch(request, createMockEnv());
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.name, 'TestApp');
    assert.ok(data.client_id);
    assert.ok(data.client_secret);
    assert.strictEqual(data.redirect_uri, 'https://example.com/callback');
  });

  it('POST /api/v1/apps returns same credentials for same client', async () => {
    const worker = await importWorker();
    const body = JSON.stringify({ client_name: 'TestApp', redirect_uris: 'https://example.com' });

    const request1 = createRequest('/api/v1/apps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const response1 = await worker.fetch(request1, createMockEnv());
    const data1 = await response1.json();

    const request2 = createRequest('/api/v1/apps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const response2 = await worker.fetch(request2, createMockEnv());
    const data2 = await response2.json();

    assert.strictEqual(data1.client_id, data2.client_id);
    assert.strictEqual(data1.client_secret, data2.client_secret);
  });

  it('GET /oauth/authorize redirects with code', async () => {
    const worker = await importWorker();
    const request = createRequest(
      '/oauth/authorize?client_id=test123&redirect_uri=https://example.com/callback&response_type=code'
    );
    const response = await worker.fetch(request, createMockEnv());

    assert.strictEqual(response.status, 302);
    const location = response.headers.get('Location');
    assert.ok(location);
    assert.ok(location.startsWith('https://example.com/callback?code='));
  });

  it('GET /oauth/authorize handles complex redirect URIs', async () => {
    const worker = await importWorker();
    const redirectUri = 'https://elk.zone/api/server.com/oauth/https://elk.zone';
    const request = createRequest(
      `/oauth/authorize?client_id=test&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`
    );
    const response = await worker.fetch(request, createMockEnv());

    assert.strictEqual(response.status, 302);
    const location = response.headers.get('Location');
    assert.ok(location?.startsWith(redirectUri));
  });

  it('GET /oauth/authorize returns 400 for invalid requests', async () => {
    const worker = await importWorker();
    const request = createRequest('/oauth/authorize?client_id=test');
    const response = await worker.fetch(request, createMockEnv());

    assert.strictEqual(response.status, 400);
  });

  it('POST /oauth/token exchanges code for token', async () => {
    const worker = await importWorker();
    const request = createRequest('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: 'test_code',
        client_id: 'test_client',
        redirect_uri: 'https://example.com',
      }),
    });
    const response = await worker.fetch(request, createMockEnv());
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.ok(data.access_token);
    assert.strictEqual(data.token_type, 'Bearer');
    assert.strictEqual(data.scope, 'read write follow push');
  });

  it('POST /oauth/token returns 400 for invalid grant type', async () => {
    const worker = await importWorker();
    const request = createRequest('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'invalid',
        code: 'test',
        client_id: 'test',
      }),
    });
    const response = await worker.fetch(request, createMockEnv());

    assert.strictEqual(response.status, 400);
  });
});

describe('Timeline Endpoints', () => {
  it('GET /api/v1/timelines/public returns statuses', async () => {
    const worker = await importWorker();
    const request = createRequest('/api/v1/timelines/public');
    const response = await worker.fetch(request, createMockEnv());
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(Array.isArray(data), true);
    assert.strictEqual(data.length, 2);
    assert.strictEqual(data[0].id, '1737796500000');
  });

  it('GET /api/v1/timelines/public respects limit parameter', async () => {
    const worker = await importWorker();
    const request = createRequest('/api/v1/timelines/public?limit=1');
    const response = await worker.fetch(request, createMockEnv());
    const data = await response.json();

    assert.strictEqual(data.length, 1);
  });

  it('GET /api/v1/timelines/public caps limit at 40', async () => {
    const worker = await importWorker();
    const request = createRequest('/api/v1/timelines/public?limit=100');
    const response = await worker.fetch(request, createMockEnv());
    const data = await response.json();

    assert.ok(data.length <= 40);
  });

  it('GET /api/v1/timelines/home returns statuses', async () => {
    const worker = await importWorker();
    const request = createRequest('/api/v1/timelines/home');
    const response = await worker.fetch(request, createMockEnv());
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(Array.isArray(data), true);
    assert.strictEqual(data.length, 2);
  });
});

describe('Status Endpoints', () => {
  it('GET /api/v1/statuses/:id returns status', async () => {
    const worker = await importWorker();
    const request = createRequest('/api/v1/statuses/1737796500000');
    const response = await worker.fetch(request, createMockEnv());
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.id, '1737796500000');
    assert.strictEqual(data.content, '<p>Post 1</p>');
  });

  it('GET /api/v1/statuses/:id returns 404 for unknown status', async () => {
    const worker = await importWorker();
    const request = createRequest('/api/v1/statuses/999999');
    const response = await worker.fetch(request, createMockEnv());
    const data = await response.json();

    assert.strictEqual(response.status, 404);
    assert.strictEqual(data.error, 'Record not found');
  });
});

describe('Instance Endpoints', () => {
  it('GET /api/v1/instance returns instance info', async () => {
    const worker = await importWorker();
    const request = createRequest('/api/v1/instance');
    const response = await worker.fetch(request, createMockEnv());
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.title, 'Octodon');
    assert.strictEqual(data.version, '4.2.0 (compatible)');
    assert.strictEqual(data.registrations, false);
    assert.strictEqual(data.stats.user_count, 1);
    assert.strictEqual(data.stats.status_count, 2);
  });
});

describe('Account Endpoints', () => {
  it('GET /api/v1/accounts/verify_credentials returns account', async () => {
    const worker = await importWorker();
    const request = createRequest('/api/v1/accounts/verify_credentials');
    const response = await worker.fetch(request, createMockEnv());
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.id, '1');
    assert.strictEqual(data.username, 'test');
  });

  it('GET /api/v1/accounts/:id returns account for id 1', async () => {
    const worker = await importWorker();
    const request = createRequest('/api/v1/accounts/1');
    const response = await worker.fetch(request, createMockEnv());
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.id, '1');
  });

  it('GET /api/v1/accounts/:id returns account for matching id', async () => {
    const worker = await importWorker();
    const request = createRequest('/api/v1/accounts/1');
    const response = await worker.fetch(request, createMockEnv());
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.username, 'test');
  });

  it('GET /api/v1/accounts/:id returns 404 for unknown account', async () => {
    const worker = await importWorker();
    const request = createRequest('/api/v1/accounts/999');
    const response = await worker.fetch(request, createMockEnv());
    const data = await response.json();

    assert.strictEqual(response.status, 404);
    assert.strictEqual(data.error, 'Record not found');
  });
});

describe('Preferences Endpoints', () => {
  it('GET /api/v1/preferences returns preferences', async () => {
    const worker = await importWorker();
    const request = createRequest('/api/v1/preferences');
    const response = await worker.fetch(request, createMockEnv());
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data['posting:default:visibility'], 'public');
    assert.strictEqual(data['posting:default:language'], 'en');
  });
});

describe('Error Handling', () => {
  it('returns 404 for unknown routes', async () => {
    const worker = await importWorker();
    const request = createRequest('/api/v1/unknown');
    const response = await worker.fetch(request, createMockEnv());
    const data = await response.json();

    assert.strictEqual(response.status, 404);
    assert.strictEqual(data.error, 'Not found');
  });

  it('returns 500 when R2 data not found', async () => {
    const worker = await importWorker();
    const request = createRequest('/api/v1/timelines/public');
    const env = {
      DATA: {
        get: async () => null,
      },
    };
    const response = await worker.fetch(request, env as any);
    const data = await response.json();

    assert.strictEqual(response.status, 500);
    assert.strictEqual(data.error, 'Data not found');
  });

  it('returns 500 when R2 json parsing fails', async () => {
    const worker = await importWorker();
    const request = createRequest('/api/v1/timelines/public');
    const env = {
      DATA: {
        get: async () => ({
          json: async () => {
            throw new Error('Parse error');
          },
        }),
      },
    };
    const response = await worker.fetch(request, env as any);
    const data = await response.json();

    assert.strictEqual(response.status, 500);
    assert.strictEqual(data.error, 'Failed to load data');
  });
});
