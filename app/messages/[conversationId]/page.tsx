
"use client";
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import ConversationPageInner from "../ConversationPageInner";

export default async function ConversationPage(props: { params: { conversationId: string } } | Promise<{ params: { conversationId: string } }>) {
  const resolved = await Promise.resolve(props);
  console.log('[ConversationPage] resolved params:', resolved);
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ConversationPageInner conversationId={resolved.params.conversationId} />
    </Suspense>
  );
}
