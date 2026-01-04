import OpenAI from "openai";

const apiKey = process.env.DEEPSEEK_API_KEY;

if (!apiKey) {
    // We don't throw here to allow build even without key, but it will fail at runtime
    console.warn("Missing DEEPSEEK_API_KEY environment variable");
}

export const deepseek = new OpenAI({
    apiKey: apiKey || "dummy_key",
    baseURL: "https://api.deepseek.com", // Official DeepSeek API endpoint
});

export const MODELS = {
    CHAT: "deepseek-chat",       // DeepSeek V3 - Best for research analysis & reasoning
    REASONER: "deepseek-reasoner", // DeepSeek R1 - Deep reasoning (if needed)
};

// Token limits
export const MAX_TOKENS = 100000;

/**
 * Truncates text to fit within a token limit.
 * Uses a rough estimation of ~4 characters per token.
 * @param text - The text to truncate
 * @param maxTokens - Maximum number of tokens allowed
 * @returns Truncated text that fits within the token limit
 */
export function truncateToTokenLimit(text: string, maxTokens: number): string {
    const CHARS_PER_TOKEN = 4;
    const maxChars = maxTokens * CHARS_PER_TOKEN;

    if (text.length <= maxChars) {
        return text;
    }

    // Truncate and add ellipsis
    return text.slice(0, maxChars - 3) + "...";
}

/**
 * Estimates the number of tokens in a text string.
 * Uses a rough estimation of ~4 characters per token.
 * @param text - The text to estimate
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
    const CHARS_PER_TOKEN = 4;
    return Math.ceil(text.length / CHARS_PER_TOKEN);
}
