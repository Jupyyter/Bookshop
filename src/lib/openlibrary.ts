import { cacheLife } from "next/cache";

// Open Library asks apps to identify themselves. Put your own email here.
const USER_AGENT = "BookshopDemo/0.1 (raducea.matei2005@gmail.com)";

// The shape WE use in our app.
export type Book = {
  key: string; // e.g. "/works/OL45804W"
  title: string;
  authors: string[];
  coverId: number | null;
  firstPublishYear: number | null;
};

// The shape Open Library sends back (only the fields we care about).
type OpenLibraryWork = {
  key: string;
  title: string;
  authors?: { name: string }[];
  cover_id?: number | null;
  first_publish_year?: number | null;
};

export async function getBooksBySubject(subject: string, limit = 12): Promise<Book[]> {
  "use cache";

  try {
    const res = await fetch(
      `https://openlibrary.org/subjects/${encodeURIComponent(subject)}.json?limit=${limit}`,
      { headers: { "User-Agent": USER_AGENT } },
    );
    if (!res.ok) throw new Error(`Open Library responded with ${res.status}`);

    const data: { works: OpenLibraryWork[] } = await res.json();
    cacheLife("hours"); // success: reuse this result for about an hour

    return data.works.map((work) => ({
      key: work.key,
      title: work.title,
      authors: (work.authors ?? []).map((author) => author.name),
      coverId: work.cover_id ?? null,
      firstPublishYear: work.first_publish_year ?? null,
    }));
  } catch (error) {
    console.error("Could not load books from Open Library:", error);
    cacheLife("minutes"); // failure: try again soon instead of caching the error for an hour
    return [];
  }
}

export function coverUrl(coverId: number, size: "S" | "M" | "L" = "M") {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}