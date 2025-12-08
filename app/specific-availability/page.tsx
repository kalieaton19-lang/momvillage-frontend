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

export default function SpecificAvailabilityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [availability, setAvailability] = useState<Record<string, TimeSlot[]>>({});
  const [originalAvailability, setOriginalAvailability] = useState<Record<string, TimeSlot[]>>({});
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const commonSlots = [
    { label: "Morning (9am-12pm)", start: "09:00", end: "12:00" },
    { label: "Afternoon (12pm-3pm)", start: "12:00", end: "15:00" },
    { label: "Late Afternoon (3pm-6pm)", start: "15:00", end: "18:00" },
    { label: "Evening (6pm-9pm)", start: "18:00", end: "21:00" },
  ];

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
      if (currentUser?.user_metadata?.availability) {
        setAvailability(currentUser.user_metadata.availability);
        setOriginalAvailability(currentUser.user_metadata.availability);
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
          availability
        }
      });

      if (error) {
        setMessage(`Error: ${error.message}`);
      } else {
        setMessage("Availability saved successfully!");
        setOriginalAvailability(availability);
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

  function hasChanges(): boolean {
    const currentStr = JSON.stringify(availability);
    const originalStr = JSON.stringify(originalAvailability);
    return currentStr !== originalStr;
  }

  function toggleAvailabilitySlot(date: string, slot: TimeSlot) {
    if (availability[date]?.find(s => s.start === slot.start && s.end === slot.end)) {
      setAvailability(prev => ({
        ...prev,
        [date]: prev[date].filter(s => !(s.start === slot.start && s.end === slot.end))
      }));
    } else {
      setAvailability(prev => ({
        ...prev,
        [date]: [...(prev[date] || []), slot]
      }));
    }
  }

  function selectAllDay(date: string) {
    setAvailability(prev => ({
      ...prev,
      [date]: commonSlots.map(slot => ({ id: slot.start, start: slot.start, end: slot.end }))
    }));
  }

  function clearDay(date: string) {
    setAvailability(prev => ({
      ...prev,
      [date]: []
    }));
  }

  function getDaysInMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  function getFirstDayOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Specific Date Availability 📍</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Set your availability for individual dates
              </p>
            </div>
            <Link href="/calendar" className="text-sm text-pink-600 dark:text-pink-400 hover:underline">
              Back to Calendar
            </Link>
          </div>
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
            💡 Click on dates in the calendar to select them, then set your available time slots. You can select multiple dates and manage them all here.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {monthName}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  className="px-3 py-1 bg-zinc-200 dark:bg-zinc-800 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700"
                >
                  ←
                </button>
                <button
                  onClick={() => setCurrentMonth(new Date())}
                  className="px-3 py-1 bg-zinc-200 dark:bg-zinc-800 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700 text-sm"
                >
                  Today
                </button>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  className="px-3 py-1 bg-zinc-200 dark:bg-zinc-800 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700"
                >
                  →
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center font-semibold text-sm text-zinc-600 dark:text-zinc-400 py-2">
                  {day}
                </div>
              ))}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {calendarDays.map(day => {
                const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isSelected = selectedDate === dateStr;
                const hasSlots = availability[dateStr]?.length > 0;
                
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                      isSelected
                        ? 'bg-pink-100 dark:bg-pink-900/30 border-pink-300 dark:border-pink-700'
                        : hasSlots
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-pink-300 dark:hover:border-pink-700'
                    }`}
                  >
                    <div className="text-zinc-900 dark:text-zinc-50">{day}</div>
                    {hasSlots && <div className="text-xs text-green-600 dark:text-green-400 mt-1">✓</div>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Slot Selector */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 h-fit sticky top-6">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              📅 Time Slots
            </h3>
            
            {selectedDate ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3 font-medium">
                    Selected: {selectedDate}
                  </p>
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => selectAllDay(selectedDate)}
                      className="flex-1 text-xs px-2 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors font-medium"
                    >
                      All Day
                    </button>
                    <button
                      onClick={() => clearDay(selectedDate)}
                      className="flex-1 text-xs px-2 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors font-medium"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {commonSlots.map(slot => (
                    <button
                      key={`${selectedDate}-${slot.start}`}
                      onClick={() => toggleAvailabilitySlot(selectedDate, { id: slot.start, start: slot.start, end: slot.end })}
                      className={`w-full text-left p-3 rounded-lg text-sm font-medium transition-all border ${
                        availability[selectedDate]?.find(s => s.start === slot.start)
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-green-300 dark:hover:border-green-700'
                      }`}
                    >
                      {availability[selectedDate]?.find(s => s.start === slot.start) && '✓ '}{slot.label}
                    </button>
                  ))}
                </div>

                {availability[selectedDate]?.length > 0 && (
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                    <p className="text-xs text-green-700 dark:text-green-300 font-medium">
                      {availability[selectedDate].length} slot{availability[selectedDate].length !== 1 ? 's' : ''} selected for this date
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Click on a date in the calendar to set availability
              </p>
            )}
          </div>
        </div>

        {/* Summary */}
        {Object.keys(availability).length > 0 && (
          <div className="mt-8 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/10 dark:to-purple-900/10 border border-pink-200 dark:border-pink-800 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
              📊 Availability Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(availability)
                .filter(([_, slots]) => slots.length > 0)
                .sort()
                .map(([date, slots]) => (
                  <div key={date} className="text-sm text-zinc-700 dark:text-zinc-300">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">{date}:</span> {slots.length} slot{slots.length !== 1 ? 's' : ''}
                  </div>
                ))}
            </div>
            <div className="mt-4 pt-4 border-t border-pink-200 dark:border-pink-700">
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                Total dates with availability: <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {Object.values(availability).filter(slots => slots.length > 0).length}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges()}
          className="w-full mt-8 px-6 py-4 bg-pink-600 text-white rounded-full font-semibold hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg"
        >
          {saving ? 'Saving...' : '💾 Save Availability'}
        </button>
      </div>
    </div>
  );
}
