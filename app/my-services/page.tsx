"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

interface Service {
  id: string;
  name: string;
  emoji: string;
}

const AVAILABLE_SERVICES: Service[] = [
  { id: 'babysitting', name: 'Babysitting', emoji: '👶' },
  { id: 'potty-training', name: 'Potty Training Help', emoji: '🚽' },
  { id: 'meal-prep', name: 'Meal Prep Help', emoji: '🍳' },
  { id: 'cleaning', name: 'Cleaning Support', emoji: '🧹' },
  { id: 'laundry', name: 'Laundry Help', emoji: '🧺' },
  { id: 'school-pickups', name: 'School Pickups', emoji: '🚌' },
  { id: 'playdates', name: 'Organize Playdates', emoji: '🎨' },
  { id: 'workout-buddy', name: 'Workout Buddy', emoji: '💪' },
  { id: 'sleep-advice', name: 'Sleep Training Advice', emoji: '😴' },
  { id: 'nutrition', name: 'Nutrition Advice', emoji: '🥗' },
  { id: 'parenting-support', name: 'General Parenting Support', emoji: '❤️' },
  { id: 'emergency-help', name: 'Emergency Support', emoji: '🆘' },
];

export default function MyServicesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [offeredServices, setOfferedServices] = useState<Service[]>([]);
  const [neededServices, setNeededServices] = useState<Service[]>([]);

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
      await loadUserServices();
    } catch (error) {
      console.error('Error checking user:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  async function loadUserServices() {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (currentUser?.user_metadata?.services_offered) {
        const offered = currentUser.user_metadata.services_offered
          .map((id: string) => AVAILABLE_SERVICES.find(s => s.id === id))
          .filter((s: Service | undefined) => s !== undefined) as Service[];
        setOfferedServices(offered);
      }
      
      if (currentUser?.user_metadata?.services_needed) {
        const needed = currentUser.user_metadata.services_needed
          .map((id: string) => AVAILABLE_SERVICES.find(s => s.id === id))
          .filter((s: Service | undefined) => s !== undefined) as Service[];
        setNeededServices(needed);
      }
    } catch (error) {
      console.error('Error loading user services:', error);
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
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">My Services 🤝</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Your skills and the help you're looking for
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/services" className="text-sm text-pink-600 dark:text-pink-400 hover:underline">
                Edit Services
              </Link>
              <span className="text-zinc-400">/</span>
              <Link href="/home" className="text-sm text-pink-600 dark:text-pink-400 hover:underline">
                Back to Home
              </Link>
            </div>
          </div>
        </header>

        <div className="space-y-8">
          {/* Services Offered */}
          <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                Services I Offer 💪
              </h2>
              <span className="text-sm bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 px-3 py-1 rounded-full font-medium">
                {offeredServices.length}
              </span>
            </div>

            {offeredServices.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">🤔</div>
                <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                  You haven't selected any services to offer yet.
                </p>
                <Link
                  href="/services"
                  className="inline-block px-4 py-2 bg-pink-600 text-white rounded-full text-sm font-medium hover:bg-pink-700 transition-colors"
                >
                  Add Services
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {offeredServices.map(service => (
                  <div
                    key={service.id}
                    className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 border border-pink-200 dark:border-pink-700 rounded-lg p-4 text-center"
                  >
                    <div className="text-3xl mb-2">{service.emoji}</div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {service.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Services Needed */}
          <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                Services I Need 🙏
              </h2>
              <span className="text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full font-medium">
                {neededServices.length}
              </span>
            </div>

            {neededServices.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">😊</div>
                <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                  You haven't selected any services you need yet.
                </p>
                <Link
                  href="/services"
                  className="inline-block px-4 py-2 bg-purple-600 text-white rounded-full text-sm font-medium hover:bg-purple-700 transition-colors"
                >
                  Add Services
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {neededServices.map(service => (
                  <div
                    key={service.id}
                    className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4 text-center"
                  >
                    <div className="text-3xl mb-2">{service.emoji}</div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {service.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Summary Section */}
          {(offeredServices.length > 0 || neededServices.length > 0) && (
            <section className="bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/10 dark:to-purple-900/10 border border-pink-200 dark:border-pink-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                💡 Your Service Profile
              </h3>
              <div className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
                {offeredServices.length > 0 && (
                  <p>
                    You're offering <span className="font-semibold text-pink-600 dark:text-pink-400">{offeredServices.length} service{offeredServices.length !== 1 ? 's' : ''}</span> to help other moms in your village.
                  </p>
                )}
                {neededServices.length > 0 && (
                  <p>
                    You're looking for help with <span className="font-semibold text-purple-600 dark:text-purple-400">{neededServices.length} service{neededServices.length !== 1 ? 's' : ''}</span> to make parenting easier.
                  </p>
                )}
                <p className="pt-2 text-zinc-600 dark:text-zinc-400">
                  Other moms can see your services when finding matches nearby, helping everyone connect based on what they can offer and need.
                </p>
              </div>
            </section>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Link
              href="/services"
              className="flex-1 px-6 py-3 bg-pink-600 text-white rounded-full font-medium hover:bg-pink-700 transition-colors text-center"
            >
              Edit Services
            </Link>
            <Link
              href="/find-moms"
              className="flex-1 px-6 py-3 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-full font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-center"
            >
              Find Moms by Services
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
