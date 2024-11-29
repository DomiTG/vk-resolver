import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import NodeCache from "node-cache";
import { exec } from "child_process";

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

//Let's encrypt SSL certificate creator
const LETSENCRYPT_FOLDER = "./certs";
const createSSLCertificate = async (domain: string) => {
    return new Promise((resolve, reject) => {
        exec(
            `certbot certonly --webroot -w /var/www/html -d ${domain} --non-interactive --agree-tos --email admin@vytvorkonverzku.cz`,
            (err, stdout, stderr) => {
                if (err) {
                    console.error(err);
                    reject(err);
                }
                console.log(stdout);
                console.log(stderr);
                resolve({ stdout, stderr });
            })
        })
    
}

app.listen(4000, async () => {
    console.log("Server running on port 4000");
    await createSSLCertificate("test.vytvorkonverzku.cz");
});