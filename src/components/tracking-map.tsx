"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import { useEffect, useRef } from "react";

export type MapStop = { name: string; lat: number; lng: number; reached: boolean };
type Props = { stops: MapStop[]; currentIndex: number };

// Free map tiles from OpenStreetMap data: no account, no API key.
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

export function TrackingMap({ stops, currentIndex }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const parcelRef = useRef<Marker | null>(null);
  const latestProps = useRef<Props>({ stops, currentIndex });

  // Create the map once, when the component first appears in the browser.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // MapLibre needs a real browser (WebGL), so it's loaded here instead of at the top of the file.
      const { Map, Marker, NavigationControl, setWorkerUrl } = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;
      setWorkerUrl("/maplibre-gl-worker.mjs"); // copied into public/ by scripts/copy-map-worker.mjs

      const map = new Map({ container: containerRef.current, style: MAP_STYLE, center: [25, 45.9], zoom: 5.3 });
      map.addControl(new NavigationControl({ showCompass: false }));
      mapRef.current = map;

      // The parcel and the destination are small HTML markers placed on top of the map.
      parcelRef.current = new Marker({ element: emojiMarker("📦", "The parcel is here") });
      const destination = latestProps.current.stops.at(-1);
      if (destination) {
        new Marker({ element: emojiMarker("🏠", destination.name) }).setLngLat([destination.lng, destination.lat]).addTo(map);
      }

      map.on("load", () => {
        map.addSource("route-done", { type: "geojson", data: lineFeature([]) });
        map.addSource("route-todo", { type: "geojson", data: lineFeature([]) });
        map.addSource("stops", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

        map.addLayer({
          id: "route-todo",
          type: "line",
          source: "route-todo",
          paint: { "line-color": "#a1a1aa", "line-width": 3, "line-dasharray": [2, 2] },
        });
        map.addLayer({
          id: "route-done",
          type: "line",
          source: "route-done",
          paint: { "line-color": "#16a34a", "line-width": 4 },
        });
        map.addLayer({
          id: "stops",
          type: "circle",
          source: "stops",
          paint: {
            "circle-radius": 6,
            "circle-color": ["case", ["get", "reached"], "#16a34a", "#ffffff"],
            "circle-stroke-color": ["case", ["get", "reached"], "#ffffff", "#a1a1aa"],
            "circle-stroke-width": 2,
          },
        });

        draw(map, parcelRef.current, latestProps.current);

        const lngs = latestProps.current.stops.map((s) => s.lng);
        const lats = latestProps.current.stops.map((s) => s.lat);
        map.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { padding: 48, maxZoom: 9, duration: 0 },
        );
      });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove(); // free the WebGL resources when the page is left
      mapRef.current = null;
    };
  }, []);

  // When the page refreshes with new tracking steps, move the parcel and recolour the route.
  useEffect(() => {
    latestProps.current = { stops, currentIndex };
    const map = mapRef.current;
    if (map?.isStyleLoaded()) draw(map, parcelRef.current, latestProps.current);
  }, [stops, currentIndex]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Map of the parcel's route"
      className="mt-6 h-80 w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800"
    />
  );
}

function draw(map: MapLibreMap, parcel: Marker | null, { stops, currentIndex }: Props) {
  const coords = stops.map((s) => [s.lng, s.lat]);
  (map.getSource("route-done") as GeoJSONSource | undefined)?.setData(lineFeature(coords.slice(0, currentIndex + 1)));
  (map.getSource("route-todo") as GeoJSONSource | undefined)?.setData(lineFeature(coords.slice(currentIndex)));
  (map.getSource("stops") as GeoJSONSource | undefined)?.setData({
    type: "FeatureCollection",
    features: stops.map((s) => ({
      type: "Feature",
      properties: { name: s.name, reached: s.reached },
      geometry: { type: "Point", coordinates: [s.lng, s.lat] },
    })),
  });

  const here = stops[currentIndex];
  if (parcel && here) parcel.setLngLat([here.lng, here.lat]).addTo(map);
}

function lineFeature(coordinates: number[][]): GeoJSON.Feature<GeoJSON.LineString> {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } };
}

function emojiMarker(emoji: string, title: string) {
  const element = document.createElement("div");
  element.textContent = emoji;
  element.title = title;
  element.style.fontSize = "26px";
  element.style.lineHeight = "1";
  return element;
}
