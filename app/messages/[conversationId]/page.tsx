export const dynamic = "force-dynamic";
"use client";

import { Suspense } from "react";
import ConversationPageInner from "../ConversationPageInner";

export default function ConversationPage({ params }: { params: { conversationId: string } }) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ConversationPageInner conversationId={params.conversationId} />
    </Suspense>
  );
}
