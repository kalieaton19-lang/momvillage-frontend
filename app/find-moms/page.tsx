"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

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

interface Conversation {
  id: string;
  other_user_id: string;
  other_user_name: string;
  other_user_photo?: string;
  last_message?: string;
  last_message_time?: string;
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

export default function FindMomsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [moms, setMoms] = useState<MomProfile[]>([]);
  const [filteredMoms, setFilteredMoms] = useState<MomProfile[]>([]);
  const [filters, setFilters] = useState<Filters>({
    location: true,
    kidsAgeGroups: false,
    numberOfKids: false,
    language: false,
    parentingStyle: false,
    servicesOffered: false,
    servicesNeeded: false,
  });
  const [searchRadius, setSearchRadius] = useState<number>(10); // miles

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (currentProfile && moms.length > 0) {
      applyFilters();
    } else if (moms.length === 0) {
      setFilteredMoms([]);
    }
  }, [filters, moms, currentProfile]);

  async function checkUser() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      
      setUser(session.user);
      
      // Load current user profile
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser?.user_metadata) {
        setCurrentProfile(currentUser.user_metadata);
      }
      
      await loadMoms();
    } catch (error) {
      console.error('Error checking user:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  async function loadMoms() {
    try {
      console.log('Loading moms from nearby areas...');
      
      // Fetch all users from Supabase auth
      // Note: This uses the anon key, so we can only access public user data
      // For a production app with many users, you'd want a backend API with pagination
      const { data, error } = await supabase.auth.admin.listUsers();
      
      if (error) {
        // If admin API doesn't work with anon key, we'll need a backend endpoint
        // For now, just load an empty list
        console.log('Admin API not available with anon key, would need backend API');
        setMoms([]);
        setFilteredMoms([]);
        return;
      }
      
      // Filter out the current user and format the data
      type UserRow = { id: string; email?: string | null; user_metadata?: Record<string, any> };
      const users: UserRow[] = (data?.users || []) as unknown as UserRow[];
      const otherMoms: MomProfile[] = users
        .filter((u: UserRow) => u.id !== user?.id)
        .map((u: UserRow): MomProfile => ({
          id: u.id,
          email: u.email ?? undefined,
          user_metadata: u.user_metadata as any
        })) || [];
      
      setMoms(otherMoms);
      applyFilters(); // Apply filters to the loaded moms
    } catch (error) {
      console.error('Error loading moms:', error);
      setMoms([]);
      setFilteredMoms([]);
    }
  }

  function applyFilters() {
    if (!currentProfile) return;

    let filtered = [...moms];

    // Filter by location (city/state match)
    if (filters.location && currentProfile.city && currentProfile.state) {
      filtered = filtered.filter(mom => 
        mom.user_metadata?.city?.toLowerCase() === currentProfile.city?.toLowerCase() &&
        mom.user_metadata?.state?.toLowerCase() === currentProfile.state?.toLowerCase()
      );
    }

    // Filter by kids age groups (at least one match)
    if (filters.kidsAgeGroups && currentProfile.kids_age_groups?.length > 0) {
      filtered = filtered.filter(mom => {
        const momAgeGroups = mom.user_metadata?.kids_age_groups || [];
        return momAgeGroups.some(age => currentProfile.kids_age_groups?.includes(age));
      });
    }

    // Filter by number of kids (within ±1)
    if (filters.numberOfKids && currentProfile.number_of_kids) {
      filtered = filtered.filter(mom => {
        const momKids = mom.user_metadata?.number_of_kids || 0;
        return Math.abs(momKids - currentProfile.number_of_kids) <= 1;
      });
    }

    // Filter by language
    if (filters.language && currentProfile.preferred_language) {
      filtered = filtered.filter(mom => 
        mom.user_metadata?.preferred_language === currentProfile.preferred_language
      );
    }

    // Filter by parenting style
    if (filters.parentingStyle && currentProfile.parenting_style) {
      filtered = filtered.filter(mom => 
        mom.user_metadata?.parenting_style === currentProfile.parenting_style
      );
    }

    // Filter by services offered (other moms offer what you need)
    if (filters.servicesOffered && currentProfile.services_needed?.length > 0) {
      filtered = filtered.filter(mom => {
        const momServicesOffered = (mom.user_metadata?.services_offered || []) as string[];
        return momServicesOffered.some((service: string) => currentProfile.services_needed?.includes(service));
      });
    }

    // Filter by services needed (other moms need what you offer)
    if (filters.servicesNeeded && currentProfile.services_offered?.length > 0) {
      filtered = filtered.filter(mom => {
        const momServicesNeeded = (mom.user_metadata?.services_needed || []) as string[];
        return momServicesNeeded.some((service: string) => currentProfile.services_offered?.includes(service));
      });
    }

    setFilteredMoms(filtered);
  }

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
                  description={currentProfile?.city && currentProfile?.state 
                    ? `${currentProfile.city}, ${currentProfile.state}` 
                    : 'Set your location in profile'}
                  enabled={filters.location}
                  onToggle={() => toggleFilter('location')}
                  disabled={!currentProfile?.city || !currentProfile?.state}
                />

                <FilterToggle
                  label="👶 Kids Age Groups"
                  description={currentProfile?.kids_age_groups?.length > 0
                    ? `${currentProfile.kids_age_groups.length} age group(s)`
                    : 'Set ages in profile'}
                  enabled={filters.kidsAgeGroups}
                  onToggle={() => toggleFilter('kidsAgeGroups')}
                  disabled={!currentProfile?.kids_age_groups?.length}
                />

                <FilterToggle
                  label="🔢 Number of Kids"
                  description={currentProfile?.number_of_kids
                    ? `${currentProfile.number_of_kids} kid(s) (±1)`
                    : 'Set in profile'}
                  enabled={filters.numberOfKids}
                  onToggle={() => toggleFilter('numberOfKids')}
                  disabled={!currentProfile?.number_of_kids}
                />

                <FilterToggle
                  label="🗣️ Language"
                  description={currentProfile?.preferred_language || 'Set in profile'}
                  enabled={filters.language}
                  onToggle={() => toggleFilter('language')}
                  disabled={!currentProfile?.preferred_language}
                />

                <FilterToggle
                  label="💭 Parenting Style"
                  description={currentProfile?.parenting_style || 'Set in profile'}
                  enabled={filters.parentingStyle}
                  onToggle={() => toggleFilter('parentingStyle')}
                  disabled={!currentProfile?.parenting_style}
                />

                <FilterToggle
                  label="🤝 Services Offered"
                  description={currentProfile?.services_offered?.length > 0
                    ? `Moms offering what you need`
                    : 'Select services in profile'}
                  enabled={filters.servicesOffered}
                  onToggle={() => toggleFilter('servicesOffered')}
                  disabled={!currentProfile?.services_needed?.length}
                />

                <FilterToggle
                  label="🙏 Services Needed"
                  description={currentProfile?.services_needed?.length > 0
                    ? `Moms needing your help`
                    : 'Select services in profile'}
                  enabled={filters.servicesNeeded}
                  onToggle={() => toggleFilter('servicesNeeded')}
                  disabled={!currentProfile?.services_offered?.length}
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
            {!currentProfile?.city || !currentProfile?.state ? (
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
                  {currentProfile.city}, {currentProfile.state}!
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
  
  async function handleConnect() {
    try {
      // Create conversation ID
      const conversationId = [currentUserId, mom.id].sort().join('_');
      
      // Get current user's info for the other person's conversation
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const currentUserMetadata = currentUser?.user_metadata;

      // Get or create conversations for both users
      const currentUserKey = `conversations_${currentUserId}`;
      const otherUserKey = `conversations_${mom.id}`;

      // Add conversation for current user
      const currentConvs = JSON.parse(localStorage.getItem(currentUserKey) || '[]');
      if (!currentConvs.find((c: Conversation) => c.id === conversationId)) {
        currentConvs.unshift({
          id: conversationId,
          other_user_id: mom.id,
          other_user_name: metadata?.full_name || 'Mom',
          other_user_photo: metadata?.profile_photo_url,
          last_message: 'Conversation started',
          last_message_time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        });
        localStorage.setItem(currentUserKey, JSON.stringify(currentConvs));
      }

      // Add conversation for other user
      const otherConvs = JSON.parse(localStorage.getItem(otherUserKey) || '[]');
      if (!otherConvs.find((c: Conversation) => c.id === conversationId)) {
        otherConvs.unshift({
          id: conversationId,
          other_user_id: currentUserId,
          other_user_name: currentUserMetadata?.full_name || 'Mom',
          other_user_photo: currentUserMetadata?.profile_photo_url,
          last_message: 'Conversation started',
          last_message_time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        });
        localStorage.setItem(otherUserKey, JSON.stringify(otherConvs));
      }

      // Navigate to messages page
      router.push('/messages');
    } catch (error) {
      console.error('Error connecting:', error);
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
          
          <button
            onClick={handleConnect}
            className="mt-4 w-full px-4 py-2 bg-pink-600 text-white rounded-full text-sm font-medium hover:bg-pink-700 transition-colors"
          >
            Connect 💬
          </button>
        </div>
      </div>
    </div>
  );
}
