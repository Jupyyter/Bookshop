import { cacheLife } from "next/cache";

// Open Library asks apps to identify themselves. Put your own email here.
const USER_AGENT = "BookshopDemo/0.1 (raducea.matei2005@gmail.com)";
const BASE_URL = "https://openlibrary.org";

class NotFoundError extends Error {}

// The one place that talks to Open Library: adds the User-Agent and turns bad responses into errors.
async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { "User-Agent": USER_AGENT } });
  if (res.status === 404) throw new NotFoundError(path);
  if (!res.ok) throw new Error(`Open Library responded with ${res.status} for ${path}`);
  return (await res.json()) as T;
}

// Same, for "nice to have" data: returns null instead of breaking the whole page.
async function getJsonOrNull<T>(path: string): Promise<T | null> {
  try {
    return await getJson<T>(path);
  } catch {
    return null;
  }
}

export function coverUrl(coverId: number, size: "S" | "M" | "L" = "M") {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

// Open Library book IDs look like "OL27448W". Anything else can't be a book.
export function isBookId(id: string) {
  return /^OL\d+W$/.test(id);
}

/* ---------- Lists of books (homepage) ---------- */

export type Book = {
  id: string; // e.g. "OL27448W"
  title: string;
  authors: string[];
  coverId: number | null;
  firstPublishYear: number | null;
};

type SubjectResponse = {
  works: {
    key: string; // e.g. "/works/OL27448W"
    title: string;
    authors?: { name: string }[];
    cover_id?: number | null;
    first_publish_year?: number | null;
  }[];
};

export async function getBooksBySubject(subject: string, limit = 12): Promise<Book[]> {
  "use cache";

  try {
    const data = await getJson<SubjectResponse>(
      `/subjects/${encodeURIComponent(subject)}.json?limit=${limit}`,
    );
    cacheLife("hours"); // success: reuse this result for about an hour

    return data.works.map((work) => ({
      id: work.key.replace("/works/", ""),
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

/* ---------- One book (book page) ---------- */

export type BookDetails = {
  id: string;
  title: string;
  authors: string[];
  description: string | null;
  coverId: number | null;
  subjects: string[];
  firstPublished: string | null;
  pages: number | null;
  rating: { average: number; count: number } | null;
};

// Every possible outcome, like a std::variant. TypeScript makes the page handle each one.
export type BookDetailsResult =
  | { status: "found"; book: BookDetails }
  | { status: "moved"; id: string }
  | { status: "not-found" }
  | { status: "error" };

type WorkResponse = {
  type?: { key: string }; // "/type/redirect" when Open Library merged two records
  location?: string; // where a redirect points, e.g. "/works/OL123W"
  title?: string;
  description?: string | { value: string };
  covers?: number[];
  subjects?: string[];
  first_publish_date?: string;
  authors?: { author?: { key: string } }[];
};
type AuthorResponse = { name?: string };
type RatingsResponse = { summary?: { average?: number | null; count?: number } };
type EditionsResponse = { entries?: { number_of_pages?: number }[] };

export async function getBookDetails(id: string): Promise<BookDetailsResult> {
  "use cache";

  try {
    // These three requests don't depend on each other, so they run at the same time.
    const [work, ratings, editions] = await Promise.all([
      getJson<WorkResponse>(`/works/${id}.json`),
      getJsonOrNull<RatingsResponse>(`/works/${id}/ratings.json`),
      getJsonOrNull<EditionsResponse>(`/works/${id}/editions.json?limit=20`),
    ]);

    if (work.type?.key === "/type/redirect" && work.location) {
      cacheLife("days");
      return { status: "moved", id: work.location.replace("/works/", "") };
    }

    // Author names need the author keys from the work, so these run second.
    const authorKeys = (work.authors ?? []).flatMap((a) => (a.author ? [a.author.key] : []));
    const authors = await Promise.all(
      authorKeys.map((key) => getJsonOrNull<AuthorResponse>(`${key}.json`)),
    );

    const pageCounts = (editions?.entries ?? []).flatMap((e) =>
      e.number_of_pages ? [e.number_of_pages] : [],
    );
    const average = ratings?.summary?.average;

    cacheLife("days"); // book details rarely change
    return {
      status: "found",
      book: {
        id,
        title: work.title ?? "Untitled",
        authors: authors.flatMap((a) => (a?.name ? [a.name] : [])),
        description:
          typeof work.description === "string" ? work.description : (work.description?.value ?? null),
        coverId: work.covers?.find((c) => c > 0) ?? null,
        // Skip machine tags like "nyt:hardcover-fiction" and remove duplicates.
        subjects: [...new Set((work.subjects ?? []).filter((s) => !s.includes(":")))].slice(0, 8),
        firstPublished: work.first_publish_date ?? null,
        pages: median(pageCounts),
        rating: average ? { average, count: ratings?.summary?.count ?? 0 } : null,
      },
    };
  } catch (error) {
    if (error instanceof NotFoundError) {
      cacheLife("hours");
      return { status: "not-found" };
    }
    console.error(`Could not load book ${id} from Open Library:`, error);
    cacheLife("minutes");
    return { status: "error" };
  }
}

// Different editions list different page counts; the middle value ignores weird outliers.
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}