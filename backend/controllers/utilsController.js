const axios = require("axios");

// ✅ Reverse Geocode
exports.reverseGeocode = async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res
        .status(400)
        .json({ success: false, message: "Missing coordinates" });
    }

    const response = await axios.get(
      "https://nominatim.openstreetmap.org/reverse",
      {
        params: { lat, lon, format: "json", addressdetails: 1 },
        headers: {
          "User-Agent": "CleanStreetApp/1.0 (contact@cleanstreet.local)",
          Accept: "application/json",
        },
        timeout: 15000,
      }
    );

    return res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    console.error("Reverse Geocode Error:", error.message);
    return res.status(200).json({
      success: false,
      data: {
        display_name: `Lat: ${req.query.lat}, Lon: ${req.query.lon}`,
      },
      message: "Nominatim failed — returned fallback data",
    });
  }
};

//  Forward Geocode
exports.forwardGeocode = async (req, res) => {
  try {
    const address = req.query.address || req.query.q;
    if (!address) {
      return res
        .status(400)
        .json({ success: false, message: "Missing address or query (q)" });
    }

    const nominatimUrl = "https://nominatim.openstreetmap.org/search";
    let response;

    try {
      response = await axios.get(nominatimUrl, {
        params: { q: address, format: "json", limit: 1 },
        headers: {
          "User-Agent": "CleanStreetApp/1.0 (contact@cleanstreet.local)",
          Accept: "application/json",
        },
        timeout: 30000, // ⏱ 30s timeout
      });
    } catch (innerErr) {
      console.warn("Nominatim primary request failed:", innerErr.message);
      // fallback: try again after 1s delay
      await new Promise((r) => setTimeout(r, 1000));
      try {
        response = await axios.get(nominatimUrl, {
          params: { q: address, format: "json", limit: 1 },
          headers: {
            "User-Agent": "CleanStreetApp/1.0 (contact@cleanstreet.local)",
            Accept: "application/json",
          },
          timeout: 30000,
        });
      } catch (finalErr) {
        console.error("Fallback geocode failed:", finalErr.message);
        return res.status(200).json({
          success: false,
          data: {},
          message: "Geocoding failed — fallback used",
        });
      }
    }

    if (Array.isArray(response.data) && response.data.length > 0) {
      return res.status(200).json({ success: true, data: response.data });
    }

    return res
      .status(404)
      .json({ success: false, message: "Address not found" });
  } catch (error) {
    console.error("Forward Geocode Error:", error.message);
    return res.status(200).json({
      success: false,
      data: {},
      message: "Geocoding failed — returned fallback data",
    });
  }
};
