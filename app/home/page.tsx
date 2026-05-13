"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { fetchPosts, createPost } from "../../lib/posts";
import { Post, PostType, PostScope, PostVisibility } from "@/types/post";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedType, setFeedType] = useState<'local' | 'village' | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: '',
    content: '',
    type: 'general' as PostType,
    scope: 'local' as PostScope,
    visibility: 'public' as PostVisibility,
    location: '',
  });

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) loadPosts();
  }, [user, feedType]);

  async function checkUser() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser?.user_metadata) {
        setProfile(currentUser.user_metadata);
      }
    } catch (error) {
      console.error('Error checking user:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  async function loadPosts() {
    setLoading(true);
    try {
      let options: any = {};
      if (feedType === 'local') options.scope = 'local';
      if (feedType === 'village') options.scope = 'village';
      setPosts(await fetchPosts(options));
    } catch (e) {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await createPost({
        ...form,
        author_id: user.id,
        author_name: profile?.full_name || 'Anonymous',
      });
      setForm({ title: '', content: '', type: 'general', scope: 'local', visibility: 'public', location: '' });
      await loadPosts();
    } catch (e) {
      alert('Failed to create post');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900 flex flex-col">
      <div className="max-w-2xl w-full mx-auto p-4 flex-1 flex flex-col">
        <header className="mb-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Welcome, {profile?.full_name?.split(' ')[0] || 'Mom'}! 💕
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Your feed brings together your local area and your village.
          </p>
        </header>
        {/* Post creation form */}
        <form onSubmit={handleCreatePost} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 mb-6 shadow-sm flex flex-col gap-3">
          <input
            className="border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 mb-2 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            placeholder="Title (e.g. Need help with school pickup)"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            required
          />
          <textarea
            className="border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 mb-2 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            placeholder="What's on your mind?"
            value={form.content}
            onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            required
          />
          <div className="flex flex-wrap gap-2 mb-2">
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as PostType }))} className="rounded border px-2 py-1">
              <option value="general">General</option>
              <option value="support">Support</option>
            </select>
            <select value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value as PostScope }))} className="rounded border px-2 py-1">
              <option value="local">Local</option>
              <option value="village">My Village</option>
            </select>
            <select value={form.visibility} onChange={e => setForm(f => ({ ...f, visibility: e.target.value as PostVisibility }))} className="rounded border px-2 py-1">
              <option value="public">Public</option>
              <option value="village">Village Only</option>
            </select>
            {form.scope === 'local' && (
              <input
                className="rounded border px-2 py-1"
                placeholder="Location (optional)"
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              />
            )}
          </div>
          <button type="submit" className="bg-pink-600 text-white rounded px-4 py-2 font-semibold hover:bg-pink-700 transition-colors" disabled={creating}>
            {creating ? 'Posting...' : 'Post'}
          </button>
        </form>
        {/* Feed toggle */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setFeedType('all')} className={`px-3 py-1 rounded-full text-sm font-medium ${feedType === 'all' ? 'bg-pink-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200'}`}>All</button>
          <button onClick={() => setFeedType('local')} className={`px-3 py-1 rounded-full text-sm font-medium ${feedType === 'local' ? 'bg-pink-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200'}`}>Local</button>
          <button onClick={() => setFeedType('village')} className={`px-3 py-1 rounded-full text-sm font-medium ${feedType === 'village' ? 'bg-pink-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200'}`}>My Village</button>
        </div>
        {/* Feed */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center text-zinc-500 py-8">Loading feed...</div>
          ) : posts.length === 0 ? (
            <div className="text-center text-zinc-500 py-8">No posts yet. Be the first to post!</div>
          ) : (
            posts.map(post => (
              <div key={post.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 mb-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${post.type === 'support' ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'}`}>{post.type === 'support' ? 'Support' : 'General'}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${post.scope === 'village' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>{post.scope === 'village' ? 'My Village' : 'Local'}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${post.visibility === 'public' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'}`}>{post.visibility === 'public' ? 'Public' : 'Village Only'}</span>
                </div>
                <div className="font-bold text-lg mb-1">{post.title}</div>
                <div className="text-zinc-700 dark:text-zinc-200 mb-2 whitespace-pre-line">{post.content}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">By {post.author_name} • {new Date(post.created_at).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      </div>
      {/* Floating nav buttons */}
      <div className="fixed bottom-4 left-4 flex flex-col gap-2 z-50">
        <NavButton href="/profile" icon="👤" label="Profile" />
        <NavButton href="/calendar" icon="📅" label="Calendar" />
      </div>
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        <NavButton href="/messages" icon="💬" label="Messages" />
        <NavButton href="/village" icon="🏘️" label="Village" />
      </div>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <NavButton href="/find-moms" icon="🔍" label="Find Moms" />
      </div>
    </div>
  );
}

function NavButton({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-md rounded-full px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-pink-50 dark:hover:bg-pink-900/30 transition-all">
      <span className="text-lg">{icon}</span> {label}
    </Link>
  );
}
