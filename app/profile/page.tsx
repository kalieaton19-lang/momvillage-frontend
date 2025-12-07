"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

interface UserProfile {
  id?: string;
  user_id?: string;
  full_name?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  number_of_kids?: number;
  kids_age_groups?: string[];
  preferred_language?: string;
  parenting_style?: string;
  other_info?: string;
  profile_photo_url?: string;
  created_at?: string;
  updated_at?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile>({
    full_name: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    number_of_kids: 0,
    kids_age_groups: [],
    preferred_language: "",
    parenting_style: "",
    other_info: "",
  });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string>("");

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Session:', session);
      
      if (!session) {
        router.push('/login');
        return;
      }
      
      setUser(session.user);
      await loadUserProfile(session.user.id);
    } catch (error) {
      console.error('Error checking user:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  async function loadUserProfile(userId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user?.user_metadata) {
        console.log('Loaded user metadata:', user.user_metadata);
        setProfile({
          full_name: user.user_metadata.full_name || '',
          phone: user.user_metadata.phone || '',
          address: user.user_metadata.address || '',
          city: user.user_metadata.city || '',
          state: user.user_metadata.state || '',
          zip_code: user.user_metadata.zip_code || '',
          number_of_kids: user.user_metadata.number_of_kids || 0,
          kids_age_groups: user.user_metadata.kids_age_groups || [],
          preferred_language: user.user_metadata.preferred_language || '',
          parenting_style: user.user_metadata.parenting_style || '',
          other_info: user.user_metadata.other_info || '',
          profile_photo_url: user.user_metadata.profile_photo_url || '',
        });
      }
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setUploading(true);
    setError("");
    
    try {
      // Create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Generate unique filename
      const fileName = `${user.id}-${Date.now()}-${file.name}`;
      const filePath = `profile-photos/${fileName}`;

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('momvillage')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('Supabase storage error:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('momvillage')
        .getPublicUrl(filePath);

      setProfile({ ...profile, profile_photo_url: publicUrl });
      setMessage('Photo uploaded successfully!');
    } catch (error: any) {
      console.error('Photo upload error:', error);
      setError(`Failed to upload photo: ${error.message || 'Unknown error'}`);
      setPreviewUrl("");
    } finally {
      setUploading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/');
  }

  async function handleSave() {
    if (!user) return;
    
    setSaving(true);
    setMessage("");
    setError("");
    
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: profile.full_name,
          phone: profile.phone,
          address: profile.address,
          city: profile.city,
          state: profile.state,
          zip_code: profile.zip_code,
          number_of_kids: profile.number_of_kids,
          kids_age_groups: profile.kids_age_groups,
          preferred_language: profile.preferred_language,
          parenting_style: profile.parenting_style,
          other_info: profile.other_info,
          profile_photo_url: profile.profile_photo_url,
        }
      });

      if (updateError) {
        console.error('Save error:', updateError);
        setError(`Failed to update profile: ${updateError.message}`);
      } else {
        // Check if this is first time setup (no availability set yet)
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        const hasAvailability = currentUser?.user_metadata?.availability || currentUser?.user_metadata?.weeklyAvailability;
        
        if (!hasAvailability) {
          setMessage("Profile updated successfully! Redirecting to availability...");
          setEditing(false);
          await loadUserProfile(user.id);
          // Redirect to availability page for first-time setup
          setTimeout(() => {
            router.push('/calendar');
          }, 1500);
        } else {
          setMessage("Profile updated successfully!");
          setEditing(false);
          await loadUserProfile(user.id);
        }
      }
    } catch (error: any) {
      console.error('Error saving profile:', error);
      setError(`Failed to update profile: ${error.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
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
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/home" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-pink-600">
            ← Back to Home
          </Link>
          <button
            onClick={handleSignOut}
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-pink-600"
          >
            Sign Out
          </button>
        </div>

        {/* Profile Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              {/* Profile Photo */}
              <div className="relative">
                {previewUrl || profile.profile_photo_url ? (
                  <img
                    src={previewUrl || profile.profile_photo_url}
                    alt="Profile"
                    className="w-20 h-20 rounded-full object-cover border-2 border-pink-300"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white text-2xl font-semibold">
                    {user?.email?.[0].toUpperCase() || "?"}
                  </div>
                )}
                {editing && (
                  <label className="absolute bottom-0 right-0 bg-pink-600 text-white p-2 rounded-full cursor-pointer hover:bg-pink-700 text-xs">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                    📷
                  </label>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {editing ? "Edit Profile" : (profile.full_name || "Your Profile")}
                </h1>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{user?.email}</p>
              </div>
            </div>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 text-sm bg-pink-600 text-white rounded-full hover:bg-pink-700"
              >
                Edit Profile
              </button>
            )}
          </div>

          {message && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md text-sm">
              {message}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Profile Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={profile.full_name || ""}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                disabled={!editing}
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="Your full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Phone
              </label>
              <input
                type="tel"
                value={profile.phone || ""}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                disabled={!editing}
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="(123) 456-7890"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Address
              </label>
              <input
                type="text"
                value={profile.address || ""}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                disabled={!editing}
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="Street address"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={profile.city || ""}
                  onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                  disabled={!editing}
                  className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-60 disabled:cursor-not-allowed"
                  placeholder="City"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  State
                </label>
                <input
                  type="text"
                  value={profile.state || ""}
                  onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                  disabled={!editing}
                  className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-60 disabled:cursor-not-allowed"
                  placeholder="State"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                ZIP Code
              </label>
              <input
                type="text"
                value={profile.zip_code || ""}
                onChange={(e) => setProfile({ ...profile, zip_code: e.target.value })}
                disabled={!editing}
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="12345"
              />
            </div>

            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Family Information</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Number of Kids
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={profile.number_of_kids || 0}
                    onChange={(e) => setProfile({ ...profile, number_of_kids: parseInt(e.target.value) || 0 })}
                    disabled={!editing}
                    className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Preferred Language
                  </label>
                  <select
                    value={profile.preferred_language || ""}
                    onChange={(e) => setProfile({ ...profile, preferred_language: e.target.value })}
                    disabled={!editing}
                    className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="">Select...</option>
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="Mandarin">Mandarin</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Kids Age Groups (select all that apply)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['0-1 years', '1-3 years', '3-5 years', '5-8 years', '8-12 years', '12+ years'].map((ageGroup) => (
                    <label key={ageGroup} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={profile.kids_age_groups?.includes(ageGroup) || false}
                        onChange={(e) => {
                          const current = profile.kids_age_groups || [];
                          if (e.target.checked) {
                            setProfile({ ...profile, kids_age_groups: [...current, ageGroup] });
                          } else {
                            setProfile({ ...profile, kids_age_groups: current.filter(g => g !== ageGroup) });
                          }
                        }}
                        disabled={!editing}
                        className="w-4 h-4 rounded border-zinc-300 text-pink-600 focus:ring-pink-300 disabled:opacity-60"
                      />
                      {ageGroup}
                    </label>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Parenting Style
                </label>
                <select
                  value={profile.parenting_style || ""}
                  onChange={(e) => setProfile({ ...profile, parenting_style: e.target.value })}
                  disabled={!editing}
                  className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">Select...</option>
                  <option value="Authoritative">Authoritative</option>
                  <option value="Permissive">Permissive</option>
                  <option value="Authoritarian">Authoritarian</option>
                  <option value="Uninvolved">Uninvolved</option>
                  <option value="Gentle Parenting">Gentle Parenting</option>
                  <option value="Attachment Parenting">Attachment Parenting</option>
                  <option value="Free-Range">Free-Range</option>
                  <option value="Helicopter">Helicopter</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Other Important Info
                </label>
                <textarea
                  value={profile.other_info || ""}
                  onChange={(e) => setProfile({ ...profile, other_info: e.target.value })}
                  disabled={!editing}
                  rows={4}
                  className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-60 disabled:cursor-not-allowed"
                  placeholder="Any additional information you'd like to share..."
                />
              </div>
            </div>

            {editing && (
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-full hover:bg-pink-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setMessage("");
                  }}
                  disabled={saving}
                  className="flex-1 px-4 py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-full hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Account Info */}
          <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
              Account Information
            </h3>
            <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <div className="flex justify-between">
                <span>Email:</span>
                <span className="font-medium">{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span>Member since:</span>
                <span className="font-medium">
                  {new Date(user?.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
