export type UserProfile = {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
};

export type Service = {
  id: string;
  title: string;
  description?: string;
  ownerUserId: string;
};

export type Message = {
  id: string;
  conversationId: string;
  senderUserId: string;
  content: string;
  createdAt: string; // ISO string
};
