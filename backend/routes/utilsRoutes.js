const express = require("express");
const {
  reverseGeocode,
  forwardGeocode,
} = require("../controllers/utilsController");

const router = express.Router();

// GET /api/utils/reverse?lat=..&lon=..
router.get("/reverse", reverseGeocode);

// GET /api/utils/forward?q=address
router.get("/forward", forwardGeocode);

module.exports = router;
