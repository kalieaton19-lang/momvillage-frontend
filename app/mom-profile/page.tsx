"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function MomProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const momId = searchParams.get("id");
  const [mom, setMom] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMom() {
      if (!momId) return;
      const { data, error } = await supabase
        .from("user_public_profiles")
        .select("*")
        .eq("id", momId)
        .single();
      setMom(data);
      setLoading(false);
    }
    fetchMom();
  }, [momId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  if (!mom) {
    return <div className="min-h-screen flex items-center justify-center">Mom not found.</div>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900 p-6">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-8 max-w-md w-full flex flex-col items-center">
        <img
          src={mom.profile_photo_url || "/placeholder.png"}
          alt={mom.full_name || "Mom"}
          className="w-40 h-40 rounded-full object-cover border-4 border-pink-300 mb-6"
        />
        <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">{mom.full_name || "Mom"}</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-2">{mom.city}, {mom.state}</p>
        {mom.number_of_kids && (
          <p className="mb-2 text-pink-700 dark:text-pink-300">{mom.number_of_kids} kid{mom.number_of_kids !== 1 ? "s" : ""}</p>
        )}
        {mom.kids_age_groups && (
          <div className="mb-2 flex flex-wrap gap-2">
            {mom.kids_age_groups.split(",").map((age: string) => (
              <span key={age} className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                {age}
              </span>
            ))}
          </div>
        )}
        {mom.parenting_style && (
          <p className="mb-2 text-blue-700 dark:text-blue-300">Parenting style: {mom.parenting_style}</p>
        )}
        {mom.other_info && (
          <p className="mb-2 text-zinc-700 dark:text-zinc-300">{mom.other_info}</p>
        )}
        <button
          className="mt-6 px-6 py-2 bg-pink-600 text-white rounded-full font-medium hover:bg-pink-700 transition-colors"
          onClick={() => router.back()}
        >
          Back
        </button>
      </div>
    </div>
  );
}
