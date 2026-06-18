import type { SupabaseClient } from '@supabase/supabase-js';

type SendMessageParams = {
	supabase: SupabaseClient;
	selectedConversation: string;
	userId: string;
	messageText: string;
	matchId?: string;
	receiverId?: string;
	createdAt?: string;
};

type SendMessageResult = {
	data: any | null;
	error: { message: string; status?: number } | null;
	status: number;
};

export async function sendMessageToMatch({
	supabase,
	selectedConversation,
	userId,
	messageText,
	matchId,
	receiverId,
	createdAt = new Date().toISOString(),
}: SendMessageParams): Promise<SendMessageResult> {
	const isUuid = (value: unknown) =>
		typeof value === 'string' &&
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

	if (!supabase || typeof supabase.from !== 'function') {
		throw new Error('supabase client required');
	}
	if (!isUuid(selectedConversation)) {
		throw new Error('selectedConversation must be a UUID');
	}
	if (!isUuid(userId)) {
		throw new Error('userId must be a UUID');
	}
	if (typeof messageText !== 'string' || messageText.trim() === '') {
		throw new Error('messageText required');
	}
	if (createdAt && Number.isNaN(new Date(createdAt).getTime())) {
		throw new Error('createdAt invalid');
	}
	if (matchId && !isUuid(matchId)) {
		throw new Error('matchId invalid');
	}
	if (receiverId && !isUuid(receiverId)) {
		throw new Error('receiverId invalid');
	}

	const payload = {
		match_uuid: selectedConversation,
		match_id: matchId ?? null,
		sender_id: userId,
		receiver_id: receiverId ?? null,
		message_text: messageText,
		created_at: createdAt,
		metadata: {},
	};

	try {
		const {
			data: { session },
			error: sessionError,
		} = await supabase.auth.getSession();

		if (sessionError) {
			throw sessionError;
		}

		const userJwt = session?.access_token;
		if (!userJwt) {
			return { data: null, error: { message: 'Not authenticated' }, status: 401 };
		}

		const response = await fetch('/api/proxy-send-message', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${userJwt}`,
			},
			body: JSON.stringify(payload),
		});

		const text = await response.text();
		let parsed: any = null;
		try {
			parsed = text ? JSON.parse(text) : null;
		} catch {
			parsed = text;
		}

		if (response.ok) {
			return { data: parsed, error: null, status: response.status };
		}

		return {
			data: null,
			error: {
				message: parsed?.message || `Request failed ${response.status}`,
				status: response.status,
			},
			status: response.status,
		};
	} catch (error: any) {
		return {
			data: null,
			error: { message: error?.message || 'Unexpected' },
			status: 0,
		};
	}
}
