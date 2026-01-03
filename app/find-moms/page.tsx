
"use client";
// Conversation type for localStorage chat logic
interface Conversation {
  id: string;
  other_user_id: string;
  other_user_name: string;
  other_user_photo?: string;
  last_message: string;
  last_message_time: string;
}

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useNotification } from "../components/useNotification";
import { v4 as uuidv4 } from "uuid";

interface MomProfile {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    number_of_kids?: number;
    kids_age_groups?: string[];
    preferred_language?: string;
    parenting_style?: string;
    profile_photo_url?: string;
    services_offered?: string[];
    services_needed?: string[];
  };
}


interface Filters {
  location: boolean;
  kidsAgeGroups: boolean;
  numberOfKids: boolean;
  language: boolean;
  parentingStyle: boolean;
  servicesOffered: boolean;
  servicesNeeded: boolean;
}

const defaultFilters: Filters = {
  location: true,
  kidsAgeGroups: false,
  numberOfKids: false,
  language: false,
  parentingStyle: false,
  servicesOffered: false,
  servicesNeeded: false,
};

export default function FindMomsPage() {
  const [moms, setMoms] = useState<MomProfile[]>([]);
  const [filteredMoms, setFilteredMoms] = useState<MomProfile[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [currentProfile, setCurrentProfile] = useState<MomProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  // TODO: Replace with actual user context/auth if available
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function fetchMoms() {
      setLoading(true);
      try {
        // Get current user from Supabase auth (always latest metadata)
        const { data: { user: authUser } } = await supabase.auth.getUser();
        setUser(authUser);
        let current = null;
        if (authUser) {
          current = {
            id: authUser.id,
            email: authUser.email ?? undefined,
            user_metadata: (authUser.user_metadata || undefined) as any,
          };
        }
        setCurrentProfile(current);
        // Fetch all users for the moms list (admin API)
        let res, json;
        try {
          res = await fetch('/api/supabase/users', { cache: 'no-store' });
          json = await res.json();
        } catch (fetchErr) {
          if (typeof window !== 'undefined') {
            console.error('Error fetching /api/supabase/users:', fetchErr);
          }
          setMoms([]);
          setFilteredMoms([]);
          setLoadError('Failed to fetch users');
          setLoading(false);
          return;
        }
        if (typeof window !== 'undefined') {
          console.log('Full /api/supabase/users response:', json);
        }
        if (!res.ok || json?.error) {
          setMoms([]);
          setFilteredMoms([]);
          setLoadError(json?.error || `Failed to load users (status ${res.status})`);
          setLoading(false);
          return;
        }
        const users = (json?.users || []) as Array<{ id: string; email?: string | null; user_metadata?: Record<string, any> | null }>;
        if (typeof window !== 'undefined') {
          console.log('All users from API:', users);
        }
        // Exclude current user from moms list
        const otherMoms: MomProfile[] = (users || []).filter((u: any) => u.id !== authUser?.id).map((u: any) => ({
          id: u.id,
          email: u.email ?? undefined,
          user_metadata: (u.user_metadata || undefined) as any,
        })) || [];
        setMoms(otherMoms);
        setFilteredMoms(otherMoms);
        setLoadError(null);
      } catch (err: any) {
        setMoms([]);
        setFilteredMoms([]);
        setCurrentProfile(null);
        setLoadError(err?.message || 'Unknown error');
      }
      setLoading(false);
    }
    fetchMoms();
  }, []);


  // Filtering logic
  useEffect(() => {
    console.log('Filter effect running', { filters, moms, currentProfile });
    if (!currentProfile) {
      setFilteredMoms(moms);
      return;
    }
    let filtered = moms;
    // Debug: log currentProfile and all moms' city/state before filtering
    if (filters.location && currentProfile.user_metadata?.city && currentProfile.user_metadata?.state) {
      const myCity = currentProfile.user_metadata.city.trim().toLowerCase();
      const myState = currentProfile.user_metadata.state.trim().toLowerCase();
      console.log('Current user city/state:', myCity, myState);
      moms.forEach((mom) => {
        const momCity = (mom.user_metadata?.city || '').trim().toLowerCase();
        const momState = (mom.user_metadata?.state || '').trim().toLowerCase();
        console.log('Mom:', mom.id, 'city:', momCity, 'state:', momState);
      });
      filtered = filtered.filter(mom => {
        const momCity = (mom.user_metadata?.city || '').trim().toLowerCase();
        const momState = (mom.user_metadata?.state || '').trim().toLowerCase();
        return momCity === myCity && momState === myState;
      });
    }
    // Filter by kids age groups
    if (filters.kidsAgeGroups && currentProfile.user_metadata?.kids_age_groups?.length) {
      filtered = filtered.filter(mom =>
        mom.user_metadata?.kids_age_groups?.some((age: string) =>
          currentProfile.user_metadata?.kids_age_groups?.includes(age)
        )
      );
    }
    // Filter by number of kids (±1)
    if (filters.numberOfKids && currentProfile.user_metadata?.number_of_kids) {
      filtered = filtered.filter(mom =>
        mom.user_metadata?.number_of_kids !== undefined &&
        Math.abs((mom.user_metadata?.number_of_kids ?? 0) - (currentProfile.user_metadata?.number_of_kids ?? 0)) <= 1
      );
    }
    // Filter by language
    if (filters.language && currentProfile.user_metadata?.preferred_language) {
      filtered = filtered.filter(mom =>
        mom.user_metadata?.preferred_language === currentProfile.user_metadata?.preferred_language
      );
    }
    // Filter by parenting style
    if (filters.parentingStyle && currentProfile.user_metadata?.parenting_style) {
      filtered = filtered.filter(mom =>
        mom.user_metadata?.parenting_style === currentProfile.user_metadata?.parenting_style
      );
    }
    // Filter by services offered (other moms offer what you need)
    if (filters.servicesOffered && currentProfile.user_metadata?.services_needed?.length) {
      filtered = filtered.filter(mom => {
        const momServicesOffered = (mom.user_metadata?.services_offered || []) as string[];
        return momServicesOffered.some((service: string) => currentProfile.user_metadata?.services_needed?.includes(service));
      });
    }
    // Filter by services needed (other moms need what you offer)
    if (filters.servicesNeeded && currentProfile.user_metadata?.services_offered?.length) {
      filtered = filtered.filter(mom => {
        const momServicesNeeded = (mom.user_metadata?.services_needed || []) as string[];
        return momServicesNeeded.some((service: string) => currentProfile.user_metadata?.services_offered?.includes(service));
      });
    }
    setFilteredMoms(filtered);
  }, [filters, moms, currentProfile]);

  function toggleFilter(filterKey: keyof Filters) {
    setFilters(prev => ({
      ...prev,
      [filterKey]: !prev[filterKey]
    }));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Find Moms Nearby 🔍</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Connect with like-minded mothers in your area
            </p>
          </div>
          <Link href="/home" className="text-sm text-pink-600 dark:text-pink-400 hover:underline">
            Back to Home
          </Link>
        </header>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                Filter Matches
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                Turn filters on/off to find your perfect mom friends
              </p>

              <div className="space-y-3">
                <FilterToggle
                  label="📍 Same Location"
                  description={currentProfile?.user_metadata?.city && currentProfile?.user_metadata?.state 
                    ? `${currentProfile.user_metadata.city}, ${currentProfile.user_metadata.state}` 
                    : 'Set your location in profile'}
                  enabled={filters.location}
                  onToggle={() => toggleFilter('location')}
                  disabled={!currentProfile?.user_metadata?.city || !currentProfile?.user_metadata?.state}
                />

                <FilterToggle
                  label="👶 Kids Age Groups"
                  description={Array.isArray(currentProfile?.user_metadata?.kids_age_groups) && currentProfile.user_metadata.kids_age_groups.length > 0
                    ? `${currentProfile.user_metadata.kids_age_groups.length} age group(s)`
                    : 'Set ages in profile'}
                  enabled={filters.kidsAgeGroups}
                  onToggle={() => toggleFilter('kidsAgeGroups')}
                  disabled={!(Array.isArray(currentProfile?.user_metadata?.kids_age_groups) && currentProfile.user_metadata.kids_age_groups.length > 0)}
                />

                <FilterToggle
                  label="🔢 Number of Kids"
                  description={currentProfile?.user_metadata?.number_of_kids
                    ? `${currentProfile.user_metadata.number_of_kids} kid(s) (±1)`
                    : 'Set in profile'}
                  enabled={filters.numberOfKids}
                  onToggle={() => toggleFilter('numberOfKids')}
                  disabled={!currentProfile?.user_metadata?.number_of_kids}
                />

                <FilterToggle
                  label="🗣️ Language"
                  description={currentProfile?.user_metadata?.preferred_language || 'Set in profile'}
                  enabled={filters.language}
                  onToggle={() => toggleFilter('language')}
                  disabled={!currentProfile?.user_metadata?.preferred_language}
                />

                <FilterToggle
                  label="💭 Parenting Style"
                  description={currentProfile?.user_metadata?.parenting_style || 'Set in profile'}
                  enabled={filters.parentingStyle}
                  onToggle={() => toggleFilter('parentingStyle')}
                  disabled={!currentProfile?.user_metadata?.parenting_style}
                />

                <FilterToggle
                  label="🤝 Services Offered"
                  description={Array.isArray(currentProfile?.user_metadata?.services_offered) && currentProfile.user_metadata.services_offered.length > 0
                    ? `Moms offering what you need`
                    : 'Select services in profile'}
                  enabled={filters.servicesOffered}
                  onToggle={() => toggleFilter('servicesOffered')}
                  disabled={!(Array.isArray(currentProfile?.user_metadata?.services_needed) && currentProfile.user_metadata.services_needed.length > 0)}
                />

                <FilterToggle
                  label="🙏 Services Needed"
                  description={Array.isArray(currentProfile?.user_metadata?.services_needed) && currentProfile.user_metadata.services_needed.length > 0
                    ? `Moms needing your help`
                    : 'Select services in profile'}
                  enabled={filters.servicesNeeded}
                  onToggle={() => toggleFilter('servicesNeeded')}
                  disabled={!(Array.isArray(currentProfile?.user_metadata?.services_offered) && currentProfile.user_metadata.services_offered.length > 0)}
                />
              </div>

              <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Active Filters: {Object.values(filters).filter(Boolean).length}
                </div>
                <button
                  onClick={() => setFilters({
                    location: false,
                    kidsAgeGroups: false,
                    numberOfKids: false,
                    language: false,
                    parentingStyle: false,
                    servicesOffered: false,
                    servicesNeeded: false,
                  })}
                  className="text-sm text-pink-600 dark:text-pink-400 hover:underline"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          </div>

          {/* Results Grid */}
          <div className="lg:col-span-3">
            {!currentProfile?.user_metadata?.city || !currentProfile?.user_metadata?.state ? (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-8 text-center">
                <div className="text-4xl mb-4">📍</div>
                <h3 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Complete Your Profile First
                </h3>
                <p className="text-blue-700 dark:text-blue-300 mb-4">
                  Add your location and other details to start finding moms nearby!
                </p>
                <Link
                  href="/profile"
                  className="inline-block px-6 py-2 bg-pink-600 text-white rounded-full font-medium hover:bg-pink-700 transition-colors"
                >
                  Complete Profile
                </Link>
              </div>
            ) : filteredMoms.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 text-center">
                <div className="text-6xl mb-4">🌱</div>
                <h3 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                  Your Village is Growing!
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400 mb-6 max-w-md mx-auto">
                  We're still building this feature. Soon you'll be able to connect with amazing moms in{' '}
                  {currentProfile?.user_metadata?.city}, {currentProfile?.user_metadata?.state}!
                </p>
                <div className="flex gap-4 justify-center">
                  <Link
                    href="/profile"
                    className="px-6 py-2 border border-pink-300 dark:border-pink-700 text-pink-600 dark:text-pink-400 rounded-full font-medium hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-colors"
                  >
                    Update Profile
                  </Link>
                  <Link
                    href="/calendar"
                    className="px-6 py-2 bg-pink-600 text-white rounded-full font-medium hover:bg-pink-700 transition-colors"
                  >
                    Set Availability
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {filteredMoms.map((mom) => (
                  <MomCard key={mom.id} mom={mom} currentUserId={user?.id} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface FilterToggleProps {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

function FilterToggle({ label, description, enabled, onToggle, disabled }: FilterToggleProps) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        disabled
          ? 'opacity-50 cursor-not-allowed bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700'
          : enabled
          ? 'bg-pink-50 dark:bg-pink-900/20 border-pink-300 dark:border-pink-700'
          : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-pink-300 dark:hover:border-pink-700'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{label}</span>
        <div className={`w-10 h-5 rounded-full transition-colors ${
          enabled ? 'bg-pink-600' : 'bg-zinc-300 dark:bg-zinc-600'
        }`}>
          <div className={`w-4 h-4 rounded-full bg-white transition-transform transform ${
            enabled ? 'translate-x-5' : 'translate-x-0.5'
          } mt-0.5`} />
        </div>
      </div>
      <div className="text-xs text-zinc-600 dark:text-zinc-400">{description}</div>
    </button>
  );
}

interface MomCardProps {
  mom: MomProfile;
  currentUserId: string;
}



function MomCard({ mom, currentUserId }: MomCardProps) {
  const router = useRouter();
  const metadata = mom.user_metadata;
  const { showNotification, NotificationComponent } = useNotification();
  const [connecting, setConnecting] = useState(false);

  async function handleConnect() {
    setConnecting(true);
    try {
      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('Not authenticated');
      const myUserId = currentUser.id;
      const myName = currentUser.user_metadata?.full_name || 'Mom';
      const myPhoto = currentUser.user_metadata?.profile_photo_url || '';

      // Get other mom's info
      const otherUserId = mom.id;
      const otherName = mom.user_metadata?.full_name || 'Mom';
      const otherPhoto = mom.user_metadata?.profile_photo_url || '';

      // Check if conversation already exists (regardless of user order)
      const { data: existingConv, error: checkError } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(user1_id.eq.${myUserId},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${myUserId})`)
        .limit(1);
      if (checkError) throw checkError;
      let conversationId;
      if (existingConv && existingConv.length > 0) {
        conversationId = existingConv[0].id;
      } else {
        // Create conversation row with a real UUID
        conversationId = uuidv4();
        const { error: convError } = await supabase
          .from('conversations')
          .insert([
            {
              id: conversationId,
              user1_id: myUserId,
              user2_id: otherUserId,
              user1_name: myName,
              user2_name: otherName,
              user1_photo: myPhoto,
              user2_photo: otherPhoto,
            }
          ]);
        if (convError) throw convError;
        // Create first message to start the conversation
        const { error: msgError } = await supabase
          .from('messages')
          .insert([
            {
              match_id: conversationId,
              sender_id: myUserId,
              receiver_id: otherUserId,
              message_text: 'Conversation started',
              created_at: new Date().toISOString(),
            }
          ]);
        if (msgError) throw msgError;
      }
      // Force reload of conversations by navigating to messages page, then reloading
      router.push(`/messages?conversation=${encodeURIComponent(conversationId)}`);
      // Optionally, you can trigger a reload in the messages page via a query param or state
    } catch (error: any) {
      showNotification(error?.message || 'Error connecting. Please try again.');
      console.error('Error connecting:', error);
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start gap-4">
        {metadata?.profile_photo_url ? (
          <img
            src={metadata.profile_photo_url}
            alt={metadata.full_name || 'Mom'}
            className="w-16 h-16 rounded-full object-cover border-2 border-pink-300"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white text-xl font-semibold">
            {metadata?.full_name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {metadata?.full_name || 'Mom'}
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {metadata?.city}, {metadata?.state}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {metadata?.number_of_kids && (
              <span className="text-xs px-2 py-1 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full">
                {metadata.number_of_kids} kid{metadata.number_of_kids !== 1 ? 's' : ''}
              </span>
            )}
            {metadata?.kids_age_groups?.map(age => (
              <span key={age} className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                {age}
              </span>
            ))}
            {metadata?.parenting_style && (
              <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                {metadata.parenting_style}
              </span>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleConnect}
              disabled={connecting}
              className={`flex-1 px-4 py-2 bg-pink-600 text-white rounded-full text-sm font-medium hover:bg-pink-700 transition-colors ${connecting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {connecting ? 'Connecting...' : 'Connect 💬'}
            </button>
            <button
              onClick={() => router.push(`/mom-profile?id=${encodeURIComponent(mom.id)}`)}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-full text-sm font-medium hover:bg-purple-700 transition-colors"
            >
              View Profile
            </button>
          </div>
          {NotificationComponent}
        </div>
      </div>
    </div>
  );
}
