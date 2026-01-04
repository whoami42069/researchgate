import { extractText } from "unpdf";

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
        // Convert Buffer to Uint8Array as required by unpdf
        const uint8Array = new Uint8Array(buffer);
        const { text } = await extractText(uint8Array);
        // text is an array of strings (one per page), join them
        return Array.isArray(text) ? text.join('\n') : text;
    } catch (error) {
        console.error("Error parsing PDF:", error);
        throw new Error("Failed to parse PDF");
    }
}

/**
 * Extracts and summarizes text from a PDF, focusing on key sections.
 * Returns a condensed version (max ~3000 chars) that captures essential content.
 * Includes timeout handling for slow PDFs.
 * @param buffer - PDF file buffer
 * @param timeoutMs - Maximum time to wait for PDF processing (default 10000ms)
 * @returns Condensed text with key sections
 */
export async function extractAndSummarizeText(
    buffer: Buffer,
    timeoutMs: number = 10000
): Promise<string> {
    try {
        // Wrap extraction in a timeout promise
        const extractionPromise = extractTextFromPDF(buffer);
        const timeoutPromise = new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error("PDF extraction timeout")), timeoutMs)
        );

        const fullText = await Promise.race([extractionPromise, timeoutPromise]);

        // Optimized MAX_CHARS: target 2000-3000 chars per PDF
        const MAX_CHARS = 3000;

        // If the text is already short, return it as-is
        if (fullText.length <= MAX_CHARS) {
            return fullText;
        }

        // Extract key sections using improved pattern matching
        const sections = extractKeySections(fullText);

        // Build condensed version with optimized prioritization
        let condensed = "";

        // Optimized priority: Abstract (full) > Intro (500) > Conclusion (500) > Methods (brief)
        const sectionPriorities = [
            { key: "abstract", maxChars: 1000, label: "ABSTRACT" },
            { key: "introduction", maxChars: 500, label: "INTRODUCTION" },
            { key: "conclusion", maxChars: 500, label: "CONCLUSION" },
            { key: "methods", maxChars: 300, label: "METHODS" },
        ];

        for (const { key, maxChars, label } of sectionPriorities) {
            const sectionText = sections[key];
            if (!sectionText) continue;

            const remaining = MAX_CHARS - condensed.length;
            if (remaining <= 50) break; // Not enough space left

            const header = `\n=== ${label} ===\n`;
            const charBudget = Math.min(maxChars, remaining - header.length);

            if (charBudget > 0) {
                condensed += header + sectionText.slice(0, charBudget).trim();
            }
        }

        // If sections extraction failed or resulted in very little text,
        // fall back to taking the first MAX_CHARS
        if (condensed.length < 500) {
            return fullText.slice(0, MAX_CHARS);
        }

        return condensed.trim();
    } catch (error) {
        console.error("Error summarizing PDF:", error);
        throw new Error(`Failed to summarize PDF: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

/**
 * Extracts key sections from academic paper text.
 * Uses improved regex patterns to reliably identify sections.
 * Skips references, acknowledgments, and appendices.
 */
function extractKeySections(text: string): Record<string, string> {
    const sections: Record<string, string> = {};

    // Normalize text for matching
    const lowerText = text.toLowerCase();

    // Improved section patterns with better regex
    const patterns = {
        abstract: [
            /(?:^|\n)\s*abstract\s*[\n:]/,
            /(?:^|\n)\s*summary\s*[\n:]/,
            /(?:^|\n)\s*0\.\s*abstract/,
        ],
        introduction: [
            /(?:^|\n)\s*1\.?\s*introduction\s*[\n:]/,
            /(?:^|\n)\s*introduction\s*[\n:]/,
            /(?:^|\n)\s*i\.?\s*introduction/,
        ],
        methods: [
            /(?:^|\n)\s*(?:2|3|4)\.?\s*methods?\s*[\n:]/,
            /(?:^|\n)\s*methodology\s*[\n:]/,
            /(?:^|\n)\s*materials?\s+and\s+methods?/,
        ],
        conclusion: [
            /(?:^|\n)\s*conclusions?\s*[\n:]/,
            /(?:^|\n)\s*discussion\s*[\n:]/,
            /(?:^|\n)\s*(?:\d+\.?\s*)?conclusions?\s+and\s+/,
        ],
    };

    // Sections to skip (find their positions to avoid extracting them)
    const skipPatterns = [
        /(?:^|\n)\s*references\s*[\n:]/,
        /(?:^|\n)\s*bibliography\s*[\n:]/,
        /(?:^|\n)\s*acknowledgments?\s*[\n:]/,
        /(?:^|\n)\s*appendix\s*[\n:]/,
        /(?:^|\n)\s*supplementary\s+materials?\s*[\n:]/,
    ];

    // Find where to stop extracting (earliest skip section)
    let stopIndex = text.length;
    for (const skipPattern of skipPatterns) {
        const match = lowerText.match(skipPattern);
        if (match && match.index !== undefined && match.index < stopIndex) {
            stopIndex = match.index;
        }
    }

    // Extract sections
    for (const [sectionName, sectionPatterns] of Object.entries(patterns)) {
        for (const pattern of sectionPatterns) {
            const match = lowerText.match(pattern);
            if (match && match.index !== undefined) {
                const startIdx = match.index;

                // Skip if this section is in the "skip zone"
                if (startIdx >= stopIndex) continue;

                // Find the end of this section
                let endIdx = Math.min(startIdx + 1500, stopIndex);

                // Try to find the next major section header
                const remainingText = lowerText.slice(startIdx + match[0].length);
                const nextHeaderMatch = remainingText.match(
                    /(?:\n\s*\n\s*(?:\d+\.?\s*)?[A-Z][a-zA-Z\s]+[\n:])|(?:\n\s*[IVX]+\.?\s*[A-Z])/
                );

                if (nextHeaderMatch && nextHeaderMatch.index !== undefined) {
                    const tentativeEnd = startIdx + match[0].length + nextHeaderMatch.index;
                    endIdx = Math.min(endIdx, tentativeEnd);
                }

                // Extract section text (skip the header line itself)
                const sectionText = text
                    .slice(startIdx + match[0].length, endIdx)
                    .trim();

                if (sectionText.length > 50) {
                    // Only include if meaningful content
                    sections[sectionName] = sectionText;
                }
                break;
            }
        }
    }

    return sections;
}
