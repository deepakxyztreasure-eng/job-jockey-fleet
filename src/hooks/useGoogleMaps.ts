import { useState, useEffect } from "react";

let isScriptLoading = false;
let isScriptLoaded = false;
const callbacks: (() => void)[] = [];

export function useGoogleMaps() {
  const [loaded, setLoaded] = useState<boolean>(() => {
    return typeof window !== "undefined" && !!(window as any).google?.maps;
  });
  const [loadError, setLoadError] = useState<string | null>(null);

  const DEFAULT_GOOGLE_MAPS_KEY = "AIzaSyCAPYcCyZfs_3qpFv09bcU3VRRdoEwAIek";
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || DEFAULT_GOOGLE_MAPS_KEY;

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ((window as any).google?.maps) {
      setLoaded(true);
      return;
    }

    if (!apiKey) {
      setLoadError("Missing Google Maps API Key in configuration.");
      return;
    }

    if (isScriptLoaded) {
      setLoaded(true);
      return;
    }

    callbacks.push(() => {
      setLoaded(true);
    });

    if (isScriptLoading) {
      return;
    }

    isScriptLoading = true;

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      isScriptLoading = false;
      isScriptLoaded = true;
      setLoaded(true);
      callbacks.forEach((cb) => cb());
      callbacks.length = 0;
    };

    script.onerror = () => {
      isScriptLoading = false;
      setLoadError("Failed to load Google Maps SDK.");
    };

    document.head.appendChild(script);
  }, [apiKey]);

  return { isLoaded: loaded, loadError };
}
