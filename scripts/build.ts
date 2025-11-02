#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { marked } from 'marked';
import type {
  Status,
  StatusIndex,
  Account,
  Instance,
  Config,
  TootFrontmatter
} from '../src/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const tootsDir = path.join(rootDir, 'toots');
const distDir = path.join(rootDir, 'dist');
const configPath = path.join(rootDir, 'config.json');

interface ParsedToot {
  frontmatter: TootFrontmatter;
  content: string;
  html: string;
}

/**
 * Read and parse all markdown files from toots directory
 */
function parseToots(): ParsedToot[] {
  if (!fs.existsSync(tootsDir)) {
    console.error(`Error: toots directory not found at ${tootsDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(tootsDir)
    .filter(file => file.endsWith('.md'))
    .sort();

  console.log(`Found ${files.length} markdown files`);

  const toots: ParsedToot[] = [];

  for (const file of files) {
    const filePath = path.join(tootsDir, file);
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    // Parse frontmatter
    const { data, content } = matter(fileContent);

    // Validate required fields
    if (!data.id) {
      console.error(`Error: Missing 'id' in frontmatter for ${file}`);
      process.exit(1);
    }

    if (!data.created_at) {
      console.error(`Error: Missing 'created_at' in frontmatter for ${file}`);
      process.exit(1);
    }

    // Convert markdown to HTML
    const html = marked.parse(content.trim(), {
      async: false,
      breaks: true,
      gfm: true
    }) as string;

    toots.push({
      frontmatter: data as TootFrontmatter,
      content: content.trim(),
      html: html.trim()
    });
  }

  return toots;
}

/**
 * Load configuration from config.json
 */
function loadConfig(): Config {
  if (!fs.existsSync(configPath)) {
    console.error(`Error: config.json not found at ${configPath}`);
    process.exit(1);
  }

  const configContent = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(configContent);
}

/**
 * Transform parsed toots into Mastodon Status entities
 */
function transformToStatuses(toots: ParsedToot[], account: Account, domain: string): Status[] {
  return toots.map(toot => {
    const { frontmatter, html, content } = toot;

    const status: Status = {
      id: frontmatter.id,
      uri: `https://${domain}/statuses/${frontmatter.id}`,
      created_at: new Date(frontmatter.created_at).toISOString(),
      account,
      content: html,
      visibility: frontmatter.visibility || 'public',
      sensitive: frontmatter.sensitive || false,
      spoiler_text: frontmatter.spoiler_text || '',
      media_attachments: [],
      mentions: [],
      tags: [],
      reblogs_count: frontmatter.reblogs_count || 0,
      favourites_count: frontmatter.favourites_count || 0,
      replies_count: frontmatter.replies_count || 0,
      url: `https://${domain}/@${account.username}/${frontmatter.id}`,
      in_reply_to_id: frontmatter.in_reply_to_id || null,
      in_reply_to_account_id: frontmatter.in_reply_to_account_id || null,
      reblog: null,
      language: frontmatter.language || null,
      text: content
    };

    return status;
  });
}

/**
 * Create minimal status index for embedding in worker
 */
function createStatusIndex(statuses: Status[]): StatusIndex[] {
  return statuses.map(status => ({
    id: status.id,
    created_at: status.created_at,
    account: {
      id: status.account.id
    },
    replies_count: status.replies_count,
    reblogs_count: status.reblogs_count,
    favourites_count: status.favourites_count,
    uri: status.uri,
    url: status.url
  }));
}

/**
 * Transform config to Account entity
 */
function createAccount(config: Config): Account {
  const { account } = config;

  return {
    id: account.id,
    username: account.username,
    acct: account.acct,
    display_name: account.display_name,
    locked: account.locked || false,
    bot: account.bot || false,
    created_at: new Date(account.created_at).toISOString(),
    note: account.note,
    url: account.url,
    avatar: account.avatar,
    avatar_static: account.avatar,
    header: account.header,
    header_static: account.header,
    followers_count: 0,
    following_count: 0,
    statuses_count: 0 // Will be updated
  };
}

