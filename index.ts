import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import NodeCache from "node-cache";

const app = express();
const domainCache = new NodeCache();
const NEXTJS_SERVER = "http://localhost:3000";

app.use(express.json());

// Add domain to cache
app.post("/add-domain", (req: any, res: any) => {
    const { domain } = req.body;
    if (!domain) return res.status(400).json({ error: "Domain is required" });

    domainCache.set(domain, true);
    res.status(200).json({ message: "Domain added successfully" });
});

// Middleware to validate and route domains
app.use((req: any, res: any, next: any) => {
    const host = req.headers.host;
    console.log(host)
    if (!host || !domainCache.get(host)) {
        return res.status(404).send("Domain not found");
    }
    next();
});

// Proxy requests to Next.js
app.use(
    "*",
    createProxyMiddleware({
        target: NEXTJS_SERVER,
        changeOrigin: true,
    })
);

app.listen(4000, () => {
    console.log("Server running on port 4000");
});