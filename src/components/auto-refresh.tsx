"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Asks the server for a fresh version of the current page every few seconds.
// Only the changed parts are swapped in: no full reload, no lost scroll position.
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(timer); // stop when the page is left
  }, [router, seconds]);

  return null; // shows nothing
}
