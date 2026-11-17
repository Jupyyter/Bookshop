// Shared by the server (the comparison page) and the browser (the Compare buttons and tray).
// Kept out of the "use client" file: a server file importing a plain value from a client file
// gets a reference to it, not the value itself.
export const MAX_COMPARE = 4;
