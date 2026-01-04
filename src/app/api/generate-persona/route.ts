import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Use GPT-4o-mini for better quality persona generation
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
    try {
        const {
            summary,
            searchQueries,
            exclusionCriteria,
            buzzwords,
            researchField,
            researchContext
        } = await req.json();

        if (!summary) {
            return NextResponse.json({ error: "Research profile summary is required" }, { status: 400 });
        }

        const systemPrompt = `You are an expert at creating AI assistant personas for academic research.
Your task is to generate a comprehensive, copy-pastable persona prompt that can be used in ChatGPT, Claude, or any other AI assistant.

The persona should follow the AIM framework:
- A (Agent/Persona): Define WHO the AI should act as - their expertise, background, and personality
- I (Input/Instructions): Define the CONTEXT, guidelines, do's and don'ts, and information boundaries
- M (Mission): Define WHAT the AI should accomplish and how it should help the user

Generate a detailed, professional persona that:
1. Is specific to the research domain and topic
2. Includes clear boundaries on what to include/exclude
3. Has actionable instructions for finding and evaluating sources
4. Maintains academic rigor and proper citation practices
5. Is immediately usable when pasted into any AI chat interface

Output ONLY the persona text - no explanations, no markdown code blocks, just the ready-to-paste persona.`;

        const userPrompt = `Create an AIM persona for the following research profile:

RESEARCH FIELD: ${researchField || "Academic Research"}

RESEARCH CONTEXT/GOAL:
${researchContext || "Not specified"}

RESEARCH SCOPE SUMMARY:
${summary}

KEY SEARCH QUERIES:
${searchQueries?.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n') || "None specified"}

DOMAIN KEYWORDS/BUZZWORDS:
${buzzwords?.join(', ') || "None specified"}

EXCLUSION CRITERIA (topics/sources to avoid):
${exclusionCriteria?.map((c: string) => `- ${c}`).join('\n') || "None specified"}

Generate a comprehensive AIM persona that a researcher can paste into ChatGPT or Claude to get specialized help with this exact research topic. Make it detailed, specific, and immediately actionable.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 2000,
        });

        const persona = completion.choices[0].message.content || "";

        return NextResponse.json({ persona });

    } catch (error) {
        console.error("Persona generation error:", error);
        return NextResponse.json(
            { error: "Failed to generate persona" },
            { status: 500 }
        );
    }
}
