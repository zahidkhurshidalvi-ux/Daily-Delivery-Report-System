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
  app.get(["/PakistanPost_DDRS.apk", "/PakistanPost_DeliveryReport.apk", "/download/apk"], (req, res) => {
    const apkFile = path.join(process.cwd(), "public", "PakistanPost_DDRS.apk");
    res.setHeader("Content-Disposition", 'attachment; filename="PakistanPost_DDRS.apk"');
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.sendFile(apkFile);
  });

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
