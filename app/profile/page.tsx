"use client";

              import { useState, useEffect } from "react";
              import { useRouter } from "next/navigation";
              import Link from "next/link";
              import { supabase } from "../../lib/supabase";
              import { Button } from "@/app/components/ui/Button";
              import { Alert } from "@/app/components/ui/Alert";
              import { Input } from "@/app/components/ui/Input";

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
                  const [user, setUser] = useState<any>(null);
                  const [loading, setLoading] = useState(true);
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
                  profile_photo_url: "",
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
    } catch (error) {
      console.error('Photo upload error:', error);
      const errMsg = (error && typeof error === 'object' && 'message' in error) ? (error as Error).message : 'Unknown error';
      setError(`Failed to upload photo: ${errMsg}`);
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
      // 1. Update Auth user_metadata
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

      // 2. Upsert into user_public_profiles (remove address field)
      const { error: upsertError } = await supabase
        .from('user_public_profiles')
        .upsert({
          id: user.id,
          email: user.email,
          full_name: profile.full_name,
          phone: profile.phone,
          city: profile.city,
          state: profile.state,
          zip_code: profile.zip_code,
          number_of_kids: profile.number_of_kids,
          kids_age_groups: profile.kids_age_groups,
          preferred_language: profile.preferred_language,
          parenting_style: profile.parenting_style,
          other_info: profile.other_info,
          profile_photo_url: profile.profile_photo_url,
        });

      if (updateError || upsertError) {
        if (updateError) console.error('Save error (auth):', updateError);
        if (upsertError) console.error('Save error (public_profiles):', upsertError);
        // Show full error details in UI for debugging
        setError(`Failed to update profile: ${updateError?.message || ''} ${upsertError?.message || ''}`);
        setMessage(`Debug: upsert error: ${JSON.stringify(upsertError, null, 2)}`);
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
    } catch (error) {
      console.error('Error saving profile:', error);
      const errMsg = (error && typeof error === 'object' && 'message' in error) ? (error as Error).message : 'Unknown error';
      setError(`Failed to update profile: ${errMsg}`);
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

  // Mock My Village count (replace with real logic if available)
  const myVillageCount = 8; // TODO: Replace with real count from backend

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900 p-0 sm:p-4">
      {/* Profile Banner */}
      <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
        <div className="w-full flex flex-col sm:flex-row items-center sm:items-end bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-8 pt-8 pb-6 sm:rounded-t-2xl shadow-sm">
          {/* Profile Photo */}
          {profile.profile_photo_url ? (
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-pink-400 shadow mr-0 sm:mr-6 mb-4 sm:mb-0">
              <img src={profile.profile_photo_url} alt={profile.full_name || "Profile"} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white text-4xl font-bold border-2 border-pink-400 shadow mr-0 sm:mr-6 mb-4 sm:mb-0">
              {profile.full_name?.[0]?.toUpperCase() || "?"}
            </div>
          )}
          <div className="flex-1 flex flex-col gap-2 w-full">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{profile.full_name || "Mom"}</span>
              <button
                onClick={() => setEditing(true)}
                className="ml-2 p-2 rounded-full hover:bg-pink-100 dark:hover:bg-pink-900/30 focus:outline-none focus:ring-2 focus:ring-pink-400"
                aria-label="Edit Profile"
              >
                {/* Pencil Icon */}
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-pink-600">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16.862 5.487a2.06 2.06 0 1 1 2.915 2.914l-9.193 9.193-3.122.208.208-3.122 9.192-9.193Z" />
                </svg>
              </button>
            </div>
            <div className="flex gap-6 flex-wrap text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              <span>My Village: <span className="font-semibold text-pink-600">{myVillageCount}</span></span>
              {profile.preferred_language && (
                <span>Preferred Language: <span className="font-medium text-zinc-700 dark:text-zinc-200">{profile.preferred_language}</span></span>
              )}
              {(profile.number_of_kids !== undefined && profile.number_of_kids !== null && profile.number_of_kids !== 0) && (
                <span>Children: <span className="font-medium text-zinc-700 dark:text-zinc-200">{profile.number_of_kids}</span></span>
              )}
              {profile.kids_age_groups && profile.kids_age_groups.length > 0 && (
                <span>Ages: <span className="font-medium text-zinc-700 dark:text-zinc-200">{profile.kids_age_groups.join(", ")}</span></span>
              )}
            </div>
          </div>
        </div>
        {/* Profile posts or other content can go here */}
        <div className="w-full bg-transparent min-h-[200px] flex flex-col items-center justify-center">
          {/* TODO: Render user's posts here in a visually appealing way */}
          <div className="text-zinc-400 italic">(Your posts will appear here)</div>
        </div>
        {/* Edit Profile Modal (if editing) */}
        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-8 shadow-xl w-full max-w-md relative">
              <button
                onClick={() => setEditing(false)}
                className="absolute top-3 right-3 text-zinc-400 hover:text-pink-600 dark:hover:text-pink-300 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-pink-400"
                aria-label="Close Edit"
              >
                &times;
              </button>
              {/* TODO: Add edit profile form here */}
              <div className="text-center text-zinc-700 dark:text-zinc-200">Edit Profile (form coming soon)</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
