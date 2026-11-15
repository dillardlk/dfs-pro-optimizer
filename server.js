
require("dotenv").config();
const express = require("express");
const path = require("path");
const publicCloudConfig = require("./cloud-config");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.SPORTSDATAIO_API_KEY;

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/config", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(publicCloudConfig());
});

app.get("/api/status", (req, res) => {
  res.json({
    online: true,
    sportsDataConnected: Boolean(API_KEY)
  });
});

app.get("/api/slates/:season/:week", async (req, res) => {
  if (!API_KEY) {
    return res.status(503).json({
      error: "SportsDataIO API key not configured"
    });
  }

  const { season, week } = req.params;

  if (!/^\d{4}$/.test(season) ||
      !/^\d{1,2}$/.test(week) ||
      Number(week) < 1 ||
      Number(week) > 22) {
    return res.status(400).json({
      error: "Invalid season or week"
    });
  }

  try {
    const url =
      `https://api.sportsdata.io/v3/nfl/stats/json/` +
      `DfsSlatesByWeek/${season}/${week}`;

    const response = await fetch(url, {
      headers: {
        "Ocp-Apim-Subscription-Key": API_KEY
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      return res.status(502).json({
        error: `SportsDataIO returned HTTP ${response.status}`
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(502).json({
      error: "Unable to retrieve SportsDataIO data"
    });
  }
});

app.get("/api/projections/:season/:week", async (req, res) => {
  if (!API_KEY) {
    return res.status(503).json({
      error: "SportsDataIO API key not configured"
    });
  }

  const { season, week } = req.params;

  if (!/^\d{4}$/.test(season) ||
      !/^\d{1,2}$/.test(week) ||
      Number(week) < 1 ||
      Number(week) > 22) {
    return res.status(400).json({
      error: "Invalid season or week"
    });
  }

  try {
    const url =
      "https://api.sportsdata.io/v3/nfl/projections/json/" +
      `PlayerGameProjectionStatsByWeek/${season}/${week}`;

    const response = await fetch(url, {
      headers: {
        "Ocp-Apim-Subscription-Key": API_KEY
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      return res.status(502).json({
        error: `SportsDataIO returned HTTP ${response.status}`
      });
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      return res.status(502).json({
        error: "Unexpected projections response"
      });
    }

    res.json(data);
  } catch (error) {
    res.status(502).json({
      error: "Unable to retrieve NFL projections"
    });
  }
});

app.listen(PORT, () => {
  console.log(`DFS Pro Optimizer running on port ${PORT}`);
});

