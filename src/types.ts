export interface Account {
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
  header?: string;
  header_static?: string;
  followers_count: number;
  following_count: number;
  statuses_count: number;
  last_status_at: string | null;
  emojis: unknown[];
  fields: unknown[];
}

export interface Status {
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
