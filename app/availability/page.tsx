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

interface DayAvailability {
  date: string;
  slots: TimeSlot[];
}

interface WeeklyAvailability {
  [day: string]: TimeSlot[];
}

export default function AvailabilityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availability, setAvailability] = useState<Record<string, TimeSlot[]>>({});
  const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklyAvailability>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedWeekDay, setSelectedWeekDay] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'weekly' | 'specific'>('weekly');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Common time slots
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
      await loadAvailability(session.user.id);
    } catch (error) {
      console.error('Error checking user:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  async function loadAvailability(userId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.availability) {
        setAvailability(user.user_metadata.availability);
      }
      if (user?.user_metadata?.weeklyAvailability) {
        setWeeklyAvailability(user.user_metadata.weeklyAvailability);
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
          availability,
          weeklyAvailability
        }
      });

      if (error) {
        console.error('Save error:', error);
        setMessage(`Error: ${error.message}`);
      } else {
        setMessage("Availability saved successfully!");
        // Reset to view-only mode and switch to calendar view
        setSelectedDate(null);
        setSelectedWeekDay(null);
        setViewMode('specific');
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      console.error('Error saving:', error);
      const errMsg = (error && typeof error === 'object' && 'message' in error) ? (error as Error).message : 'Unknown error';
      setMessage(`Error: ${errMsg}`);
    } finally {
      setSaving(false);
    }
  }

  function toggleTimeSlot(dateStr: string, slot: { start: string; end: string }) {
    setAvailability(prev => {
      const daySlots = prev[dateStr] || [];
      const exists = daySlots.find(s => s.start === slot.start && s.end === slot.end);
      
      if (exists) {
        // Remove slot
        return {
          ...prev,
          [dateStr]: daySlots.filter(s => s.start !== slot.start || s.end !== slot.end)
        };
      } else {
        // Add slot
        return {
          ...prev,
          [dateStr]: [...daySlots, { id: crypto.randomUUID(), ...slot }]
        };
      }
    });
  }

  function toggleWeeklyTimeSlot(day: string, slot: { start: string; end: string }) {
    setWeeklyAvailability(prev => {
      const daySlots = prev[day] || [];
      const exists = daySlots.find(s => s.start === slot.start && s.end === slot.end);
      
      if (exists) {
        return {
          ...prev,
          [day]: daySlots.filter(s => s.start !== slot.start || s.end !== slot.end)
        };
      } else {
        return {
          ...prev,
          [day]: [...daySlots, { id: crypto.randomUUID(), ...slot }]
        };
      }
    });
  }

  function isSlotSelected(dateStr: string, slot: { start: string; end: string }) {
    const daySlots = availability[dateStr] || [];
    return daySlots.some(s => s.start === slot.start && s.end === slot.end);
  }

  function isWeeklySlotSelected(day: string, slot: { start: string; end: string }) {
    const daySlots = weeklyAvailability[day] || [];
    return daySlots.some(s => s.start === slot.start && s.end === slot.end);
  }

  function formatTime(time: string): string {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}${ampm}`;
  }

  function getDaysInMonth(date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // Add actual days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  }

  function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  function previousMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  }

  function nextMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  }

  function hasAvailability(date: Date): boolean {
    const dateStr = formatDate(date);
    return (availability[dateStr]?.length || 0) > 0;
  }

  function getDayOfWeekName(date: Date): string {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[date.getDay()];
  }

  function getCombinedAvailability(date: Date): TimeSlot[] {
    const dateStr = formatDate(date);
    const dayName = getDayOfWeekName(date);
    
    // Get specific date slots
    const specificSlots = availability[dateStr] || [];
    
    // Get weekly recurring slots for this day of week
    const weeklySlots = weeklyAvailability[dayName] || [];
    
    // Combine both, removing duplicates
    const combined = [...specificSlots];
    weeklySlots.forEach(weeklySlot => {
      const exists = combined.some(s => s.start === weeklySlot.start && s.end === weeklySlot.end);
      if (!exists) {
        combined.push(weeklySlot);
      }
    });
    
    return combined;
  }

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">My Availability</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">Set your available time slots</p>
          </div>
          <Link href="/home" className="text-sm text-pink-600 dark:text-pink-400 hover:underline">
            Back to Home
          </Link>
        </header>

        {message && (
          <div className={`mb-4 p-3 rounded-md text-sm ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {message}
          </div>
        )}

        {/* View Mode Toggle */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => {
              setViewMode('weekly');
              setSelectedDate(null);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'weekly'
                ? 'bg-pink-600 text-white'
                : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
          >
            Weekly Schedule
          </button>
          <button
            onClick={() => {
              setViewMode('specific');
              setSelectedWeekDay(null);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'specific'
                ? 'bg-pink-600 text-white'
                : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
          >
            Specific Dates
          </button>
        </div>

        {viewMode === 'weekly' ? (
          /* Weekly Availability View */
          <div className="grid md:grid-cols-2 gap-6">
            {/* Week Days List */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                Select Day of Week
              </h2>
              <div className="space-y-2">
                {weekDays.map((day) => {
                  const hasSlots = (weeklyAvailability[day]?.length || 0) > 0;
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedWeekDay(day)}
                      className={`w-full p-3 rounded-lg text-left transition-colors ${
                        selectedWeekDay === day
                          ? 'bg-pink-600 text-white'
                          : hasSlots
                          ? 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-200'
                          : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{day}</span>
                        {hasSlots && (
                          <span className="text-xs">
                            {weeklyAvailability[day].length} slot{weeklyAvailability[day].length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Slots for Selected Day */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
              {selectedWeekDay ? (
                <>
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                    {selectedWeekDay}s
                  </h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                    Select time slots for every {selectedWeekDay}
                  </p>

                  <div className="space-y-2">
                    {commonSlots.map((slot) => {
                      const selected = isWeeklySlotSelected(selectedWeekDay, slot);
                      return (
                        <button
                          key={slot.label}
                          onClick={() => toggleWeeklyTimeSlot(selectedWeekDay, { start: slot.start, end: slot.end })}
                          className={`w-full p-3 rounded-lg text-left transition-colors ${
                            selected
                              ? 'bg-pink-600 text-white'
                              : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                          }`}
                        >
                          <div className="font-medium">{slot.label}</div>
                        </button>
                      );
                    })}
                  </div>

                  {weeklyAvailability[selectedWeekDay]?.length > 0 && (
                    <button
                      onClick={() => setWeeklyAvailability(prev => ({ ...prev, [selectedWeekDay]: [] }))}
                      className="mt-4 text-sm text-red-600 dark:text-red-400 hover:underline"
                    >
                      Clear all slots for {selectedWeekDay}s
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
                  Select a day of the week to set recurring availability
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Specific Dates View */
          <div className="grid md:grid-cols-2 gap-6">
          {/* Calendar View */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={previousMonth}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
              >
                ←
              </button>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{monthName}</h2>
              <button
                onClick={nextMonth}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
              >
                →
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-medium text-zinc-600 dark:text-zinc-400 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((date, idx) => {
                if (!date) {
                  return <div key={`empty-${idx}`} className="aspect-square" />;
                }
                const dateStr = formatDate(date);
                const isSelected = selectedDate === dateStr;
                const combinedSlots = getCombinedAvailability(date);
                const hasSlots = combinedSlots.length > 0;
                const isToday = formatDate(new Date()) === dateStr;

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`relative rounded-lg text-sm font-medium transition-colors p-1 min-h-[60px] flex flex-col items-center justify-start ${
                      isSelected
                        ? 'bg-pink-600 text-white'
                        : isToday
                        ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span className="mb-1">{date.getDate()}</span>
                    {hasSlots && (
                      <div className="text-[9px] leading-tight space-y-0.5 w-full px-0.5">
                        {combinedSlots.slice(0, 2).map((slot, i) => (
                          <div
                            key={i}
                            className={`rounded px-1 py-0.5 ${
                              isSelected
                                ? 'bg-pink-700'
                                : 'bg-pink-200 text-pink-800 dark:bg-pink-800 dark:text-pink-100'
                            }`}
                          >
                            {formatTime(slot.start)}
                          </div>
                        ))}
                        {combinedSlots.length > 2 && (
                          <div className={`text-[8px] ${isSelected ? 'text-pink-100' : 'text-pink-600 dark:text-pink-400'}`}>
                            +{combinedSlots.length - 2}
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Slots Panel */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
            {selectedDate ? (
              <>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                  Select time slots when you're available
                </p>

                <div className="space-y-2">
                  {commonSlots.map((slot) => {
                    const selected = isSlotSelected(selectedDate, slot);
                    return (
                      <button
                        key={slot.label}
                        onClick={() => toggleTimeSlot(selectedDate, { start: slot.start, end: slot.end })}
                        className={`w-full p-3 rounded-lg text-left transition-colors ${
                          selected
                            ? 'bg-pink-600 text-white'
                            : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                        }`}
                      >
                        <div className="font-medium">{slot.label}</div>
                      </button>
                    );
                  })}
                </div>

                {availability[selectedDate]?.length > 0 && (
                  <button
                    onClick={() => setAvailability(prev => ({ ...prev, [selectedDate]: [] }))}
                    className="mt-4 text-sm text-red-600 dark:text-red-400 hover:underline"
                  >
                    Clear all slots for this day
                  </button>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
                Select a date to set your availability
              </div>
            )}
          </div>
        </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-pink-600 text-white px-6 py-2 font-medium hover:bg-pink-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Availability'}
          </button>
        </div>
      </div>
    </div>
  );
}
