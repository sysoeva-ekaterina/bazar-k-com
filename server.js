// Сервер магазина BAZA-R-COM.
// Делает три вещи:
//   1) показывает сайт из папки public/;
//   2) принимает заказ (POST /api/order), создаёт оплату в Т-Банке и пишет в Telegram;
//   3) принимает уведомление об оплате от Т-Банка (POST /api/tbank-notify) и пишет в Telegram «оплачен».
// Никаких библиотек ставить не нужно: только Node.js 18+.
// Настройки (ключи бота и банка) лежат в файле .env — образец в .env.example.

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ---------- настройки из .env ----------
(function loadEnv() {
  const f = path.join(__dirname, ".env");
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
})();

const CFG = {
  port: Number(process.env.PORT || 3000),
  siteUrl: (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  tgToken: process.env.TELEGRAM_BOT_TOKEN || "",
  tgChat: process.env.TELEGRAM_CHAT_ID || "",
  notifyUnpaid: (process.env.NOTIFY_UNPAID || "true") === "true",
  tbKey: process.env.TBANK_TERMINAL_KEY || "",
  tbPassword: process.env.TBANK_PASSWORD || "",
  tbApi: (process.env.TBANK_API || "https://securepay.tinkoff.ru/v2").replace(/\/$/, ""),
  receipts: (process.env.TBANK_RECEIPTS || "true") === "true",
  taxation: process.env.TAXATION || "usn_income", // osn | usn_income | usn_income_outcome | esn | patent
  vat: process.env.VAT || "none",                  // none | vat0 | vat5 | vat7 | vat10 | vat22 ...
  ffd: process.env.FFD_VERSION || "1.2",           // 1.2 или 1.05 — уточнить в личном кабинете Т-Бизнес
};
const PUBLIC = path.join(__dirname, "public");
const DATA = path.join(__dirname, "data");
const ORDERS = path.join(DATA, "orders.json");

const rub = (kop) => (kop / 100).toLocaleString("ru-RU") + " ₽";

// ---------- заказы (простой файл data/orders.json) ----------
function readOrders() { try { return JSON.parse(fs.readFileSync(ORDERS, "utf8")); } catch (e) { return []; } }
function writeOrders(list) {
  fs.mkdirSync(DATA, { recursive: true });
  const tmp = ORDERS + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, ORDERS);
}
function nextOrderId(list) { return String(list.reduce((m, o) => Math.max(m, Number(o.orderId) || 0), 1000) + 1); }

