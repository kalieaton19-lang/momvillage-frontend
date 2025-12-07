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

interface Meetup {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  momName: string;
  momId: string;
  type: 'meetup' | 'service';
  title: string;
  description?: string;
}

interface CalendarEvent {
  id: string;
  date: string;
  type: 'availability' | 'meetup' | 'service';
  title: string;
  time?: string;
  color: string;
  bgColor: string;
  textColor: string;
}

export default function UnifiedCalendarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availability, setAvailability] = useState<Record<string, TimeSlot[]>>({});
  const [meetups, setMeetups] = useState<Meetup[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedDateEvents, setSelectedDateEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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
      await loadData(session.user.id);
    } catch (error) {
      console.error('Error checking user:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  async function loadData(userId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.availability) {
        setAvailability(user.user_metadata.availability);
      }
      if (user?.user_metadata?.meetups) {
        setMeetups(user.user_metadata.meetups);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  async function handleDeleteMeetup(meetupId: string) {
    if (!confirm('Delete this event?')) return;

    try {
      const updatedMeetups = meetups.filter(m => m.id !== meetupId);
      const { error } = await supabase.auth.updateUser({
        data: { meetups: updatedMeetups }
      });

      if (error) {
        setMessage(`Error: ${error.message}`);
      } else {
        setMeetups(updatedMeetups);
        setMessage("Event deleted successfully!");
        if (selectedDate) {
          updateSelectedDateEvents(selectedDate, updatedMeetups);
        }
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      console.error('Error deleting:', error);
      setMessage("Failed to delete event");
    }
  }

  function getEventsForDate(dateStr: string, meetupsData = meetups): CalendarEvent[] {
    const events: CalendarEvent[] = [];

    // Add availability events
    if (availability[dateStr]) {
      availability[dateStr].forEach((slot, index) => {
        events.push({
          id: `avail-${dateStr}-${slot.start}`,
          date: dateStr,
          type: 'availability',
          title: `Available ${slot.start}-${slot.end}`,
          time: slot.start,
          color: 'bg-green-100 dark:bg-green-900/30',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          textColor: 'text-green-700 dark:text-green-300',
        });
      });
    }

    // Add meetups/services for this date
    meetupsData.filter(m => m.date === dateStr).forEach(meetup => {
      events.push({
        id: meetup.id,
        date: dateStr,
        type: meetup.type,
        title: meetup.title,
        time: meetup.startTime,
        color: meetup.type === 'service' 
          ? 'bg-purple-100 dark:bg-purple-900/30'
          : 'bg-pink-100 dark:bg-pink-900/30',
        bgColor: meetup.type === 'service'
          ? 'bg-purple-50 dark:bg-purple-900/20'
          : 'bg-pink-50 dark:bg-pink-900/20',
        textColor: meetup.type === 'service'
          ? 'text-purple-700 dark:text-purple-300'
          : 'text-pink-700 dark:text-pink-300',
      });
    });

    return events;
  }

  function updateSelectedDateEvents(dateStr: string, meetupsData = meetups) {
    const events = getEventsForDate(dateStr, meetupsData);
    setSelectedDateEvents(events);
  }

  function handleDateClick(dateStr: string) {
    setSelectedDate(dateStr);
    updateSelectedDateEvents(dateStr);
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
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Schedule & Meetups 📅</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Your availability, meetups, and services all in one place
              </p>
            </div>
            <Link href="/home" className="text-sm text-pink-600 dark:text-pink-400 hover:underline">
              Back to Home
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

        {/* Legend */}
        <div className="mb-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-3">Event Types:</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Availability</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-pink-500 rounded"></div>
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Meetup</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-purple-500 rounded"></div>
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Service Exchange</span>
            </div>
          </div>
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
                const events = getEventsForDate(dateStr);
                const isSelected = selectedDate === dateStr;
                
                return (
                  <button
                    key={day}
                    onClick={() => handleDateClick(dateStr)}
                    className={`p-2 rounded-lg border text-sm font-medium transition-all min-h-24 flex flex-col justify-start ${
                      isSelected
                        ? 'border-pink-500 dark:border-pink-600 ring-2 ring-pink-300 dark:ring-pink-700'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-pink-300 dark:hover:border-pink-700'
                    } ${
                      events.length > 0
                        ? 'bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-800'
                        : 'bg-white dark:bg-zinc-900'
                    }`}
                  >
                    <div className="text-zinc-900 dark:text-zinc-50 font-bold mb-1">{day}</div>
                    <div className="text-xs space-y-1 w-full">
                      {events.slice(0, 3).map((event, i) => (
                        <div key={i} className={`px-1.5 py-0.5 rounded text-white text-xs truncate font-medium ${
                          event.type === 'availability' ? 'bg-green-500' : 
                          event.type === 'service' ? 'bg-purple-500' : 'bg-pink-500'
                        }`}>
                          {event.type === 'availability' ? '✓' : event.type === 'service' ? '🤝' : '👋'} {event.title.substring(0, 12)}
                        </div>
                      ))}
                      {events.length > 3 && (
                        <div className="text-xs text-zinc-500 px-1">+{events.length - 3} more</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Event Details Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sticky top-6">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                📋 Events
              </h3>

              {selectedDate ? (
                <div className="space-y-4">
                  <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400 pb-2 border-b border-zinc-200 dark:border-zinc-700">
                    {selectedDate}
                  </div>

                  {selectedDateEvents.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {selectedDateEvents.map(event => (
                        <div
                          key={event.id}
                          className={`p-3 rounded-lg border ${event.color}`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-lg flex-shrink-0">
                                {event.type === 'availability' ? '✓' : event.type === 'service' ? '🤝' : '👋'}
                              </span>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">
                                  {event.title}
                                </div>
                                {event.time && (
                                  <div className={`text-xs ${event.textColor}`}>
                                    {event.time}
                                  </div>
                                )}
                              </div>
                            </div>
                            {event.type !== 'availability' && (
                              <button
                                onClick={() => handleDeleteMeetup(event.id)}
                                className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium flex-shrink-0"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-3xl mb-2">📭</div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        No events scheduled for this date
                      </p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700 space-y-2">
                    <Link
                      href="/specific-availability"
                      className="block w-full px-3 py-2 text-xs text-center bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors font-medium"
                    >
                      📍 Edit Date Availability
                    </Link>
                    <Link
                      href="/meetups-services"
                      className="block w-full px-3 py-2 text-xs text-center bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-lg hover:bg-pink-200 dark:hover:bg-pink-900/50 transition-colors font-medium"
                    >
                      🤝 Create Event
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-3xl mb-2">👇</div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Click on a date to see all events
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/specific-availability"
            className="px-6 py-4 bg-gradient-to-r from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-900/20 border border-green-200 dark:border-green-700 rounded-2xl text-center hover:border-green-400 dark:hover:border-green-600 transition-colors"
          >
            <div className="font-semibold text-green-700 dark:text-green-300">📍 Specific Dates</div>
            <div className="text-xs text-green-600 dark:text-green-400 mt-1">Manage date availability</div>
          </Link>
          <Link
            href="/weekly-availability"
            className="px-6 py-4 bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-2xl text-center hover:border-purple-400 dark:hover:border-purple-600 transition-colors"
          >
            <div className="font-semibold text-purple-700 dark:text-purple-300">🔄 Weekly Schedule</div>
            <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">Recurring availability</div>
          </Link>
          <Link
            href="#add-event"
            className="px-6 py-4 bg-gradient-to-r from-pink-100 to-pink-50 dark:from-pink-900/30 dark:to-pink-900/20 border border-pink-200 dark:border-pink-700 rounded-2xl text-center hover:border-pink-400 dark:hover:border-pink-600 transition-colors"
          >
            <div className="font-semibold text-pink-700 dark:text-pink-300">🤝 Create Meetups</div>
            <div className="text-xs text-pink-600 dark:text-pink-400 mt-1">Plan with other moms</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
