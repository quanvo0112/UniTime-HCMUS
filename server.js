import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8080;

const server = http.createServer((req, res) => {
  let filePath = req.url === "/" ? "/index.html" : req.url;
  
  // Serve resources from root
  if (filePath.startsWith("/resources/")) {
    filePath = path.join(__dirname, filePath);
  } else {
    // Serve everything else from web/
    filePath = path.join(__dirname, "web", filePath);
  }
  
  // Prevent directory traversal
  if (!filePath.startsWith(path.join(__dirname, "web")) && !filePath.startsWith(path.join(__dirname, "resources"))) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  
  // Read and serve file
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }
    
    // Set content type
    const ext = path.extname(filePath);
    const contentTypes = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".json": "application/json",
    };
    
    const contentType = contentTypes[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Serving web/ from root, resources/ from root`);
  console.log("Press Ctrl+C to stop");
});
