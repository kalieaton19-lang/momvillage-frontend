"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

interface Service {
  id: string;
  name: string;
  category: 'childcare' | 'household' | 'advice' | 'activities' | 'other';
  emoji: string;
}

interface UserServices {
  id?: string;
  user_id: string;
  services_offered: string[]; // Array of service IDs
  services_needed: string[]; // Array of service IDs
  created_at?: string;
  updated_at?: string;
}

const AVAILABLE_SERVICES: Service[] = [
  { id: 'babysitting', name: 'Babysitting', category: 'childcare', emoji: '👶' },
  { id: 'potty-training', name: 'Potty Training Help', category: 'advice', emoji: '🚽' },
  { id: 'meal-prep', name: 'Meal Prep Help', category: 'household', emoji: '🍳' },
  { id: 'cleaning', name: 'Cleaning Support', category: 'household', emoji: '🧹' },
  { id: 'laundry', name: 'Laundry Help', category: 'household', emoji: '🧺' },
  { id: 'school-pickups', name: 'School Pickups', category: 'activities', emoji: '🚌' },
  { id: 'playdates', name: 'Organize Playdates', category: 'activities', emoji: '🎨' },
  { id: 'workout-buddy', name: 'Workout Buddy', category: 'activities', emoji: '💪' },
  { id: 'sleep-advice', name: 'Sleep Training Advice', category: 'advice', emoji: '😴' },
  { id: 'nutrition', name: 'Nutrition Advice', category: 'advice', emoji: '🥗' },
  { id: 'parenting-support', name: 'General Parenting Support', category: 'advice', emoji: '❤️' },
  { id: 'emergency-help', name: 'Emergency Support', category: 'other', emoji: '🆘' },
];

export default function ServicesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [offeredServices, setOfferedServices] = useState<string[]>([]);
  const [neededServices, setNeededServices] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
      await loadUserServices(session.user.id);
    } catch (error) {
      console.error('Error checking user:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  async function loadUserServices(userId: string) {
    try {
      // Try to load from user_metadata first
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (currentUser?.user_metadata?.services_offered) {
        setOfferedServices(currentUser.user_metadata.services_offered);
      }
      
      if (currentUser?.user_metadata?.services_needed) {
        setNeededServices(currentUser.user_metadata.services_needed);
      }
    } catch (error) {
      console.error('Error loading user services:', error);
    }
  }

  async function saveServices() {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          services_offered: offeredServices,
          services_needed: neededServices,
        }
      });

      if (error) {
        console.error('Error saving services:', error);
        alert('Failed to save services. Please try again.');
        return;
      }

      setSaved(true);
      setTimeout(() => {
        router.push('/my-services');
      }, 1000);
    } catch (error) {
      console.error('Error saving services:', error);
      alert('Failed to save services. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function toggleOfferedService(serviceId: string) {
    setOfferedServices(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  }

  function toggleNeededService(serviceId: string) {
    setNeededServices(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  }

  function getServicesByCategory(category: string) {
    return AVAILABLE_SERVICES.filter(s => s.category === category);
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
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Services 🤝</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Share what you can offer and what you need help with
              </p>
            </div>
            <Link href="/home" className="text-sm text-pink-600 dark:text-pink-400 hover:underline">
              Back to Home
            </Link>
          </div>

          {saved && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-700 dark:text-green-300">
              ✓ Services saved successfully!
            </div>
          )}
        </header>

        <div className="space-y-8">
          {/* Services Offered Section */}
          <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">
              Services I Offer 💪
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              Select the services you're happy to provide to other moms in your village
            </p>

            {/* Childcare Section */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">👶 Childcare</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {getServicesByCategory('childcare').map(service => (
                  <button
                    key={service.id}
                    onClick={() => toggleOfferedService(service.id)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      offeredServices.includes(service.id)
                        ? 'bg-pink-50 dark:bg-pink-900/20 border-pink-500'
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-pink-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">{service.emoji}</div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{service.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Household Section */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">🏠 Household</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {getServicesByCategory('household').map(service => (
                  <button
                    key={service.id}
                    onClick={() => toggleOfferedService(service.id)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      offeredServices.includes(service.id)
                        ? 'bg-pink-50 dark:bg-pink-900/20 border-pink-500'
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-pink-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">{service.emoji}</div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{service.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Advice Section */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">💡 Advice & Support</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {getServicesByCategory('advice').map(service => (
                  <button
                    key={service.id}
                    onClick={() => toggleOfferedService(service.id)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      offeredServices.includes(service.id)
                        ? 'bg-pink-50 dark:bg-pink-900/20 border-pink-500'
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-pink-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">{service.emoji}</div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{service.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Activities Section */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">🎯 Activities</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {getServicesByCategory('activities').map(service => (
                  <button
                    key={service.id}
                    onClick={() => toggleOfferedService(service.id)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      offeredServices.includes(service.id)
                        ? 'bg-pink-50 dark:bg-pink-900/20 border-pink-500'
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-pink-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">{service.emoji}</div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{service.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Other Section */}
            <div>
              <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">🌟 Other</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {getServicesByCategory('other').map(service => (
                  <button
                    key={service.id}
                    onClick={() => toggleOfferedService(service.id)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      offeredServices.includes(service.id)
                        ? 'bg-pink-50 dark:bg-pink-900/20 border-pink-500'
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-pink-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">{service.emoji}</div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{service.name}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
              Selected: {offeredServices.length} service{offeredServices.length !== 1 ? 's' : ''}
            </div>
          </section>

          {/* Services Needed Section */}
          <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">
              Services I Need 🙏
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              Select the services you'd like help with from other moms
            </p>

            {/* Childcare Section */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">👶 Childcare</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {getServicesByCategory('childcare').map(service => (
                  <button
                    key={service.id}
                    onClick={() => toggleNeededService(service.id)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      neededServices.includes(service.id)
                        ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-500'
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-purple-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">{service.emoji}</div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{service.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Household Section */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">🏠 Household</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {getServicesByCategory('household').map(service => (
                  <button
                    key={service.id}
                    onClick={() => toggleNeededService(service.id)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      neededServices.includes(service.id)
                        ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-500'
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-purple-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">{service.emoji}</div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{service.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Advice Section */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">💡 Advice & Support</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {getServicesByCategory('advice').map(service => (
                  <button
                    key={service.id}
                    onClick={() => toggleNeededService(service.id)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      neededServices.includes(service.id)
                        ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-500'
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-purple-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">{service.emoji}</div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{service.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Activities Section */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">🎯 Activities</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {getServicesByCategory('activities').map(service => (
                  <button
                    key={service.id}
                    onClick={() => toggleNeededService(service.id)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      neededServices.includes(service.id)
                        ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-500'
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-purple-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">{service.emoji}</div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{service.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Other Section */}
            <div>
              <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">🌟 Other</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {getServicesByCategory('other').map(service => (
                  <button
                    key={service.id}
                    onClick={() => toggleNeededService(service.id)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      neededServices.includes(service.id)
                        ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-500'
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-purple-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">{service.emoji}</div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{service.name}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
              Selected: {neededServices.length} service{neededServices.length !== 1 ? 's' : ''}
            </div>
          </section>

          {/* Save Button */}
          <div className="flex gap-3">
            <button
              onClick={saveServices}
              disabled={saving}
              className="flex-1 px-6 py-3 bg-pink-600 text-white rounded-full font-medium hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Services'}
            </button>
            <Link
              href="/home"
              className="px-6 py-3 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-full font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