// ---------- Telegram ----------
async function tg(text) {
  if (!CFG.tgToken || !CFG.tgChat) { console.log("[telegram выключен]\n" + text + "\n"); return false; }
  try {
    const r = await fetch(`https://api.telegram.org/bot${CFG.tgToken}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CFG.tgChat, text, disable_web_page_preview: true }),
    });
    const j = await r.json();
    if (!j.ok) console.error("Telegram ответил ошибкой:", j.description);
    return j.ok;
  } catch (e) { console.error("Telegram недоступен:", e.message); return false; }
}

function orderText(o, title) {
  const lines = o.items.map((i) => `• ${i.title} × ${i.qty} — ${rub(i.price * i.qty * 100)}`).join("\n");
  const c = o.customer;
  return `${title || `🆕 Новый заказ №${o.orderId}`}\nСумма: ${rub(o.amount)} · ${o.paid ? "оплачен ✅" : "ожидает оплаты"}\n\n${lines}\n\n👤 ${c.name}\n📞 ${c.phone}\n✉️ ${c.email}\n🚚 ${c.delivery}\n📍 ${c.address}${c.comment ? `\n💬 ${c.comment}` : ""}`;
}

// ---------- Т-Банк ----------
// Подпись запроса: берём все простые поля (без вложенных объектов), добавляем Password,
// сортируем по имени поля, склеиваем значения и считаем SHA-256.
function tbankToken(params) {
  const flat = { ...params, Password: CFG.tbPassword };
  delete flat.Token;
  return crypto.createHash("sha256").update(
    Object.keys(flat).filter((k) => flat[k] !== undefined && flat[k] !== null && typeof flat[k] !== "object").sort().map((k) => String(flat[k])).join("")
  ).digest("hex");
}

async function tbankInit(order) {
  const body = {
    TerminalKey: CFG.tbKey,
    Amount: order.amount,
    OrderId: order.orderId,
    Description: `Заказ №${order.orderId} в BAZA-R-COM`.slice(0, 140),
    NotificationURL: `${CFG.siteUrl}/api/tbank-notify`,
    SuccessURL: `${CFG.siteUrl}/oplata-uspeh.html`,
    FailURL: `${CFG.siteUrl}/oplata-oshibka.html`,
    DATA: { Phone: order.customer.phone, Email: order.customer.email },
  };
  if (CFG.receipts) {
    body.Receipt = {
      Email: order.customer.email,
      Phone: order.customer.phone,
      Taxation: CFG.taxation,
      ...(CFG.ffd === "1.2" ? { FfdVersion: "1.2" } : {}),
      Items: order.items.map((i) => ({
        Name: i.title.slice(0, 128),
        Price: i.price * 100,
        Quantity: i.qty,
        Amount: i.price * 100 * i.qty,
        Tax: CFG.vat,
        PaymentMethod: "full_payment",
        PaymentObject: "commodity",
        ...(CFG.ffd === "1.2" ? { MeasurementUnit: "шт" } : {}),
      })),
    };
  }
  body.Token = tbankToken(body);
  const r = await fetch(`${CFG.tbApi}/Init`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!j.Success) throw new Error(`Т-Банк: ${j.Message || "ошибка"} ${j.Details || ""} (код ${j.ErrorCode})`);
  return j; // { PaymentId, PaymentURL, ... }
}

// ---------- обработчики API ----------
async function handleOrder(req, res) {
  const data = await readJson(req);
  const c = data.customer || {};
  const need = ["name", "phone", "email", "address"].filter((k) => !c[k] || String(c[k]).trim().length < 2);
  if (need.length) return json(res, 400, { error: "Заполните все поля заказа." });

  // Цены берём только из products.json на сервере, а не из браузера
  const catalog = JSON.parse(fs.readFileSync(path.join(PUBLIC, "products.json"), "utf8"));
  const byId = Object.fromEntries(catalog.filter((p) => p.visible !== false && p.inStock).map((p) => [p.id, p]));
  const items = (data.items || []).filter((i) => byId[i.id] && Number(i.qty) > 0).map((i) => ({
    id: i.id, title: byId[i.id].title, sku: byId[i.id].sku, price: byId[i.id].price, qty: Math.min(99, Math.floor(Number(i.qty))),
  }));
  if (!items.length) return json(res, 400, { error: "В корзине нет доступных товаров. Обновите страницу." });

  const clean = (s, n = 300) => String(s || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
  const orders = readOrders();
  const order = {
    orderId: nextOrderId(orders),
    createdAt: new Date().toISOString(),
    customer: { name: clean(c.name, 100), phone: clean(c.phone, 30), email: clean(c.email, 100), delivery: clean(c.delivery, 100), address: clean(c.address), comment: clean(c.comment, 500) },
    items,
    amount: items.reduce((s, i) => s + i.price * 100 * i.qty, 0), // в копейках
    paid: false,
    status: "NEW",
  };

  let paymentUrl = null;
  if (CFG.tbKey && CFG.tbPassword) {
    try {
      const p = await tbankInit(order);
      order.paymentId = String(p.PaymentId);
      paymentUrl = p.PaymentURL;
    } catch (e) {
      console.error(e.message);
      return json(res, 502, { error: "Не получилось создать оплату. Попробуйте ещё раз через минуту или напишите нам." });
    }
  }
  orders.push(order);
  writeOrders(orders);

  const text = orderText(order);
  if (CFG.notifyUnpaid || !paymentUrl) await tg(text);

  if (paymentUrl) return json(res, 200, { orderId: order.orderId, paymentUrl });
  // Банк ещё не подключён: заказ сохранён и отправлен в Telegram, оплату согласуют вручную
  return json(res, 200, {
    orderId: order.orderId, total: order.amount / 100, telegramText: text, demo: true,
    items: items.map((i) => ({ title: i.title, qty: i.qty, price: i.price })), customer: order.customer,
  });
}

async function handleNotify(req, res) {
  const n = await readJson(req);
  if (!CFG.tbPassword || n.Token !== tbankToken(n)) { console.warn("Уведомление с неверной подписью отклонено"); res.writeHead(403); return res.end("BAD TOKEN"); }
  const orders = readOrders();
  const o = orders.find((x) => x.orderId === String(n.OrderId));
  if (o && o.status !== n.Status) {
    o.status = n.Status;
    if ((n.Status === "CONFIRMED" || n.Status === "AUTHORIZED") && !o.paid) {
      o.paid = true; o.paidAt = new Date().toISOString();
      writeOrders(orders);
      await tg(orderText(o, `✅ Оплачен заказ №${o.orderId}`));
    } else if (["REJECTED", "CANCELED", "DEADLINE_EXPIRED"].includes(n.Status)) {
      writeOrders(orders);
      await tg(`❌ Заказ №${o.orderId}: оплата не прошла (${n.Status}). Можно написать покупателю: ${o.customer.name}, ${o.customer.phone}`);
    } else if (n.Status === "REFUNDED") {
      writeOrders(orders);
      await tg(`↩️ Заказ №${o.orderId}: деньги возвращены покупателю.`);
    } else writeOrders(orders);
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("OK"); // Т-Банк ждёт ровно «OK», иначе будет повторять уведомление
}

// Помощник для настройки: показывает id чатов, куда добавили бота (пока TELEGRAM_CHAT_ID не задан)
async function handleChatId(req, res) {
  if (!CFG.tgToken) return json(res, 400, { error: "Сначала впишите TELEGRAM_BOT_TOKEN в .env и перезапустите сервер." });
  if (CFG.tgChat) return json(res, 403, { error: "TELEGRAM_CHAT_ID уже задан." });
  const r = await fetch(`https://api.telegram.org/bot${CFG.tgToken}/getUpdates`);
  const j = await r.json();
  const chats = {};
  for (const u of j.result || []) {
    const ch = (u.message || u.my_chat_member || u.channel_post || {}).chat;
    if (ch) chats[ch.id] = ch.title || ch.username || ch.first_name;
  }
  json(res, 200, { hint: "Скопируйте id нужной группы в TELEGRAM_CHAT_ID (у групп он с минусом). Если пусто — напишите любое сообщение в группе и обновите страницу.", chats });
}

function handleHealth(req, res) {
  json(res, 200, {
    site: "ok",
    telegram: CFG.tgToken && CFG.tgChat ? "подключён" : CFG.tgToken ? "нужен TELEGRAM_CHAT_ID" : "не подключён",
    tbank: CFG.tbKey && CFG.tbPassword ? `подключён (${CFG.tbKey.includes("DEMO") || CFG.tbKey.includes("Test") ? "тестовый терминал" : "боевой терминал"})` : "не подключён — заказы приходят без оплаты",
    receipts: CFG.receipts ? `чеки включены: ${CFG.taxation}, НДС ${CFG.vat}, ФФД ${CFG.ffd}` : "чеки выключены",
    orders: readOrders().length,
  });
}

// ---------- статические файлы ----------
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8" };
function serveStatic(req, res) {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(`<p style="font-family:sans-serif">Страница не найдена. <a href="/">На главную</a></p>`);
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      "Cache-Control": ext === ".jpg" || ext === ".png" || ext === ".webp" ? "public, max-age=604800" : "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    fs.createReadStream(file).pipe(res);
  });
}

// ---------- утилиты ----------
function json(res, code, obj) { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(obj)); }
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > 64 * 1024) { reject(new Error("too big")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch (e) { resolve({}); } });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (req.method === "POST" && url.pathname === "/api/order") return await handleOrder(req, res);
    if (req.method === "POST" && url.pathname === "/api/tbank-notify") return await handleNotify(req, res);
    if (req.method === "GET" && url.pathname === "/api/telegram-chat-id") return await handleChatId(req, res);
    if (req.method === "GET" && url.pathname === "/api/health") return handleHealth(req, res);
    if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res);
    res.writeHead(405); res.end();
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: "Ошибка сервера" });
  }
});

if (require.main === module) {
  server.listen(CFG.port, () => {
    console.log(`BAZA-R-COM работает: http://localhost:${CFG.port}`);
    console.log(`Telegram: ${CFG.tgToken && CFG.tgChat ? "подключён" : "не подключён (заказы печатаются в консоль)"}`);
    console.log(`Т-Банк: ${CFG.tbKey ? "подключён" : "не подключён (заказы без оплаты)"}`);
  });
}
module.exports = { tbankToken, orderText, CFG };
