export { default } from "../village/page";
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
