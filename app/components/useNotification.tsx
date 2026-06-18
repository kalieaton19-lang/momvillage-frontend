"use client";
import { useState, useCallback } from "react";

export function useNotification() {
	const [message, setMessage] = useState<string | null>(null);

	const showNotification = useCallback((msg: string, _t: "success" | "error" = "error") => {
		setMessage(msg);
		setTimeout(() => {
			setMessage(null);
		}, 3500);
	}, []);

	const NotificationComponent = message ? (
		<div
			className="fixed top-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-pink-800 bg-pink-700 px-6 py-3 font-medium text-white shadow-lg transition-all duration-300"
			style={{ minWidth: 200, textAlign: "center" }}
		>
			{message}
		</div>
	) : null;

	return { showNotification, NotificationComponent };
}
