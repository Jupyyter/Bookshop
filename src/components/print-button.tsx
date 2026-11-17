"use client";

// Opens the browser's print dialog, where "Save as PDF" is one of the printers.
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 print:hidden dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      Print or save as PDF
    </button>
  );
}
