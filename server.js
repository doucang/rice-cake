import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "";

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "orders.json");
const PUBLIC_DIR = path.join(__dirname, "public");

function requireAdmin(req, res, next) {
  // If no admin password is set, keep local/dev convenient.
  // For production, set ADMIN_PASS to avoid exposing customer data.
  if (!ADMIN_PASS) return next();

  const header = req.headers.authorization || "";
  const [scheme, value] = header.split(" ");
  if (scheme !== "Basic" || !value) {
    res.setHeader("WWW-Authenticate", "Basic realm=\"Admin\"");
    return res.status(401).send("Unauthorized");
  }

  let decoded = "";
  try {
    decoded = Buffer.from(value, "base64").toString("utf-8");
  } catch {
    return res.status(401).send("Unauthorized");
  }

  const idx = decoded.indexOf(":");
  const user = idx >= 0 ? decoded.slice(0, idx) : "";
  const pass = idx >= 0 ? decoded.slice(idx + 1) : "";

  if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
    res.setHeader("WWW-Authenticate", "Basic realm=\"Admin\"");
    return res.status(401).send("Unauthorized");
  }

  next();
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "[]", "utf-8");
  }
}

function readOrders() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  return JSON.parse(raw);
}

function writeOrders(orders) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2), "utf-8");
}

app.use(express.json({ limit: "200kb" }));

// Protect admin UI routes (served explicitly), while keeping the rest of /public static.
app.get("/admin.html", requireAdmin, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "admin.html"));
});

app.get("/admin.js", requireAdmin, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "admin.js"));
});

app.use(express.static(PUBLIC_DIR));

app.get("/api/orders", requireAdmin, (req, res) => {
  const orders = readOrders();
  const total = orders.length;
  const totalQuantity = orders.reduce((sum, order) => {
    return sum + (Number(order.quantity) || 0);
  }, 0);

  res.json({
    total,
    totalQuantity,
    orders
  });
});

app.post("/api/orders", (req, res) => {
  const { name, contact, phone, quantity, pickupDate, notes } = req.body || {};
  const finalContact = contact || phone || "";

  if (!name || !finalContact || !quantity || !pickupDate) {
    return res.status(400).json({ error: "请完整填写称呼、联系方式、数量和取货日期" });
  }

  const orders = readOrders();
  const newOrder = {
    id: cryptoRandomId(),
    createdAt: new Date().toISOString(),
    name,
    contact: finalContact,
    quantity: Number(quantity),
    pickupDate,
    pickupLocation: "La Thea 保安亭前",
    notes: notes || ""
  };

  orders.unshift(newOrder);
  writeOrders(orders);

  res.json({ ok: true, order: newOrder });
});

function cryptoRandomId() {
  return randomBytes(8).toString("hex");
}

app.listen(PORT, () => {
  console.log(`Nian gao preorder server running on http://localhost:${PORT}`);
});
