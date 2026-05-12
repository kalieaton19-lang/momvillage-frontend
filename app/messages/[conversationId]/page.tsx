
"use client";
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import ConversationPageInner from "../ConversationPageInner";

export default async function ConversationPage(props: any) {
  const resolved = await Promise.resolve(props);
  const params = resolved.params ? await Promise.resolve(resolved.params) : {};
  const searchParams = resolved.searchParams ? await Promise.resolve(resolved.searchParams) : {};
  console.log('[ConversationPage] fully resolved:', { params, searchParams });
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ConversationPageInner conversationId={params.conversationId} />
    </Suspense>
  );
}
