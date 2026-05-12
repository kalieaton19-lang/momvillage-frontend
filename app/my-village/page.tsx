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
	}, [search]);

	return (
		<div>
			<div className="flex gap-2 mb-4">
				<input
					type="text"
					className="flex-1 px-4 py-2 border rounded-lg"
					placeholder="Enter name or city..."
					value={search}
					onChange={e => setSearch(e.target.value)}
					required
				/>
			</div>
			{error && <div className="text-red-500 text-sm mb-2">{error}</div>}
			<div className="space-y-2">
				{results.map(user => (
					<button
						key={user.id}
						className="w-full flex items-center gap-3 p-3 border rounded-lg bg-zinc-50 dark:bg-zinc-800 hover:bg-pink-100 dark:hover:bg-pink-900 transition-all"
						onClick={() => onSelect(user)}
					>
						{user.profile_photo_url ? (
							<img src={user.profile_photo_url} alt={user.full_name} className="w-10 h-10 rounded-full object-cover" />
						) : (
							<div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold text-lg">
								{user.full_name?.[0]?.toUpperCase() || '?'}
							</div>
						)}
						<div className="flex-1 text-left">
							<div className="font-semibold text-zinc-900 dark:text-zinc-50">{user.full_name}</div>
							<div className="text-xs text-zinc-500 dark:text-zinc-400">{user.city}{user.city && user.state ? ', ' : ''}{user.state}</div>
						</div>
					</button>
				))}
			</div>
			<button className="mt-4 text-sm text-zinc-500 hover:underline" onClick={onBack}>Back</button>
		</div>
	);
}


