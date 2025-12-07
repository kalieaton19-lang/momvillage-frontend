"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      
      setUser(session.user);
      
      // Load user profile
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

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              Welcome back, {profile?.full_name?.split(' ')[0] || 'Mom'}! 💕
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Your village is ready to support you
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm px-4 py-2 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-pink-50 dark:hover:bg-pink-900/20 hover:text-pink-600 dark:hover:text-pink-400 hover:border-pink-300 dark:hover:border-pink-700 transition-colors"
          >
            Sign Out
          </button>
        </header>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 border border-pink-200 dark:border-pink-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="text-3xl">👶</div>
              <div className="text-sm font-medium text-pink-700 dark:text-pink-300">Little Ones</div>
            </div>
            <div className="text-3xl font-bold text-pink-900 dark:text-pink-50">
              {profile?.number_of_kids || 0}
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="text-3xl">📍</div>
              <div className="text-sm font-medium text-purple-700 dark:text-purple-300">Your Neighborhood</div>
            </div>
            <div className="text-lg font-semibold text-purple-900 dark:text-purple-50 truncate">
              {profile?.city || 'Not set'}, {profile?.state || ''}
            </div>
          </div>
          <div className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-800/20 border border-teal-200 dark:border-teal-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="text-3xl">🤝</div>
              <div className="text-sm font-medium text-teal-700 dark:text-teal-300">Village Friends</div>
            </div>
            <div className="text-3xl font-bold text-teal-900 dark:text-teal-50">0</div>
          </div>
        </div>

        {/* Main Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ActionCard
            title="My Profile ✨"
            description="Update your personal information, contact details, family info, and preferences. Keep your profile current so other moms can get to know you better."
            href="/profile"
            color="pink"
          />
          <ActionCard
            title="Schedule & Meetups 📅"
            description="Set your weekly schedule, mark specific dates when you're free, and track all your meetups and services with other moms in one central calendar."
            href="/calendar"
            color="purple"
          />
          <ActionCard
            title="Create Meetups 👋"
            description="Invite moms from your conversations or village to coordinate meetups and service exchanges together."
            href="/meetups-services"
            color="pink"
          />
          <ActionCard
            title="Services Exchange 🔄"
            description="Share what services you offer and what help you need. Find moms who can help with childcare, household tasks, advice, and activities."
            href="/services"
            color="blue"
          />
          <ActionCard
            title="Find Moms Nearby 🔍"
            description="Connect with like-minded mothers in your area. Filter by kids' ages, parenting style, location, and shared interests to find your perfect mom friends."
            href="/find-moms"
            color="teal"
          />
          <ActionCard
            title="Messages 💬"
            description="Chat with your village members, plan meetups, share parenting tips, and stay connected. Keep all your mom conversations in one place."
            href="/messages"
            color="green"
          />
          <ActionCard
            title="My Village 🏘️"
            description="See your growing network of mom friends, manage connections, and view profiles of the mothers supporting you on your parenting journey."
            href="/village"
            color="orange"
          />
        </div>
      </div>
    </div>
  );
}

interface ActionCardProps {
  title: string;
  description: string;
  href: string;
  color?: 'pink' | 'purple' | 'blue' | 'green' | 'orange' | 'teal';
  comingSoon?: boolean;
}

function ActionCard({ title, description, href, color = 'pink', comingSoon }: ActionCardProps) {
  const colorClasses = {
    pink: 'from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 border-pink-200 dark:border-pink-800',
    purple: 'from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800',
    blue: 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800',
    green: 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800',
    orange: 'from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800',
    teal: 'from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-800/20 border-teal-200 dark:border-teal-800',
  };

  const cardContent = (
    <>
      {comingSoon && (
        <div className="absolute top-4 right-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs px-3 py-1.5 rounded-full font-medium shadow-sm">
          Coming Soon
        </div>
      )}
      <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-3">{title}</h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{description}</p>
    </>
  );

  const cardClasses = `relative bg-gradient-to-br ${colorClasses[color]} border rounded-2xl p-6 transition-all shadow-sm ${
    comingSoon
      ? 'opacity-70 cursor-not-allowed'
      : 'hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 cursor-pointer'
  }`;

  if (comingSoon) {
    return <div className={cardClasses}>{cardContent}</div>;
  }

  return (
    <Link href={href} className={cardClasses}>
      {cardContent}
    </Link>
  );
}
