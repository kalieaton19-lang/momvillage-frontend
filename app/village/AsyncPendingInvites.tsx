import React from "react";

// You can replace 'any' with the actual type for VillageInvitationWithRecipient if available
export function AsyncPendingInvites({ invites }: { invites: any[] }) {
  if (!invites || invites.length === 0) {
    return (
      <div className="p-4 bg-yellow-100 text-yellow-800 rounded-lg">
        No pending invites.
      </div>
    );
  }
  return (
    <ul className="p-4 bg-yellow-100 text-yellow-800 rounded-lg">
      {invites.map((invite, idx) => (
        <li key={invite.id || idx} className="mb-2">
          Pending invite: {invite.recipient_name || JSON.stringify(invite)}
        </li>
      ))}
    </ul>
  );
}
