"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import PostContentWithPreview from "../../components/PostContentWithPreview";
import { formatFirstNameLastInitial, formatTimeAgo } from "../../../utils";

type PostRow = {
  id: string;
  author_user_id: string;
  author_name?: string | null;
  type: "general" | "support";
  title?: string | null;
  content?: string | null;
  photo_url?: string | null;
  created_at: string;
};

export default function SinglePostPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const postId = String(params?.id || "").trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [post, setPost] = useState<PostRow | null>(null);
  const [authorName, setAuthorName] = useState("Mom");
  const [authorPhoto, setAuthorPhoto] = useState("");

  useEffect(() => {
    if (!postId) {
      setError("Post not found.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadPost = async () => {
      setLoading(true);
      setError("");

      const { data: postData, error: postError } = await supabase
        .from("posts")
        .select("id,author_user_id,author_name,type,title,content,photo_url,created_at")
        .eq("id", postId)
        .single();

      if (cancelled) return;

      if (postError || !postData) {
        setPost(null);
        setError("Could not load this post.");
        setLoading(false);
        return;
      }

      setPost(postData as PostRow);

      const fallbackName = String((postData as any)?.author_name || "").trim() || "Mom";
      const authorUserId = String((postData as any)?.author_user_id || "");
      if (!authorUserId) {
        setAuthorName(fallbackName);
        setAuthorPhoto("");
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("user_public_profiles")
        .select("full_name,profile_photo_url")
        .eq("id", authorUserId)
        .single();

      if (cancelled) return;

      setAuthorName(String(profile?.full_name || fallbackName || "Mom"));
      setAuthorPhoto(String(profile?.profile_photo_url || ""));
      setLoading(false);
    };

    void loadPost();

    return () => {
      cancelled = true;
    };
  }, [postId]);

  return (
    <div className="min-h-screen bg-pink-50 dark:bg-zinc-900 px-3 py-4 sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Back
          </button>
          {postId ? (
            <Link
              href={`/home?post=${encodeURIComponent(postId)}#post-${encodeURIComponent(postId)}`}
              className="rounded-full border border-pink-300 bg-pink-100 px-3 py-1 text-sm font-semibold text-pink-700 hover:bg-pink-200 dark:border-pink-800 dark:bg-pink-900/40 dark:text-pink-200"
            >
              View in Feed
            </Link>
          ) : null}
        </div>

        {loading ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            Loading post...
          </div>
        ) : error || !post ? (
          <div className="rounded-xl border border-red-200 bg-white p-6 text-sm text-red-600 shadow-sm dark:border-red-900/50 dark:bg-zinc-900 dark:text-red-300">
            {error || "Post not found."}
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            {post.type === "support" ? (
              <div className="-mx-4 -mt-4 mb-3 rounded-t-xl bg-pink-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">
                Support Post
              </div>
            ) : null}

            <div className="mb-3 flex items-center gap-3">
              {authorPhoto ? (
                <img
                  src={authorPhoto}
                  alt={authorName}
                  className="h-10 w-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-purple-400 text-white font-semibold">
                  {(authorName || "M").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  {formatFirstNameLastInitial(authorName || "Mom")}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Posted {formatTimeAgo(post.created_at)}
                </div>
              </div>
            </div>

            {post.photo_url ? (
              <img
                src={post.photo_url}
                alt="Post photo"
                className="mb-3 w-full max-h-80 rounded-xl object-cover border border-zinc-100 dark:border-zinc-800"
              />
            ) : null}

            {post.title ? (
              <h1 className="mb-2 text-lg font-bold text-zinc-900 dark:text-zinc-50">{post.title}</h1>
            ) : null}

            <PostContentWithPreview
              text={String(post.content || "")}
              className="whitespace-pre-line text-zinc-700 dark:text-zinc-200"
            />
          </div>
        )}
      </div>
    </div>
  );
}
