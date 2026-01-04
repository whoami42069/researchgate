import { XMLParser } from "fast-xml-parser";

export interface Article {
    id: string;
    title: string;
    summary: string;
    authors: string[];
    published: string;
    link: string;
}

// Maximum number of articles to fetch from ArXiv
export const MAX_ARTICLES = 100;

export async function searchArxiv(query: string, maxResults: number = 10): Promise<Article[]> {
    // Enforce the maximum article limit
    const limitedMaxResults = Math.min(maxResults, MAX_ARTICLES);
    try {
        // ArXiv API requires queries to be cleaner
        const cleanQuery = query.replace(/[^a-zA-Z0-9\s-]/g, "").split(" ").slice(0, 6).join(" ");
        const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(cleanQuery)}&start=0&max_results=${limitedMaxResults}&sortBy=relevance&sortOrder=descending`;

        const response = await fetch(url);
        const xml = await response.text();

        const parser = new XMLParser({ ignoreAttributes: false });
        const result = parser.parse(xml);

        const entries = result.feed.entry;
        if (!entries) return [];

        const list = Array.isArray(entries) ? entries : [entries];

        return list.map((entry: any) => ({
            id: entry.id,
            title: entry.title.replace(/\n/g, " ").trim(),
            summary: entry.summary.replace(/\n/g, " ").trim(),
            authors: Array.isArray(entry.author) ? entry.author.map((a: any) => a.name) : [entry.author.name],
            published: entry.published,
            link: entry.id,
        }));
    } catch (error) {
        console.error("ArXiv Search Error:", error);
        return [];
    }
}
