"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function ProfilePage() {
  const { id } = useParams();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      setError("");
      const { data, error } = await supabase
        .from("user_public_profiles")
        .select("id, full_name, profile_photo_url, city, state, is_public")
        .eq("id", id)
        .single();
      if (error) {
        setError("Profile not found.");
        setProfile(null);
      } else {
        setProfile(data);
      }
      setLoading(false);
    }
    if (id) fetchProfile();
  }, [id]);

  if (loading) return <div className="p-8 text-center">Loading profile...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!profile) return null;

  return (
    <div className="max-w-xl mx-auto p-8">
      <div className="flex flex-col items-center">
        {profile.profile_photo_url ? (
          <img src={profile.profile_photo_url} alt={profile.full_name} className="w-32 h-32 rounded-full object-cover mb-4" />
        ) : (
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-bold text-4xl mb-4">
            {profile.full_name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <h1 className="text-3xl font-bold mb-2">{profile.full_name}</h1>
        <div className="text-zinc-600 dark:text-zinc-400 mb-2">{profile.city}{profile.city && profile.state ? ', ' : ''}{profile.state}</div>
        <div className="mt-4 text-zinc-500 text-sm">User ID: {profile.id}</div>
      </div>
    </div>
  );
}
