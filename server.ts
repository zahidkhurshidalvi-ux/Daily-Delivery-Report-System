import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "Daily Delivery Reporting System", timestamp: new Date().toISOString() });
  });

  // Dedicated route to serve real signed Android APK
  app.get(["/PakistanPost_DDRS.apk", "/PakistanPost_DeliveryReport.apk", "/download/apk", "/app.apk"], (req, res) => {
    const apkFile = path.join(process.cwd(), "public", "PakistanPost_DDRS.apk");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.download(apkFile, "PakistanPost_DDRS.apk", (err) => {
      if (err && !res.headersSent) {
        res.status(500).send("APK download error");
      }
    });
  });

  // Dedicated route specifically for /sw.js to guarantee valid JS MIME type
  app.get("/sw.js", (req, res) => {
    const swFile = path.join(process.cwd(), "public", "sw.js");
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Service-Worker-Allowed", "/");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(swFile);
  });

  // Dedicated route for manifest.json
  app.get("/manifest.json", (req, res) => {
    const manifestFile = path.join(process.cwd(), "public", "manifest.json");
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    res.sendFile(manifestFile);
  });

  // Serve static assets from public folder
  app.use(express.static(path.join(process.cwd(), "public")));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
