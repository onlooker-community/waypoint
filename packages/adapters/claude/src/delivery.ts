import type { WaypointHint } from "@waypoint/core";
import type { ClaudeMessageContext } from "./types.js";

// Appends hint content to the trailing user message after a blank line.
//
// Deliberately no framing: no "Here is a hint:", no "Hint:" prefix, no
// quotation. The reasoner should weave the suggestion in naturally — adding
// framing telegraphs reliance and biases downstream `hintReferenced`
// measurements.
//
// If the conversation has no user message yet (e.g. a fresh session that
// only has a system prompt), a new user message is appended that contains
// the hint text alone.
export function appendHintToNextUserMessage(
	hint: WaypointHint,
	context: ClaudeMessageContext
): ClaudeMessageContext {
	const hintText = hint.content;

	let idx = -1;
	for (let i = context.messages.length - 1; i >= 0; i -= 1) {
		if (context.messages[i]?.role === "user") {
			idx = i;
			break;
		}
	}

	if (idx === -1) {
		return {
			...context,
			messages: [...context.messages, { role: "user", content: hintText }],
		};
	}

	const target = context.messages[idx];
	if (!target) {
		return {
			...context,
			messages: [...context.messages, { role: "user", content: hintText }],
		};
	}

	const trimmed = target.content.trim();
	const merged = trimmed.length > 0 ? `${target.content}\n\n${hintText}` : hintText;

	const messages = context.messages.slice();
	messages[idx] = { role: target.role, content: merged };

	return { ...context, messages };
}
