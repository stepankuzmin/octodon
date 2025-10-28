import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

// Simple types for what we need
interface Account {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  locked: boolean;
  bot: boolean;
  discoverable: boolean;
  group: boolean;
  created_at: string;
  note: string;
  url: string;
  avatar: string;
  avatar_static: string;
  header: string;
  header_static: string;
  followers_count: number;
  following_count: number;
  statuses_count: number;
  last_status_at: string | null;
  emojis: unknown[];
  fields: unknown[];
}

interface Status {
  id: string;
  created_at: string;
  in_reply_to_id: null;
  in_reply_to_account_id: null;
  sensitive: boolean;
  spoiler_text: string;
  visibility: string;
  language: string;
  uri: string;
  url: string;
  replies_count: number;
  reblogs_count: number;
  favourites_count: number;
  content: string;
  reblog: null;
  account: Account;
  media_attachments: unknown[];
  mentions: unknown[];
  tags: unknown[];
  emojis: unknown[];
  card: null;
  poll: null;
}

interface PostData {
  date?: string;
  visibility?: string;
  sensitive?: boolean;
  spoiler_text?: string;
  language?: string;
}

// Load account info
const account: Account = JSON.parse(readFileSync('account.json', 'utf-8'));

// Read all markdown files
const postsDir = 'posts';
const files = readdirSync(postsDir).filter(f => f.endsWith('.md'));

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
    uri: `https://octodon.stepankuzmin.workers.dev/@stepan/${id}`,
    url: `https://octodon.stepankuzmin.workers.dev/@stepan/${id}`,
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
