import Greenlock from "greenlock";
import express, { Request, Response } from "express";
import http from "http";

const app = express();
app.use(express.json());

interface DomainRecord {
  domain: string;
  target: string;
}

// In-memory storage for domain mappings
const domainRecords: DomainRecord[] = [];

// Add a domain
app.post("/api/add-domain", (req: Request, res: Response): any => {
  const { domain, target } = req.body;
  if (!domain || !target) {
    return res
      .status(400)
      .json({ error: "Both domain and target are required." });
  }

  // Add domain mapping
  domainRecords.push({ domain, target });
  res.status(200).json({ message: `Domain ${domain} added successfully.` });
});

// Dynamic domain resolver
const resolveDomain = (host: string) => {
  return domainRecords.find((record) => host.endsWith(record.domain));
};

// Use Greenlock to manage certificates
const greenlock = Greenlock.create({
  packageAgent: "vps-domain-manager/1.0.0",
  configDir: "./greenlock.d", // Directory for Greenlock configurations
  maintainerEmail: "dominik@hula.sh",
  cluster: false, // Set to true if using a cluster (like PM2)
  store: require("greenlock-store-fs"),
  notify: (event: any, details: any) => {
    console.log(`Greenlock Event: ${event}`, details);
  },
});

// Approve domains for SSL
greenlock.manager.approveDomains = (opts: any) => {
  const host = opts.domains?.[0];
  if (!host) throw new Error("No domain provided");

  const record = resolveDomain(host);
  if (!record) throw new Error(`Domain ${host} not found`);

  return {
    options: opts,
  };
};

// Start HTTP server for ACME challenges
const httpServer = http.createServer(greenlock.middleware(app));
httpServer.listen(80, () => {
  console.log("Listening on port 80 for ACME challenges and HTTP traffic...");
});

// HTTPS Server for secure traffic
greenlock.serveApp(app).listen(443, () => {
  console.log("Listening on port 443 for HTTPS traffic...");
});

// Proxy requests dynamically to Next.js
app.use((req: any, res: any) => {
  const host = req.headers.host;
  if (!host) {
    return res.status(400).send("Host header is missing.");
  }

  const record = resolveDomain(host);
  if (!record) {
    return res.status(404).send("Domain not found.");
  }

  const proxyReq = http.request(
    `http://${record.target}${req.url}`,
    {
      method: req.method,
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  req.pipe(proxyReq);
});
