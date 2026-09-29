import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Allow iframe embedding within AI Studio
  app.use((req, res, next) => {
    res.removeHeader("X-Frame-Options");
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  });

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "Daily Delivery Reporting System", timestamp: new Date().toISOString() });
  });

  // Server-side proxy for Google Apps Script Web App webhook requests to bypass CORS
  app.all("/api/proxy-sheets-webhook", async (req, res) => {
    try {
      const targetUrl = (req.query.url as string) || (req.body?.targetUrl as string);
      if (!targetUrl || !targetUrl.startsWith("https://script.google.com/macros/s/")) {
        return res.status(400).json({ status: "error", message: "Invalid Google Apps Script URL" });
      }

      if (req.method === "GET") {
        const fetchResponse = await fetch(targetUrl, {
          method: "GET",
          redirect: "follow",
        });
        const text = await fetchResponse.text();
        try {
          const json = JSON.parse(text);
          return res.json(json);
        } catch {
          return res.send(text);
        }
      } else {
        const payload = req.body?.payload || req.body;
        const fetchResponse = await fetch(targetUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: typeof payload === "string" ? payload : JSON.stringify(payload),
          redirect: "follow",
        });
        const text = await fetchResponse.text();
        try {
          const json = JSON.parse(text);
          return res.json(json);
        } catch {
          return res.send(text);
        }
      }
    } catch (e: any) {
      res.status(500).json({ status: "error", message: e.message || "Proxy request failed" });
    }
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

    // Fallback handler to guarantee transformed index.html is served in development
    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith("/api") || (url.includes(".") && !url.endsWith(".html"))) {
        return next();
      }
      try {
        const indexPath = path.join(process.cwd(), "index.html");
        let html = fs.readFileSync(indexPath, "utf-8");
        html = await vite.transformIndexHtml(url, html);
        res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).end(html);
      } catch (e) {
        next(e);
      }
    });
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

