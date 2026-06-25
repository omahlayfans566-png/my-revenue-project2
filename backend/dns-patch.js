/**
 * dns-patch.js  —  loaded via --require before any other module
 * Patches Node's DNS resolver to use Google/Cloudflare DNS (8.8.8.8)
 * This fixes querySrv ECONNREFUSED on networks with broken DNS.
 */
import dns from "dns";

dns.setDefaultResultOrder("ipv4first");
const resolver = new dns.Resolver();
resolver.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

// Patch all DNS methods that MongoDB driver uses
const orig = {
    resolveSrv: dns.resolveSrv.bind(dns),
    resolve4: dns.resolve4.bind(dns),
    lookup: dns.lookup.bind(dns),
};

dns.resolveSrv = (host, opts, cb) => {
    if (typeof opts === "function") { cb = opts; opts = {}; }
    resolver.resolveSrv(host, cb);
};

dns.resolve4 = (host, opts, cb) => {
    if (typeof opts === "function") { cb = opts; opts = {}; }
    resolver.resolve4(host, cb);
};

console.log("[DNS] Patched — using Google DNS (8.8.8.8) for MongoDB SRV resolution");