export default function VillagePage() {
	const [activeTab, setActiveTab] = useState("village");
	const [villageUsers, setVillageUsers] = useState<any[]>([]);
	const [invitedUsers, setInvitedUsers] = useState<any[]>([]);
	const [allUsers, setAllUsers] = useState<any[]>([]);
	const [search, setSearch] = useState("");
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [loading, setLoading] = useState(false);
	const [selectedUser, setSelectedUser] = useState<any>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [inviteLoading, setInviteLoading] = useState(false);
	const [inviteError, setInviteError] = useState("");
	const [inviteSuccess, setInviteSuccess] = useState("");


	// Fetch all users in my village (accepted)
	useEffect(() => {
		const fetchVillageUsers = async () => {
			setLoading(true);
			setError("");
			try {
				const { data: { user } } = await supabase.auth.getUser();
				if (!user) throw new Error("User not found");
				// Fetch users who are in my village and accepted
				const { data, error: fetchError } = await supabase
					.from("user_public_profiles")
					.select("id, full_name, profile_photo_url, city, state, is_public")
					.eq("village_id", user.user_metadata?.village_id)
					.order("full_name", { ascending: true });
				if (fetchError) throw fetchError;
				setVillageUsers(data || []);
			} catch (e: any) {
				setError("Failed to load village users. Please try again.");
			} finally {
				setLoading(false);
			}
		};
		if (activeTab === "village") fetchVillageUsers();
	}, [activeTab]);

	// Fetch all users for directory
	useEffect(() => {
		const fetchAllUsers = async () => {
			setLoading(true);
			setError("");
			try {
				const { data, error: fetchError } = await supabase
					.from("user_public_profiles")
					.select("id, full_name, profile_photo_url, city, state, is_public")
					.order("full_name", { ascending: true });
				if (fetchError) throw fetchError;
				setAllUsers(data || []);
			} catch (e: any) {
				setError("Failed to load users. Please try again.");
			} finally {
				setLoading(false);
			}
		};
		if (activeTab === "directory") fetchAllUsers();
	}, [activeTab]);

	const handleUserSelect = (user: any) => {
		setSelectedUser(user);
		setIsModalOpen(true);
	};

	const closeModal = () => {
		setIsModalOpen(false);
		setSelectedUser(null);
	};


	// Fetch invitations
	useEffect(() => {
		if (activeTab === "invitation") {
			const fetchInvitedUsers = async () => {
				setLoading(true);
				setError("");
				try {
					const { data: { user } } = await supabase.auth.getUser();
					if (!user) throw new Error("User not found");
					const { data, error: fetchError } = await supabase
						.from("invitations")
						.select("id, invited_user_id, status, user_public_profiles (id, full_name, profile_photo_url)")
						.or(`sender_id.eq.${user.id},invited_user_id.eq.${user.id}`)
						.order("created_at", { ascending: false });
					if (fetchError) throw fetchError;
					setInvitedUsers(data || []);
				} catch (e: any) {
					setError("Failed to load invited users. Please try again.");
				} finally {
					setLoading(false);
				}
			};
			fetchInvitedUsers();
		}
	}, [activeTab]);

	const handleResend = async (invitation: any) => {
		setLoading(true);
		setError("");
		setSuccess("");
		try {
			const { error: resendError } = await supabase
				.from("invitations")
				.update({ status: "pending" })
				.eq("id", invitation.id);
			if (resendError) throw resendError;
			setSuccess("Invitation resent successfully.");
			setInvitedUsers(prev => prev.map(user => user.id === invitation.id ? { ...user, status: "pending" } : user));
		} catch (e: any) {
			setError("Failed to resend invitation. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const handleCancel = async (invitation: any) => {
		setLoading(true);
		setError("");
		setSuccess("");
		try {
			const { error: cancelError } = await supabase
				.from("invitations")
				.delete()
				.eq("id", invitation.id);
			if (cancelError) throw cancelError;
			setSuccess("Invitation canceled successfully.");
			setInvitedUsers(prev => prev.filter(user => user.id !== invitation.id));
		} catch (e: any) {
			setError("Failed to cancel invitation. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="p-4">
			<h1 className="text-2xl font-bold mb-4">My Village</h1>
			<div className="flex gap-4 mb-4">
				<button
					onClick={() => setActiveTab("village")}
					className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2
					${activeTab === "village" ? "bg-pink-500 text-white shadow-md" : "bg-zinc-100 text-zinc-900 hover:bg-pink-50"}
					`}
				>
					<span role="img" aria-label="village">👩‍👩‍👧‍👦</span>
					My Village
				</button>
				<button
					onClick={() => setActiveTab("invitation")}
					className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2
					${activeTab === "invitation" ? "bg-pink-500 text-white shadow-md" : "bg-zinc-100 text-zinc-900 hover:bg-pink-50"}
					`}
				>
					<span role="img" aria-label="invites">✉️</span>
					Invitations
				</button>
				<button
					onClick={() => setActiveTab("invite")}
					className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2
					${activeTab === "invite" ? "bg-pink-500 text-white shadow-md" : "bg-zinc-100 text-zinc-900 hover:bg-pink-50"}
					`}
				>
					<span role="img" aria-label="invite">➕</span>
					Invite a Mom
				</button>
			</div>

			{/* My Village Tab */}
			{activeTab === "village" && (
				<div>
					<h2 className="text-xl font-semibold mb-4">Moms in My Village</h2>
					{loading && <div className="text-center py-4">Loading...</div>}
					{error && <div className="text-red-500 text-sm mb-2">{error}</div>}
					<div className="space-y-2">
						{villageUsers.length === 0 && !loading && (
							<div className="text-center text-zinc-500 text-sm py-4">No moms in your village yet.</div>
						)}
						{villageUsers.map(user => (
							<div key={user.id} className="flex items-center gap-3 p-3 border rounded-lg bg-zinc-50 dark:bg-zinc-800">
								{user.profile_photo_url ? (
									<img src={user.profile_photo_url} alt={user.full_name} className="w-10 h-10 rounded-full object-cover" />
								) : (
									<div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold text-lg">
										{user.full_name?.[0]?.toUpperCase() || '?'}
									</div>
								)}
								<div className="flex-1 text-left">
									<div className="font-semibold text-zinc-900 dark:text-zinc-50">{user.full_name}</div>
									<div className="text-xs text-zinc-500 dark:text-zinc-400">{user.city}{user.city && user.state ? ', ' : ''}{user.state}</div>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Invitations Tab */}
			{activeTab === "invitation" && (
				<div>
					<h2 className="text-xl font-semibold mb-4">Pending Invitations</h2>
					{loading && <div className="text-center py-4">Loading...</div>}
					{error && <div className="text-red-500 text-sm mb-2">{error}</div>}
					<div className="space-y-2">
						{invitedUsers.length === 0 && !loading && (
							<div className="text-center text-zinc-500 text-sm py-4">
								No pending invitations.{" "}
								<button
									onClick={() => setActiveTab("directory")}
									className="text-pink-500 hover:underline"
								>
									Browse users
								</button>
							</div>
						)}
						{invitedUsers.map(invitation => (
							<div
								key={invitation.id}
								className="flex items-center justify-between p-3 border rounded-lg bg-zinc-50 dark:bg-zinc-800"
							>
								<div className="flex items-center gap-3">
									{invitation.user_public_profiles.profile_photo_url ? (
										<img
											src={invitation.user_public_profiles.profile_photo_url}
											alt={invitation.user_public_profiles.full_name}
											className="w-10 h-10 rounded-full object-cover"
										/>
									) : (
										<div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold text-lg">
											{invitation.user_public_profiles.full_name?.[0]?.toUpperCase() || '?'}
										</div>
									)}
									<div className="text-left">
										<div className="font-semibold text-zinc-900 dark:text-zinc-50">
											{invitation.user_public_profiles.full_name}
										</div>
										<div className="text-xs text-zinc-500 dark:text-zinc-400">
											{invitation.status === "pending" && "Pending"}
											{invitation.status === "accepted" && "Accepted"}
											{invitation.status === "declined" && "Declined"}
										</div>
									</div>
								</div>
								<div className="flex items-center gap-2">
									{invitation.status === "pending" && (
										<>
											<button
												onClick={() => handleResend(invitation)}
												className="px-3 py-1 text-sm rounded-lg bg-pink-500 text-white hover:bg-pink-600 transition-all"
											>
												Resend
											</button>
											<button
												onClick={() => handleCancel(invitation)}
												className="px-3 py-1 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all"
											>
												Cancel
											</button>
										</>
									)}
									{invitation.status === "accepted" && (
										<span className="text-green-500 text-sm font-semibold">Accepted</span>
									)}
									{invitation.status === "declined" && (
										<span className="text-red-500 text-sm font-semibold">Declined</span>
									)}
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Directory Tab */}
			{activeTab === "directory" && (
				<div>
					<h2 className="text-xl font-semibold mb-4">User Directory</h2>
					<div className="flex gap-2 mb-4">
						<input
							type="text"
							className="flex-1 px-4 py-2 border rounded-lg"
							placeholder="Search users..."
							value={search}
							onChange={e => setSearch(e.target.value)}
						/>
					</div>
					{error && <div className="text-red-500 text-sm mb-2">{error}</div>}
					<div className="space-y-2">
						{allUsers.filter(user => user.full_name.toLowerCase().includes(search.toLowerCase())).map(user => (
							<div
								key={user.id}
								className="flex items-center justify-between p-3 border rounded-lg bg-zinc-50 dark:bg-zinc-800"
							>
								<div className="flex items-center gap-3">
									{user.profile_photo_url ? (
										<img
											src={user.profile_photo_url}
											alt={user.full_name}
											className="w-10 h-10 rounded-full object-cover"
										/>
									) : (
										<div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold text-lg">
											{user.full_name?.[0]?.toUpperCase() || '?'}
										</div>
									)}
									<div className="text-left">
										<div className="font-semibold text-zinc-900 dark:text-zinc-50">
											{user.full_name}
										</div>
										<div className="text-xs text-zinc-500 dark:text-zinc-400">
											{user.city}{user.city && user.state ? ', ' : ''}{user.state}
										</div>
									</div>
								</div>
								<button
									onClick={() => handleUserSelect(user)}
									className="px-3 py-1 text-sm rounded-lg bg-pink-500 text-white hover:bg-pink-600 transition-all"
								>
									Invite
								</button>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Invite a Mom Tab */}
			{activeTab === "invite" && (
				<div>
					<h2 className="text-xl font-semibold mb-4">Invite Friends</h2>
					<InviteByNameForm onBack={() => setActiveTab("directory")} onSelect={user => {
						setSelectedUser(user);
						setIsModalOpen(true);
					}} />
				</div>
			)}

			{/* Invite Modal */}
			{isModalOpen && selectedUser && (
				<div className="fixed inset-0 flex items-center justify-center z-50">
					<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-6 max-w-sm w-full">
						<h3 className="text-lg font-semibold mb-4">Invite {selectedUser.full_name}?</h3>
						<div className="flex items-center gap-4 mb-4">
							{selectedUser.profile_photo_url ? (
								<img
									src={selectedUser.profile_photo_url}
									alt={selectedUser.full_name}
									className="w-16 h-16 rounded-full object-cover"
								/>
							) : (
								<div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold text-2xl">
									{selectedUser.full_name?.[0]?.toUpperCase() || '?'}
								</div>
							)}
							<div className="flex-1">
								<div className="font-semibold text-zinc-900 dark:text-zinc-50">
									{selectedUser.full_name}
								</div>
								<div className="text-xs text-zinc-500 dark:text-zinc-400">
									{selectedUser.city}{selectedUser.city && selectedUser.state ? ', ' : ''}{selectedUser.state}
								</div>
							</div>
						</div>
						<div className="flex gap-2 justify-end">
							<button
								className="px-4 py-2 rounded-lg bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
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
