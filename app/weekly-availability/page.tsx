"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

interface TimeSlot {
  id: string;
  start: string;
  end: string;
}

interface WeeklyAvailability {
  [day: string]: TimeSlot[];
}

export default function WeeklyAvailabilityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklyAvailability>({});
  const [originalWeeklyAvailability, setOriginalWeeklyAvailability] = useState<WeeklyAvailability>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const commonSlots = [
    { label: "Morning (9am-12pm)", start: "09:00", end: "12:00" },
    { label: "Afternoon (12pm-3pm)", start: "12:00", end: "15:00" },
    { label: "Late Afternoon (3pm-6pm)", start: "15:00", end: "18:00" },
    { label: "Evening (6pm-9pm)", start: "18:00", end: "21:00" },
  ];

  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
      await loadAvailability();
    } catch (error) {
      console.error('Error checking user:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  async function loadAvailability() {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser?.user_metadata?.weeklyAvailability) {
        setWeeklyAvailability(currentUser.user_metadata.weeklyAvailability);
        setOriginalWeeklyAvailability(currentUser.user_metadata.weeklyAvailability);
      }
    } catch (error) {
      console.error('Error loading availability:', error);
    }
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.updateUser({
        data: { 
          weeklyAvailability
        }
      });

      if (error) {
        setMessage(`Error: ${error.message}`);
      } else {
        setMessage("Weekly availability saved successfully!");
        // Redirect back to calendar after successful save
        setTimeout(() => {
          setMessage("");
          router.push('/calendar');
        }, 800);
      }
    } catch (error) {
      console.error('Error saving:', error);
      setMessage("Failed to save availability");
    } finally {
      setSaving(false);
    }
  }

  function toggleWeeklySlot(day: string, slot: TimeSlot) {
    if (weeklyAvailability[day]?.find(s => s.start === slot.start && s.end === slot.end)) {
      setWeeklyAvailability(prev => ({
        ...prev,
        [day]: prev[day].filter(s => !(s.start === slot.start && s.end === slot.end))
      }));
    } else {
      setWeeklyAvailability(prev => ({
        ...prev,
        [day]: [...(prev[day] || []), slot]
      }));
    }
  }

  function selectAllDay(day: string) {
    setWeeklyAvailability(prev => ({
      ...prev,
      [day]: commonSlots.map(slot => ({ id: slot.start, start: slot.start, end: slot.end }))
    }));
  }

  function clearDay(day: string) {
    setWeeklyAvailability(prev => ({
      ...prev,
      [day]: []
    }));
  }

  function isEqualAvailability(a: WeeklyAvailability, b: WeeklyAvailability) {
    try {
      const normalize = (obj: WeeklyAvailability) => {
        const keys = Object.keys(obj).sort();
        const norm: WeeklyAvailability = {};
        keys.forEach(k => {
          const arr = obj[k] || [];
          norm[k] = arr
            .map(s => ({ start: s.start, end: s.end }))
            .sort((x, y) => (x.start + x.end).localeCompare(y.start + y.end)) as any;
        });
        return norm;
      };
      return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
    } catch {
      return false;
    }
  }

  const isDirty = !isEqualAvailability(weeklyAvailability, originalWeeklyAvailability);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Weekly Availability 🔄</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Set your recurring weekly schedule
              </p>
            </div>
            <Link href="/calendar" className="text-sm text-pink-600 dark:text-pink-400 hover:underline">
              Back to Calendar
            </Link>
          </div>
          {isDirty && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs font-medium">
              <span>⚠️ Unsaved changes</span>
            </div>
          )}
        </header>

        {message && (
          <div className={`mb-6 p-4 rounded-lg text-sm font-medium ${
            message.includes('Error') || message.includes('Failed')
              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
          }`}>
            {message}
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 mb-6">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            💡 Select your available time slots for each day of the week. This recurring schedule shows when you're typically available for meetups and activities.
          </p>
        </div>

        {/* Weekly Availability Grid */}
        <div className="space-y-4">
          {weekDays.map(day => (
            <div key={day} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{day}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => selectAllDay(day)}
                    className="text-xs px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors font-medium"
                  >
                    All Day
                  </button>
                  <button
                    onClick={() => clearDay(day)}
                    className="text-xs px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors font-medium"
                  >
                    Clear
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {commonSlots.map(slot => (
                  <button
                    key={`${day}-${slot.start}`}
                    onClick={() => toggleWeeklySlot(day, { id: slot.start, start: slot.start, end: slot.end })}
                    className={`p-3 rounded-lg text-sm font-medium transition-all border ${
                      weeklyAvailability[day]?.find(s => s.start === slot.start)
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-green-300 dark:hover:border-green-700'
                    }`}
                  >
                    {weeklyAvailability[day]?.find(s => s.start === slot.start) && '✓ '}{slot.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-8 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/10 dark:to-purple-900/10 border border-pink-200 dark:border-pink-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
            📊 Your Schedule Summary
          </h3>
          <div className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            {weekDays.map(day => {
              const slotsForDay = weeklyAvailability[day]?.length || 0;
              return (
                <div key={day} className="flex items-center justify-between">
                  <span>{day}</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    {slotsForDay === 0 ? '—' : `${slotsForDay} slot${slotsForDay !== 1 ? 's' : ''}`}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-pink-200 dark:border-pink-700">
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Total available slots: <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                {Object.values(weeklyAvailability).reduce((sum, slots) => sum + (slots?.length || 0), 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="w-full mt-8 px-6 py-4 bg-pink-600 text-white rounded-full font-semibold hover:bg-pink-700 disabled:opacity-50 transition-colors text-lg"
        >
          {saving ? 'Saving...' : isDirty ? '💾 Save Weekly Availability' : 'No changes to save'}
        </button>
      </div>
    </div>
  );
}
