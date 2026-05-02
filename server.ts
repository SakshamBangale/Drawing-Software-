import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";


const db = new Database("agroconnect.db");


// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS farmers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    
    email TEXT,
    password TEXT NOT NULL,
    state TEXT,
    district TEXT,
    farm_size REAL,
    soil_type TEXT,
    water_source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS crops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    variety TEXT,
    soil_type TEXT,
    temp_range TEXT,
    water_req TEXT,
    fertilizer TEXT,
    avg_yield REAL
  );

  CREATE TABLE IF NOT EXISTS farm_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farmer_id INTEGER,
    crop_name TEXT,
    area REAL,
    cost REAL,
    expected_yield REAL,
    profit REAL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(farmer_id) REFERENCES farmers(id)
  );

  CREATE TABLE IF NOT EXISTS community_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farmer_id INTEGER,
    farmer_name TEXT,
    content TEXT NOT NULL,
    category TEXT,
    likes INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(farmer_id) REFERENCES farmers(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/auth/signup", (req, res) => {
    const { name, phone, email, password, state, district } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO farmers (name, phone, email, password, state, district) VALUES (?, ?, ?, ?, ?, ?)");
      const result = stmt.run(name, phone, email, password, state, district);
      res.json({ id: result.lastInsertRowid, name, phone });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { identifier, password } = req.body;
    const stmt = db.prepare("SELECT * FROM farmers WHERE (phone = ? OR email = ?) AND password = ?");
    const user = stmt.get(identifier, identifier, password);
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.get("/api/farmer/:id", (req, res) => {
    const stmt = db.prepare("SELECT * FROM farmers WHERE id = ?");
    const user = stmt.get(req.params.id);
    res.json(user);
  });

  app.put("/api/farmer/:id", (req, res) => {
    const { farm_size, soil_type, water_source } = req.body;
    const stmt = db.prepare("UPDATE farmers SET farm_size = ?, soil_type = ?, water_source = ? WHERE id = ?");
    stmt.run(farm_size, soil_type, water_source, req.params.id);
    res.json({ success: true });
  });

  app.get("/api/records/:farmerId", (req, res) => {
    const stmt = db.prepare("SELECT * FROM farm_records WHERE farmer_id = ? ORDER BY created_at DESC");
    const records = stmt.all(req.params.farmerId);
    res.json(records);
  });

  app.post("/api/records", (req, res) => {
    const { farmer_id, crop_name, area, cost, expected_yield, profit } = req.body;
    const stmt = db.prepare("INSERT INTO farm_records (farmer_id, crop_name, area, cost, expected_yield, profit) VALUES (?, ?, ?, ?, ?, ?)");
    stmt.run(farmer_id, crop_name, area, cost, expected_yield, profit);
    res.json({ success: true });
  });

  app.get("/api/community", (req, res) => {
    const stmt = db.prepare("SELECT * FROM community_posts ORDER BY created_at DESC");
    const posts = stmt.all();
    res.json(posts);
  });

  app.post("/api/community", (req, res) => {
    const { farmer_id, farmer_name, content, category } = req.body;
    const stmt = db.prepare("INSERT INTO community_posts (farmer_id, farmer_name, content, category) VALUES (?, ?, ?, ?)");
    stmt.run(farmer_id, farmer_name, content, category);
    res.json({ success: true });
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
