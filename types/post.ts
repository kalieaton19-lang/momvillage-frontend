export type PostType = "general" | "support";
export type PostScope = "village" | "local" | "public" | "private";
export type PostVisibility = "public" | "village";

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
  start_time?: string;
  end_time?: string;
  created_at: string;
  updated_at: string;
}
