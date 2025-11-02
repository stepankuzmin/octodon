/**
 * Mastodon API entity types
 * Based on https://docs.joinmastodon.org/entities/
 */

export interface Account {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  locked: boolean;
  bot: boolean;
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
}

export interface MediaAttachment {
  id: string;
  type: 'image' | 'video' | 'gifv' | 'audio' | 'unknown';
  url: string;
  preview_url: string;
  description?: string;
}

export interface Mention {
  id: string;
  username: string;
  acct: string;
  url: string;
}

export interface Tag {
  name: string;
  url: string;
}

export interface Status {
  id: string;
  uri: string;
  created_at: string;
  account: Account;
  content: string;
  visibility: 'public' | 'unlisted' | 'private' | 'direct';
  sensitive: boolean;
  spoiler_text: string;
  media_attachments: MediaAttachment[];
  mentions: Mention[];
  tags: Tag[];
  reblogs_count: number;
  favourites_count: number;
  replies_count: number;
  url: string | null;
  in_reply_to_id: string | null;
  in_reply_to_account_id: string | null;
  reblog: Status | null;
  language: string | null;
  text?: string;
}

export interface Instance {
  domain: string;
  title: string;
  version: string;
  source_url: string;
  description: string;
  usage: {
    users: {
      active_month: number;
    };
  };
  thumbnail: {
    url: string;
  };
  languages: string[];
  configuration: {
    statuses: {
      max_characters: number;
      max_media_attachments: number;
    };
    media_attachments: {
      supported_mime_types: string[];
      image_size_limit: number;
      video_size_limit: number;
    };
  };
  registrations: {
    enabled: boolean;
  };
  contact: {
    email: string;
  };
}

/**
 * Minimal status for timeline index (embedded in worker)
 */
export interface StatusIndex {
  id: string;
  created_at: string;
  account: {
    id: string;
  };
  replies_count: number;
  reblogs_count: number;
  favourites_count: number;
  uri: string;
  url: string | null;
}

/**
 * Frontmatter from markdown files
 */
export interface TootFrontmatter {
  id: string;
  created_at: string;
  visibility?: 'public' | 'unlisted' | 'private' | 'direct';
  sensitive?: boolean;
  spoiler_text?: string;
  language?: string;
  in_reply_to_id?: string;
  in_reply_to_account_id?: string;
  replies_count?: number;
  reblogs_count?: number;
  favourites_count?: number;
}

/**
 * Config file structure
 */
export interface Config {
  instance: {
    domain: string;
    title: string;
    version: string;
    description: string;
    sourceUrl: string;
    languages: string[];
    thumbnail?: string;
    email?: string;
  };
  account: {
    id: string;
    username: string;
    acct: string;
    display_name: string;
    note: string;
    url: string;
    avatar: string;
    header: string;
    locked?: boolean;
    bot?: boolean;
    created_at: string;
  };
}

/**
 * Cloudflare Workers environment bindings
 */
export interface Env {
  STATUSES_KV: KVNamespace;
  ACCOUNT_ID?: string;
}
