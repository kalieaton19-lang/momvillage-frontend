export type PostType = "general" | "support";
export type PostScope = "village" | "local" | "public" | "private";
export type PostVisibility = "public" | "village";
export type SupportStatus = "open" | "fulfilled" | "canceled";

export interface Post {
  id: string;
  author_user_id: string;
  author_name: string;
  type: PostType;
  scope: PostScope;
  visibility: PostVisibility;
  title: string;
  content: string;
  location?: string;
  group_id?: string | null;
  photo_url?: string;
  comments_disabled?: boolean;
  support_status?: SupportStatus | null;
  support_fulfilled_by_user_id?: string | null;
  support_fulfilled_at?: string | null;
  start_time?: string;
  end_time?: string;
  created_at: string;
  updated_at: string;
}
