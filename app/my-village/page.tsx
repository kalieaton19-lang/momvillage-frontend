"use client";
console.log("DEBUG: VillagePage loaded");
export const dynamic = "force-dynamic";
import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

function InviteByNameForm({ onBack, onSelect }: { onBack: () => void; onSelect: (user: any) => void }) {
	const [search, setSearch] = useState("");
	const [results, setResults] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		const trimmed = search.trim();
		setError("");
		setResults([]);
		if (!trimmed || trimmed.split(/\s+/)[0].length < 2) {
			if (trimmed.length > 0) setError("Please enter at least a first name (2+ letters). ");
			setLoading(false);
			return;
		}
		setLoading(true);
		const handler = setTimeout(async () => {
			try {
				const { data, error: searchError } = await supabase
					.from("user_public_profiles")
					.select("id, full_name, profile_photo_url, city, state, is_public")
					.or(`full_name.ilike.%${trimmed}%,city.ilike.%${trimmed}%`)
					.limit(10);
				if (searchError) throw searchError;
				setResults(data || []);
				if ((data || []).length === 0) setError("No users found.");
			} catch (e: any) {
				setError("Search failed. Try again.");
			} finally {
				setLoading(false);
			}
		}, 300);
		return () => clearTimeout(handler);

	// Re-export the main VillagePage so /my-village uses the same page as /village
	import VillagePage from "../village/page";
	export default VillagePage;
								onClick={closeModal}
							>
								Cancel
							</button>
							<button
								className="px-4 py-2 rounded-lg bg-pink-500 text-white hover:bg-pink-600"
								disabled={inviteLoading}
								onClick={async () => {
									setInviteLoading(true);
									setInviteError("");
									setInviteSuccess("");
									try {
										const { data: { user } } = await supabase.auth.getUser();
										if (!user) throw new Error("User not found");
										// Insert invitation
										const { error: inviteError } = await supabase
											.from("invitations")
											.insert({ sender_id: user.id, invited_user_id: selectedUser.id, status: "pending" });
										if (inviteError) throw inviteError;
										setInviteSuccess("Invitation sent!");
										setTimeout(() => {
											setIsModalOpen(false);
											setSelectedUser(null);
										}, 1000);
									} catch (e: any) {
										setInviteError("Failed to send invite. Try again.");
									} finally {
										setInviteLoading(false);
									}
								}}
							>
								{inviteLoading ? "Sending..." : "Send Invite"}
							</button>
							{inviteError && <div className="text-red-500 text-xs mt-2">{inviteError}</div>}
							{inviteSuccess && <div className="text-green-500 text-xs mt-2">{inviteSuccess}</div>}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
