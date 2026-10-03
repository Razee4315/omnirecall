/// Tauri commands reject with a plain string (the serialized AppError), while
/// browser APIs throw Error objects. Normalise both to a message.
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (typeof err === "string" && err.trim()) return err;
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

/// Turn a raw provider/backend error into something a user can act on.
export function parseApiError(err: unknown): string {
  const raw = errorMessage(err, "Failed to get response");
  const lower = raw.toLowerCase();

  if (lower.startsWith("no response received")) {
    return `${raw}. Try again, rephrase, or switch models.`;
  }
  if (raw.includes("429") || lower.includes("quota") || raw.includes("RESOURCE_EXHAUSTED")) {
    return "Rate limit exceeded. Please wait a moment and try again.";
  }
  if (raw.includes("401") || lower.includes("unauthorized") || lower.includes("invalid api key") || lower.includes("invalid_api_key")) {
    return "Invalid API key. Please check your settings.";
  }
  if (raw.includes("404") || lower.includes("model not found") || lower.includes("not_found_error")) {
    return "Model not found. Please select a different model.";
  }
  if (lower.includes("context_length") || lower.includes("too long") || lower.includes("max tokens")) {
    return "Message too long. Try shortening your input or clearing some context.";
  }
  if (lower.includes("cannot connect to ollama")) {
    return "Cannot connect to Ollama. Check that it is running and the URL in Settings is correct.";
  }
  if (lower.includes("network") || raw.includes("ECONNREFUSED") || lower.includes("timed out") || lower.includes("timeout") || lower.includes("could not connect")) {
    return "Connection failed. Check your internet connection.";
  }

  if (raw.length > 150) {
    const match = raw.match(/message["']?\s*[:=]\s*["']([^"']+)["']/i);
    if (match) return match[1].slice(0, 140);
    return raw.slice(0, 140) + "...";
  }
  return raw;
}