/**
 * Transform config to Instance entity
 */
function createInstance(config: Config): Instance {
  const { instance } = config;

  return {
    domain: instance.domain,
    title: instance.title,
    version: instance.version,
    source_url: instance.sourceUrl,
    description: instance.description,
    usage: {
      users: {
        active_month: 1
      }
    },
    thumbnail: {
      url: instance.thumbnail || ''
    },
    languages: instance.languages,
    configuration: {
      statuses: {
        max_characters: 500,
        max_media_attachments: 4
      },
      media_attachments: {
        supported_mime_types: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        image_size_limit: 10485760,
        video_size_limit: 41943040
      }
    },
    registrations: {
      enabled: false
    },
    contact: {
      email: instance.email || ''
    }
  };
}

/**
 * Main build function
 */
async function build() {
  console.log('🚀 Starting build process...\n');

  // Load config
  console.log('📝 Loading configuration...');
  const config = loadConfig();
  console.log(`   Domain: ${config.instance.domain}`);
  console.log(`   Account: @${config.account.username}\n`);

  // Parse markdown files
  console.log('📖 Parsing markdown files...');
  const toots = parseToots();
  console.log(`   Parsed ${toots.length} toots\n`);

  // Create account
  const account = createAccount(config);
  account.statuses_count = toots.length;

  // Transform to Mastodon entities
  console.log('🔄 Transforming to Mastodon entities...');
  const statuses = transformToStatuses(toots, account, config.instance.domain);

  // Sort by created_at descending (newest first)
  statuses.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  console.log(`   Created ${statuses.length} status objects\n`);

  // Create index
  const statusIndex = createStatusIndex(statuses);

  // Create instance
  const instance = createInstance(config);

  // Create dist directory
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Convert statuses array to object keyed by ID for KV storage
  const statusesById: Record<string, Status> = {};
  for (const status of statuses) {
    statusesById[status.id] = status;
  }

  // Write output files
  console.log('💾 Writing output files...');

  fs.writeFileSync(
    path.join(distDir, 'statuses.json'),
    JSON.stringify(statusesById, null, 2)
  );
  console.log('   ✓ statuses.json (for Workers KV)');

  fs.writeFileSync(
    path.join(distDir, 'index.json'),
    JSON.stringify(statusIndex, null, 2)
  );
  console.log('   ✓ index.json (embed in worker)');

  fs.writeFileSync(
    path.join(distDir, 'account.json'),
    JSON.stringify(account, null, 2)
  );
  console.log('   ✓ account.json (embed in worker)');

  fs.writeFileSync(
    path.join(distDir, 'instance.json'),
    JSON.stringify(instance, null, 2)
  );
  console.log('   ✓ instance.json (embed in worker)');

  // Calculate sizes
  const statusesSize = JSON.stringify(statusesById).length;
  const indexSize = JSON.stringify(statusIndex).length;
  const accountSize = JSON.stringify(account).length;
  const instanceSize = JSON.stringify(instance).length;
  const totalEmbedSize = indexSize + accountSize + instanceSize;

  console.log('\n📊 Build statistics:');
  console.log(`   Statuses (KV): ${(statusesSize / 1024).toFixed(2)} KB`);
  console.log(`   Index: ${(indexSize / 1024).toFixed(2)} KB`);
  console.log(`   Account: ${(accountSize / 1024).toFixed(2)} KB`);
  console.log(`   Instance: ${(instanceSize / 1024).toFixed(2)} KB`);
  console.log(`   Total embedded: ${(totalEmbedSize / 1024).toFixed(2)} KB`);

  if (totalEmbedSize > 1024 * 1024) {
    console.warn('\n⚠️  Warning: Total embedded size exceeds 1 MB!');
  }

  console.log('\n✅ Build completed successfully!');
}

// Run build
build().catch(error => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});
