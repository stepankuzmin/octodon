import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import type { Account, Status } from './types';

interface PostData {
  date?: string;
  visibility?: string;
  sensitive?: boolean;
  spoiler_text?: string;
  language?: string;
}

// Load account info
const account: Account = JSON.parse(readFileSync('account.json', 'utf-8'));

// Extract base URL from account.url (e.g., "https://octodon.stepan-kuzmin.workers.dev/@stepan")
// Remove the username part to get the base domain
const baseUrl = account.url.replace(`/@${account.username}`, '');

// Read all markdown files
const postsDir = 'posts';
const files = readdirSync(postsDir).filter((f: string) => f.endsWith('.md'));

const statuses: Status[] = [];

for (const filename of files) {
  const filepath = join(postsDir, filename);
  const fileContent = readFileSync(filepath, 'utf-8');

  // Parse frontmatter
  const { data, content } = matter(fileContent);
  const postData = data as PostData;

  // Extract date from frontmatter or filename (YYYY-MM-DD format)
  const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
  const dateStr = postData.date || (dateMatch ? `${dateMatch[1]}T12:00:00.000Z` : new Date().toISOString());
  const date = new Date(dateStr);

  // Generate ID from timestamp (sortable)
  const id = date.getTime().toString();

  // Convert markdown to HTML
  const html = await marked(content.trim());

  // Create minimal Status object
  const status: Status = {
    id,
    created_at: date.toISOString(),
    in_reply_to_id: null,
    in_reply_to_account_id: null,
    sensitive: postData.sensitive || false,
    spoiler_text: postData.spoiler_text || '',
    visibility: postData.visibility || 'public',
    language: postData.language || 'en',
    uri: `${baseUrl}/@${account.username}/${id}`,
    url: `${baseUrl}/@${account.username}/${id}`,
    replies_count: 0,
    reblogs_count: 0,
    favourites_count: 0,
    content: html,
    reblog: null,
    account,
    media_attachments: [],
    mentions: [],
    tags: [],
    emojis: [],
    card: null,
    poll: null,
  };

  statuses.push(status);
}

// Sort by date (newest first)
statuses.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

// Update account statuses_count
account.statuses_count = statuses.length;
account.last_status_at = statuses[0]?.created_at || null;

// Write to dist/posts.json
mkdirSync('dist', { recursive: true });
const output = {
  account,
  statuses,
};

writeFileSync('dist/posts.json', JSON.stringify(output, null, 2));

console.log(`✅ Built ${statuses.length} posts → dist/posts.json`);
