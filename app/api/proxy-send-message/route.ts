import { NextResponse } from "next/server";

const EDGE_FUNCTION_URL =
	process.env.SUPABASE_EDGE_FUNCTION_URL ||
	"https://tsnnpeddaydwrfhwjicu.functions.supabase.co/send_message_new";

export async function POST(request: Request) {
	try {
		const authHeader = request.headers.get("authorization");
		if (!authHeader) {
			return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
		}

		const payload = await request.json();

		const edgeResponse = await fetch(EDGE_FUNCTION_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: authHeader,
			},
			body: JSON.stringify(payload),
		});

		const text = await edgeResponse.text();
		const contentType = edgeResponse.headers.get("content-type") || "";

		if (contentType.includes("application/json")) {
			try {
				return NextResponse.json(JSON.parse(text), { status: edgeResponse.status });
			} catch {
				return NextResponse.json({ message: text }, { status: edgeResponse.status });
			}
		}

		return new Response(text, {
			status: edgeResponse.status,
			headers: { "Content-Type": "text/plain" },
		});
	} catch (error: any) {
		return NextResponse.json({ error: error?.message || "Unknown error" }, { status: 500 });
	}
}

export function GET() {
	return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}
