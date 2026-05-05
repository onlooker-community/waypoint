import type { WaypointHint } from "@waypoint/core";
import type { ClaudeMessageContext } from "./types.js";

/**
 * Appends hint content to the next user message after a blank line.
 * No hint framing is added to reduce explicit reliance.
 */
export function appendHintToNextUserMessage(
	hint: WaypointHint,
	context: ClaudeMessageContext
): ClaudeMessageContext {
	let idx = -1;
	for (let i = context.messages.length - 1; i >= 0; i -= 1) {
		if (context.messages[i]?.role === "user") {
			idx = i;
			break;
		}
	}

	// If no user message exists yet, create one with just the hint.
	if (idx === -1) {
		return {
			...context,
			messages: [...context.messages, { role: "user", content: hint.content }],
		};
	}

	const target = context.messages[idx];
	if (!target) {
		return {
			...context,
			messages: [...context.messages, { role: "user", content: hint.content }],
		};
	}

	const merged = target.content.trim().length
		? `${target.content}\n\n${hint.content}`
		: hint.content;

	const messages = [...context.messages];
	messages[idx] = {
		role: target.role,
		content: merged,
	};

	return {
		...context,
		messages,
	};
}
