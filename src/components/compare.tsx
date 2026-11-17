"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { MAX_COMPARE } from "@/lib/compare";

// The list of books picked for comparing. It lives in this browser's localStorage (no account
// needed, nothing sent to the server) and every Compare button and the tray at the bottom share it.

type Picked = { id: string; title: string };

const KEY = "bookshop-compare";
const CHANGED = "bookshop-compare-changed";
const NOTHING: Picked[] = [];

// useSyncExternalStore needs the SAME array back as long as nothing changed, or React re-renders
// forever. So remember the last text read from storage and the list made from it.
let last: { raw: string | null; list: Picked[] } = { raw: null, list: NOTHING };

function read(): Picked[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY); // can throw (privacy modes, storage turned off)
  } catch {}
  if (raw === last.raw) return last.list;

  let list: Picked[] = [];
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    // Anything could be in storage (an older version, a curious user), so keep only valid entries.
    if (Array.isArray(parsed)) {
      list = parsed
        .filter((item): item is Picked => typeof item?.id === "string" && /^OL\d+W$/.test(item.id) && typeof item?.title === "string")
        .slice(0, MAX_COMPARE);
    }
  } catch {}
  last = { raw, list };
  return list;
}

function write(list: Picked[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
  window.dispatchEvent(new Event(CHANGED)); // tell every component on this page
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange); // changes made in other tabs
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function useCompareList() {
  // On the server (and the first render in the browser) there is no localStorage: use an empty list.
  return useSyncExternalStore(subscribe, read, () => NOTHING);
}

const remove = (id: string) => write(read().filter((book) => book.id !== id));

function compareUrl(ids: string[]) {
  return `/compare?ids=${ids.join(",")}`;
}

// ---------- the button on book pages and the wishlist ----------

export function CompareToggle({ bookId, title }: { bookId: string; title: string }) {
  const list = useCompareList();
  const picked = list.some((book) => book.id === bookId);
  const full = list.length >= MAX_COMPARE;

  return (
    <label className={`inline-flex items-center gap-2 text-sm ${!picked && full ? "text-zinc-400" : ""}`} title={!picked && full ? `You can compare up to ${MAX_COMPARE} books` : undefined}>
      <input
        type="checkbox"
        checked={picked}
        disabled={!picked && full}
        onChange={() => (picked ? remove(bookId) : write([...read(), { id: bookId, title }]))}
        className="h-4 w-4"
      />
      Compare
    </label>
  );
}

// ---------- the bar at the bottom of every page ----------

export function CompareTray() {
  const list = useCompareList();
  const pathname = usePathname();
  if (list.length === 0 || pathname === "/compare") return null;

  return (
    <>
      <div className="h-20 print:hidden" aria-hidden="true" /> {/* room, so the bar never covers the end of a page */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t print:hidden border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-6 py-3 font-sans text-sm">
          <span className="font-semibold">Compare:</span>
          {list.map((book) => (
            <span key={book.id} className="flex max-w-48 items-center gap-1 rounded-full bg-zinc-100 py-1 pr-1 pl-3 dark:bg-zinc-800">
              <span className="truncate">{book.title}</span>
              <button type="button" onClick={() => remove(book.id)} aria-label={`Remove ${book.title} from compare`} className="rounded-full px-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                ×
              </button>
            </span>
          ))}
          <span className="ml-auto flex items-center gap-4">
            <button type="button" onClick={() => write([])} className="text-zinc-500 underline">
              Clear
            </button>
            {list.length >= 2 ? (
              <Link href={compareUrl(list.map((book) => book.id))} className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-white dark:text-zinc-900">
                Compare {list.length} books
              </Link>
            ) : (
              <span className="text-zinc-500">Pick one more book</span>
            )}
          </span>
        </div>
      </div>
    </>
  );
}

// ---------- on the comparison page ----------

export function RemoveFromCompare({ bookId, ids }: { bookId: string; ids: string[] }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        remove(bookId);
        const rest = ids.filter((id) => id !== bookId);
        router.replace(rest.length > 0 ? compareUrl(rest) : "/compare");
      }}
      className="text-sm text-zinc-500 underline hover:text-zinc-900 dark:hover:text-zinc-100"
    >
      Remove
    </button>
  );
}
