// MapLibre does its heavy map work in a background "worker" file. After Next.js bundles the app,
// MapLibre can't find that file by itself, so we serve a copy from public/ and point the map at it.
// npm runs this automatically after every `npm install` (the "postinstall" script in package.json),
// so the copy always matches the installed MapLibre version.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public", { recursive: true });
copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/maplibre-gl-worker.mjs");
console.log("Copied the MapLibre worker to public/maplibre-gl-worker.mjs");
