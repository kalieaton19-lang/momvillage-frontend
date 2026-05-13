"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { fetchPosts, createPost } from "../../lib/posts";
import { Post, PostType, PostScope, PostVisibility } from "../../types/post";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedType, setFeedType] = useState<'local' | 'village' | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
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
        {/* Post creation modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
            <div className="ds-card relative w-full max-w-md p-8 shadow-xl animate-modalIn">
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute top-3 right-3 text-zinc-400 hover:text-pink-600 dark:hover:text-pink-300 text-3xl font-bold focus:outline-none focus:ring-2 focus:ring-pink-400"
                aria-label="Close"
              >
                &times;
              </button>
              <h2 className="text-2xl font-extrabold mb-4 text-center text-pink-600 dark:text-pink-300 tracking-tight">Create a Post</h2>
              <form onSubmit={handleCreatePost} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Title</label>
                  <input
                    className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-2 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-pink-400 transition"
                    placeholder="e.g. Need help with school pickup"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Content</label>
                  <textarea
                    className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-2 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-pink-400 transition min-h-[80px]"
                    placeholder="What's on your mind?"
                    value={form.content}
                    onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                    required
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">Type</label>
                    <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as PostType }))} className="rounded-lg border px-2 py-1">
                      <option value="general">General</option>
                      <option value="support">Support</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">Scope</label>
                    <select value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value as PostScope }))} className="rounded-lg border px-2 py-1">
                      <option value="local">Local</option>
                      <option value="village">My Village</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">Visibility</label>
                    <select value={form.visibility} onChange={e => setForm(f => ({ ...f, visibility: e.target.value as PostVisibility }))} className="rounded-lg border px-2 py-1">
                      <option value="public">Public</option>
                      <option value="village">Village Only</option>
                    </select>
                  </div>
                  {form.scope === 'local' && (
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">Location</label>
                      <input
                        className="rounded-lg border px-2 py-1"
                        placeholder="Location (optional)"
                        value={form.location}
                        onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  className="ds-button-primary w-full rounded-lg py-3 text-lg font-bold shadow-md hover:scale-105 transition-transform disabled:opacity-60"
                  disabled={creating}
                >
                  {creating ? 'Posting...' : 'Post'}
                </button>
              </form>
            </div>
          </div>
        )}
              {/* Floating create post button */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="fixed bottom-4 right-4 z-50 bg-pink-600 hover:bg-pink-700 text-white rounded-full w-16 h-16 flex items-center justify-center text-4xl shadow-lg border-4 border-white dark:border-zinc-900"
                aria-label="Create Post"
              >
                +
              </button>
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
        <NavButton href="/messages" icon="💬" label="" />
      </div>
      {/* Find Moms icon-only button at the top right */}
      <div className="fixed top-4 right-4 z-50">
        <NavButton href="/find-moms" icon="🔍" label="" />
      </div>
    </div>
  );
}

function NavButton({ href, icon, label }: { href: string; icon: string; label: string }) {
  const isIconOnly = !label;
  return (
    <Link
      href={href}
      className={`flex items-center ${isIconOnly ? 'justify-center p-3 w-12 h-12' : 'gap-2 px-4 py-2'} bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-md rounded-full text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-pink-50 dark:hover:bg-pink-900/30 transition-all`}
      aria-label={label || 'Messages'}
    >
      <span className="text-2xl">{icon}</span>
      {!isIconOnly && label}
    </Link>
  );
}
