import axios from "axios";
import { fromLonLat } from "ol/proj";

const BACKEND = process.env.REACT_APP_API_URL || "http://localhost:5000";

const isCoordinateFallbackString = (s) => {
  if (!s || typeof s !== "string") return false;
  // common prefix used in your code: "Lat: "
  if (s.trim().startsWith("Lat:")) return true;
  // also treat plain "lat, lon" patterns like "17.2138,78.6055" as coordinates
  const coordPattern = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/;
  if (coordPattern.test(s.trim())) return true;
  return false;
};

/**
 * Reverse geocode (lon, lat) -> readable address using backend proxy.
 */
export const reverseGeocode = async (lon, lat) => {
  try {
    const url = `${BACKEND}/api/utils/reverse`;
    const resp = await axios.get(url, {
      params: { lat, lon },
      timeout: 20000,
    });

    if (resp.data?.success && resp.data.data?.display_name) {
      return resp.data.data.display_name;
    }

    // If proxy returned success but no display_name, fall back gracefully
    if (resp.data?.success && resp.data.data) {
      return (
        resp.data.data.display_name ||
        `Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)} (Address not found)`
      );
    }

    // Otherwise return readable fallback
    console.warn("reverseGeocode: unexpected response", resp.data);
    return `Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)} (Geocode failed)`;
  } catch (error) {
    // Better logging for debugging
    console.error("MapUtils.reverseGeocode error:", error?.message || error, {
      backendUrl: `${BACKEND}/api/utils/reverse`,
      params: { lat, lon },
      responseData: error?.response?.data,
    });
    return `Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)} (Geocode error)`;
  }
};

/**
 * Forward geocode an address string -> [lon, lat] using backend proxy.
 * Returns null when address is not suitable or not found.
 */
export const forwardGeocode = async (address) => {
  if (!address || typeof address !== "string" || address.trim() === "")
    return null;

  // Avoid sending coordinate fallback strings back to nominatim
  if (isCoordinateFallbackString(address)) {
    console.info(
      "forwardGeocode: input looks like coordinates/fallback — skipping forward geocode:",
      address
    );
    return null;
  }

  try {
    const url = `${BACKEND}/api/utils/forward`;
    const resp = await axios.get(url, {
      params: { q: address },
      timeout: 20000,
    });

    if (
      resp.data?.success &&
      Array.isArray(resp.data.data) &&
      resp.data.data.length > 0
    ) {
      const place = resp.data.data[0];
      const lat = parseFloat(place.lat);
      const lon = parseFloat(place.lon);
      if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
        return [lon, lat];
      }
    }

    return null;
  } catch (error) {
    console.error("MapUtils.forwardGeocode error:", error?.message || error, {
      backendUrl: `${BACKEND}/api/utils/forward`,
      params: { q: address },
      responseData: error?.response?.data,
    });
    return null;
  }
};

const DEFAULT_LON_LAT = [78.4744, 17.385]; // Hyderabad
export const getInitialCenterForAddress = async (address) => {
  try {
    const coords = await forwardGeocode(address);
    if (coords && coords.length === 2) return fromLonLat(coords);
  } catch (e) {
    console.error("getInitialCenterForAddress error:", e);
  }
  return fromLonLat(DEFAULT_LON_LAT);
};

// Backwards compatible default centre
export const initialCenter = fromLonLat(DEFAULT_LON_LAT);
