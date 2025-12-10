"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AvailabilityToggle from "@/app/components/AvailabilityToggle";
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
    availability?: Record<string, Array<{ start: string; end: string }>>;
    weeklyAvailability?: Record<string, Array<{ start: string; end: string }>>;
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
  availability: boolean;
}

export default function FindMomsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [moms, setMoms] = useState<MomProfile[]>([]);
  const [filteredMoms, setFilteredMoms] = useState<MomProfile[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    location: true,
    kidsAgeGroups: false,
    numberOfKids: false,
    language: false,
    parentingStyle: false,
    servicesOffered: false,
    servicesNeeded: false,
    availability: false,
  });
  const [searchRadius, setSearchRadius] = useState<number>(10); // miles
  const [showAll, setShowAll] = useState<boolean>(false);
  const [relaxationNote, setRelaxationNote] = useState<string>("");

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
      console.log('Loading moms from backend API...');

      const res = await fetch('/api/supabase/users', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json?.error) {
        setLoadError(json?.error || `Failed to load users (status ${res.status})`);
      } else {
        setLoadError(null);
      }
      const users = (json?.users || []) as Array<{ id: string; email?: string | null; user_metadata?: Record<string, any> | null }>;

      const otherMoms: MomProfile[] = users
        .filter((u) => u.id !== user?.id)
        .map((u) => ({
          id: u.id,
          email: u.email ?? undefined,
          user_metadata: (u.user_metadata || undefined) as any,
        }));

      setMoms(otherMoms);
      applyFilters();
    } catch (error) {
      console.error('Error loading moms:', error);
      setMoms([]);
      setFilteredMoms([]);
      setLoadError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  function applyFilters() {
    if (!currentProfile) return;

    // Show all bypass
    if (showAll) {
      setFilteredMoms(moms);
      setRelaxationNote("");
      return;
    }

    let filtered = [...moms];

    // Helpers: normalize city/state for robust matching
    const normalizeCity = (s: any) => String(s || '').trim().toLowerCase()
      .replace(/\./g, '')
      .replace(/\s+/g, ' ')
      .replace(/^st\s+/,'saint ');
    const STATE_MAP: Record<string,string> = {
      'alabama':'al','al':'al','alaska':'ak','ak':'ak','arizona':'az','az':'az','arkansas':'ar','ar':'ar',
      'california':'ca','ca':'ca','colorado':'co','co':'co','connecticut':'ct','ct':'ct','delaware':'de','de':'de',
      'florida':'fl','fl':'fl','georgia':'ga','ga':'ga','hawaii':'hi','hi':'hi','idaho':'id','id':'id','illinois':'il','il':'il',
      'indiana':'in','in':'in','iowa':'ia','ia':'ia','kansas':'ks','ks':'ks','kentucky':'ky','ky':'ky','louisiana':'la','la':'la',
      'maine':'me','me':'me','maryland':'md','md':'md','massachusetts':'ma','ma':'ma','michigan':'mi','mi':'mi','minnesota':'mn','mn':'mn',
      'mississippi':'ms','ms':'ms','missouri':'mo','mo':'mo','montana':'mt','mt':'mt','nebraska':'ne','ne':'ne','nevada':'nv','nv':'nv',
      'new hampshire':'nh','nh':'nh','new jersey':'nj','nj':'nj','new mexico':'nm','nm':'nm','new york':'ny','ny':'ny',
      'north carolina':'nc','nc':'nc','north dakota':'nd','nd':'nd','ohio':'oh','oh':'oh','oklahoma':'ok','ok':'ok','oregon':'or','or':'or',
      'pennsylvania':'pa','pa':'pa','rhode island':'ri','ri':'ri','south carolina':'sc','sc':'sc','south dakota':'sd','sd':'sd',
      'tennessee':'tn','tn':'tn','texas':'tx','tx':'tx','utah':'ut','ut':'ut','vermont':'vt','vt':'vt','virginia':'va','va':'va',
      'washington':'wa','wa':'wa','west virginia':'wv','wv':'wv','wisconsin':'wi','wi':'wi','wyoming':'wy','wy':'wy'
    };
    const normalizeState = (s: any) => STATE_MAP[String(s || '').trim().toLowerCase()] || String(s || '').trim().toLowerCase();

    // Location handling
    // - If location filter is ON: prefer exact city+state match; fallback to zip match; or nearby proxy by zip prefix
    // - If location filter is OFF but any other filter is ON: require exact state match (case-insensitive)
    const otherFiltersActive = (
      filters.kidsAgeGroups ||
      filters.numberOfKids ||
      filters.language ||
      filters.parentingStyle ||
      filters.servicesOffered ||
      filters.servicesNeeded ||
      filters.availability
    );

    const currentZip = String(currentProfile.zip_code || '').trim();
    const zip3 = currentZip.slice(0,3);

    if (filters.location && (currentProfile.city && currentProfile.state)) {
      const city = normalizeCity(currentProfile.city);
      const state = normalizeState(currentProfile.state);
      let cityState = filtered.filter(mom => 
        normalizeCity(mom.user_metadata?.city) === city &&
        normalizeState(mom.user_metadata?.state) === state
      );
      // Fallback: zip-code exact match when available and city/state yields none
      if (cityState.length === 0 && currentZip) {
        cityState = filtered.filter(mom => String(mom.user_metadata?.zip_code || '').trim() === currentZip);
      }
      // Nearby proxy based on searchRadius:
      // <= 5mi: require exact ZIP
      // <= 15mi: ZIP3 prefix within same state
      // > 15mi: state-only
      if (cityState.length === 0 && currentProfile.state) {
        if (searchRadius <= 5 && currentZip) {
          cityState = filtered.filter(mom => String(mom.user_metadata?.zip_code || '').trim() === currentZip);
        } else if (searchRadius <= 15 && zip3) {
          cityState = filtered.filter(mom => {
            const momState = normalizeState(mom.user_metadata?.state);
            const momZip3 = String(mom.user_metadata?.zip_code || '').trim().slice(0,3);
            return momState === state && momZip3 && momZip3 === zip3;
          });
        } else {
          cityState = filtered.filter(mom => normalizeState(mom.user_metadata?.state) === state);
        }
      }
      filtered = cityState;
    } else if (!filters.location && otherFiltersActive && currentProfile.state) {
      const state = normalizeState(currentProfile.state);
      filtered = filtered.filter(mom => 
        normalizeState(mom.user_metadata?.state) === state
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

    // Filter by language (case-insensitive)
    if (filters.language && currentProfile.preferred_language) {
      const lang = String(currentProfile.preferred_language).trim().toLowerCase();
      filtered = filtered.filter(mom => 
        String(mom.user_metadata?.preferred_language || '').trim().toLowerCase() === lang
      );
    }

    // Filter by parenting style (case-insensitive)
    if (filters.parentingStyle && currentProfile.parenting_style) {
      const style = String(currentProfile.parenting_style).trim().toLowerCase();
      filtered = filtered.filter(mom => 
        String(mom.user_metadata?.parenting_style || '').trim().toLowerCase() === style
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

    // Filter by availability (only moms who have set any availability)
    if (filters.availability) {
      filtered = filtered.filter(mom => {
        const a = mom.user_metadata?.availability;
        const w = mom.user_metadata?.weeklyAvailability;
        const hasSpecific = a && typeof a === 'object' && Object.values(a).some(arr => Array.isArray(arr) && arr.length > 0);
        const hasWeekly = w && typeof w === 'object' && Object.values(w).some(arr => Array.isArray(arr) && arr.length > 0);
        return Boolean(hasSpecific || hasWeekly);
      });
    }

    // Auto-relaxation flow if no results: stepwise broaden
    if (filtered.length === 0) {
      // Step 1: if location ON, relax to state-only match
      let relaxed = [...moms];
      let note = "";
      const hasState = !!currentProfile.state;
      const hasCity = !!currentProfile.city;
      const otherOn = otherFiltersActive;

      if (filters.location && hasState) {
        const state = normalizeState(currentProfile.state);
        const currentZip = String(currentProfile.zip_code || '').trim();
        const zip3 = currentZip.slice(0,3);
        // Use searchRadius to decide relaxation tier
        let tmp: typeof relaxed = [];
        if (searchRadius <= 5 && currentZip) {
          tmp = relaxed.filter(mom => String(mom.user_metadata?.zip_code || '').trim() === currentZip);
          if (tmp.length > 0) {
            relaxed = tmp;
            note = "Relaxed to exact ZIP";
          }
        }
        if (!tmp.length && searchRadius <= 15 && zip3) {
          tmp = relaxed.filter(mom => {
            const momState = normalizeState(mom.user_metadata?.state);
            const momZip3 = String(mom.user_metadata?.zip_code || '').trim().slice(0,3);
            return momState === state && momZip3 && momZip3 === zip3;
          });
          if (tmp.length > 0) {
            relaxed = tmp;
            note = "Relaxed to nearby ZIP prefix";
          }
        }
        if (!tmp.length) {
          relaxed = relaxed.filter(mom => normalizeState(mom.user_metadata?.state) === state);
          note = "Relaxed to state-only";
        }
      }

      // Step 2: if still none, drop services filters
      if (relaxed.length === 0) {
        let tmp = [...moms];
        if (filters.location && hasState) {
          const state = normalizeState(currentProfile.state);
          tmp = tmp.filter(mom => normalizeState(mom.user_metadata?.state) === state);
        }
        note = note || "Relaxed by dropping services filters";
        relaxed = tmp;
      }

      // Step 3: if still none, drop kids/language/style
      if (relaxed.length === 0) {
        let tmp = [...moms];
        if (filters.location && hasState) {
          const state = normalizeState(currentProfile.state);
          tmp = tmp.filter(mom => normalizeState(mom.user_metadata?.state) === state);
        }
        note = note || "Relaxed by dropping kids/language/style";
        relaxed = tmp;
      }

      // Step 4: show all
      if (relaxed.length === 0) {
        relaxed = moms;
        note = note || "Showing all moms (no filters)";
      }

      setRelaxationNote(note);
      setFilteredMoms(relaxed);
      return;
    }

    setRelaxationNote("");
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
                  label="👀 Show All"
                  description="Bypass filters and show everyone"
                  enabled={showAll}
                  onToggle={() => setShowAll(!showAll)}
                />
                {/* Nearby radius control (affects location fallback logic) */}
                <div className="w-full p-3 rounded-lg border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">📏 Nearby Radius</span>
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">{searchRadius} mi</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={50}
                    step={5}
                    value={searchRadius}
                    onChange={(e) => setSearchRadius(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    ≤5mi: exact ZIP, ≤15mi: ZIP3 prefix, >15mi: state-only
                  </div>
                </div>
                <FilterToggle
                  label="📍 Same Location"
                  description={currentProfile?.city && currentProfile?.state 
                    ? `${currentProfile.city}, ${currentProfile.state}` 
                    : 'Set your location in profile'}
                  enabled={filters.location}
                  onToggle={() => toggleFilter('location')}
                  disabled={!currentProfile?.city || !currentProfile?.state}
                />

                <AvailabilityToggle
                  enabled={filters.availability}
                  onToggle={() => toggleFilter('availability')}
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
                    availability: false,
                  })}
                  className="text-sm text-pink-600 dark:text-pink-400 hover:underline"
                >
                  Clear All Filters
                </button>
                {relaxationNote && (
                  <div className="mt-2 text-xs text-blue-700 dark:text-blue-300">{relaxationNote}</div>
                )}

                {/* Debug info to help diagnose empty results */}
                <div className="mt-4 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50 dark:bg-zinc-800/40">
                  <div className="font-medium text-zinc-700 dark:text-zinc-300 mb-1">Debug</div>
                  <div className="text-zinc-600 dark:text-zinc-400">Profile: {currentProfile?.city || '-'}, {currentProfile?.state || '-'}</div>
                  <div className="text-zinc-600 dark:text-zinc-400">Fetched: {moms.length}</div>
                  <div className="text-zinc-600 dark:text-zinc-400">Visible: {filteredMoms.length}</div>
                  {/* Quick diagnostics for location matching */}
                  {currentProfile?.city && currentProfile?.state && moms.length > 0 && (
                    <div className="mt-1 text-zinc-600 dark:text-zinc-400">
                      {(() => {
                        const nCity = (s: any) => String(s || '').trim().toLowerCase().replace(/\./g,'').replace(/\s+/g,' ').replace(/^st\s+/,'saint ');
                        const STATE_MAP: Record<string,string> = {
                          'alabama':'al','al':'al','alaska':'ak','ak':'ak','arizona':'az','az':'az','arkansas':'ar','ar':'ar',
                          'california':'ca','ca':'ca','colorado':'co','co':'co','connecticut':'ct','ct':'ct','delaware':'de','de':'de',
                          'florida':'fl','fl':'fl','georgia':'ga','ga':'ga','hawaii':'hi','hi':'hi','idaho':'id','id':'id','illinois':'il','il':'il',
                          'indiana':'in','in':'in','iowa':'ia','ia':'ia','kansas':'ks','ks':'ks','kentucky':'ky','ky':'ky','louisiana':'la','la':'la',
                          'maine':'me','me':'me','maryland':'md','md':'md','massachusetts':'ma','ma':'ma','michigan':'mi','mi':'mi','minnesota':'mn','mn':'mn',
                          'mississippi':'ms','ms':'ms','missouri':'mo','mo':'mo','montana':'mt','mt':'mt','nebraska':'ne','ne':'ne','nevada':'nv','nv':'nv',
                          'new hampshire':'nh','nh':'nh','new jersey':'nj','nj':'nj','new mexico':'nm','nm':'nm','new york':'ny','ny':'ny',
                          'north carolina':'nc','nc':'nc','north dakota':'nd','nd':'nd','ohio':'oh','oh':'oh','oklahoma':'ok','ok':'ok','oregon':'or','or':'or',
                          'pennsylvania':'pa','pa':'pa','rhode island':'ri','ri':'ri','south carolina':'sc','sc':'sc','south dakota':'sd','sd':'sd',
                          'tennessee':'tn','tn':'tn','texas':'tx','tx':'tx','utah':'ut','ut':'ut','vermont':'vt','vt':'vt','virginia':'va','va':'va',
                          'washington':'wa','wa':'wa','west virginia':'wv','wv':'wv','wisconsin':'wi','wi':'wi','wyoming':'wy','wy':'wy'
                        };
                        const nState = (s: any) => STATE_MAP[String(s || '').trim().toLowerCase()] || String(s || '').trim().toLowerCase();
                        const cCity = nCity(currentProfile.city);
                        const cState = nState(currentProfile.state);
                        const cityStateMatches = moms.filter(m => nCity(m.user_metadata?.city) === cCity && nState(m.user_metadata?.state) === cState).length;
                        const stateOnlyMatches = moms.filter(m => nState(m.user_metadata?.state) === cState).length;
                        return (
                          <>
                            <div>City+State matches (normalized): {cityStateMatches}</div>
                            <div>State-only matches (normalized): {stateOnlyMatches}</div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                  {loadError && (
                    <div className="mt-2 text-red-600 dark:text-red-400">API error: {loadError}</div>
                  )}
                  {/* Show first 5 candidates with city/state (normalized) to diagnose */}
                  {moms.length > 0 && (
                    <div className="mt-2">
                      <div className="text-zinc-700 dark:text-zinc-300 font-medium mb-1">Sample candidates (city/state)</div>
                      <ul className="space-y-1">
                        {moms.slice(0,5).map((m) => (
                          <li key={m.id} className="text-zinc-600 dark:text-zinc-400">
                            {(m.user_metadata?.full_name || 'Mom')}: {(m.user_metadata?.city || '-')}, {(m.user_metadata?.state || '-')}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Results Grid */}
          <div className="lg:col-span-3">
            {/* Top controls for mobile/visibility */}
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={() => setShowAll(!showAll)}
                className={`px-3 py-2 rounded-full text-sm font-medium border ${showAll ? 'bg-pink-600 text-white border-pink-700' : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'}`}
              >
                {showAll ? 'Showing All Moms' : '👀 Show All'}
              </button>
              {relaxationNote && (
                <span className="text-xs text-blue-700 dark:text-blue-300">{relaxationNote}</span>
              )}
            </div>
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
                {loadError ? (
                  <p className="text-red-600 dark:text-red-400 mb-6 max-w-md mx-auto">
                    Couldn’t load moms: {loadError}. If you’re running locally, make sure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in `.env.local`.
                  </p>
                ) : (
                  <p className="text-zinc-600 dark:text-zinc-400 mb-6 max-w-md mx-auto">
                    No matches yet for {currentProfile.city}, {currentProfile.state}. Try turning off the location filter or enabling another filter.
                  </p>
                )}
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
                  <MomCard key={mom.id} mom={mom} currentUserId={user?.id} currentProfile={currentProfile} />
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
  currentProfile: any;
}

function MomCard({ mom, currentUserId, currentProfile }: MomCardProps) {
  const router = useRouter();
  const metadata = mom.user_metadata;
  const normCity = (s: any) => String(s || '').trim().toLowerCase().replace(/\./g,'').replace(/\s+/g,' ').replace(/^st\s+/,'saint ');
  const STATE_MAP: Record<string,string> = {
    'alabama':'al','al':'al','alaska':'ak','ak':'ak','arizona':'az','az':'az','arkansas':'ar','ar':'ar',
    'california':'ca','ca':'ca','colorado':'co','co':'co','connecticut':'ct','ct':'ct','delaware':'de','de':'de',
    'florida':'fl','fl':'fl','georgia':'ga','ga':'ga','hawaii':'hi','hi':'hi','idaho':'id','id':'id','illinois':'il','il':'il',
    'indiana':'in','in':'in','iowa':'ia','ia':'ia','kansas':'ks','ks':'ks','kentucky':'ky','ky':'ky','louisiana':'la','la':'la',
    'maine':'me','me':'me','maryland':'md','md':'md','massachusetts':'ma','ma':'ma','michigan':'mi','mi':'mi','minnesota':'mn','mn':'mn',
    'mississippi':'ms','ms':'ms','missouri':'mo','mo':'mo','montana':'mt','mt':'mt','nebraska':'ne','ne':'ne','nevada':'nv','nv':'nv',
    'new hampshire':'nh','nh':'nh','new jersey':'nj','nj':'nj','new mexico':'nm','nm':'nm','new york':'ny','ny':'ny',
    'north carolina':'nc','nc':'nc','north dakota':'nd','nd':'nd','ohio':'oh','oh':'oh','oklahoma':'ok','ok':'ok','oregon':'or','or':'or',
    'pennsylvania':'pa','pa':'pa','rhode island':'ri','ri':'ri','south carolina':'sc','sc':'sc','south dakota':'sd','sd':'sd',
    'tennessee':'tn','tn':'tn','texas':'tx','tx':'tx','utah':'ut','ut':'ut','vermont':'vt','vt':'vt','virginia':'va','va':'va',
    'washington':'wa','wa':'wa','west virginia':'wv','wv':'wv','wisconsin':'wi','wi':'wi','wyoming':'wy','wy':'wy'
  };
  const normState = (s: any) => STATE_MAP[String(s || '').trim().toLowerCase()] || String(s || '').trim().toLowerCase();
  // Determine match type badge
  const currentZip = String(currentProfile?.zip_code || '').trim();
  const momZip = String(metadata?.zip_code || '').trim();
  const zip3 = currentZip.slice(0,3);
  const momZip3 = momZip.slice(0,3);
  const yourCity = normCity(currentProfile?.city);
  const yourState = normState(currentProfile?.state);
  const momCity = normCity(metadata?.city);
  const momState = normState(metadata?.state);
  let matchBadge: string | null = null;
  if (yourCity && momCity && yourState && momState && yourCity === momCity && yourState === momState) {
    matchBadge = 'Exact City+State';
  } else if (currentZip && momZip && currentZip === momZip) {
    matchBadge = 'Exact ZIP';
  } else if (zip3 && momZip3 && yourState && momState && yourState === momState && zip3 === momZip3) {
    matchBadge = 'Nearby (ZIP3)';
  } else if (yourState && momState && yourState === momState) {
    matchBadge = 'Same State';
  }
  
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
          {matchBadge && (
            <span className="mt-1 inline-block text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
              {matchBadge}
            </span>
          )}
          {/* Reasons inspector */}
          {currentProfile && (
            <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              <div>Your: {currentProfile?.city || '-'}, {currentProfile?.state || '-'}</div>
              <div>Mom: {metadata?.city || '-'}, {metadata?.state || '-'}</div>
              <div>Norm: your({normCity(currentProfile?.city)} / {normState(currentProfile?.state)}), mom({normCity(metadata?.city)} / {normState(metadata?.state)})</div>
            </div>
          )}
          
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
