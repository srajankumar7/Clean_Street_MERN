exports.extractPostalCode = (address) => {
  try {
    if (!address || typeof address !== "string") return "";
    const a = address.trim();

    const pin6 = a.match(/\b(\d{6})\b/);
    if (pin6) return pin6[1];

    const zip5 = a.match(/\b(\d{5})(?:-\d{4})?\b/);
    if (zip5) return zip5[1];

    const numGroup = a.match(/\b(\d{3,6})\b/);
    if (numGroup) return numGroup[1];

    const parts = a
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      const last = parts[parts.length - 1];

      const cleaned = String(last).replace(/[^0-9a-zA-Z]/g, "");
      if (cleaned) return cleaned;
      return last;
    }

    return "";
  } catch (error) {
    console.error("Error extracting postal code:", error);
    return "";
  }
};
