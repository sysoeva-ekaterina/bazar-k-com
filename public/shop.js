// Каталог, карточка товара, корзина и оформление заказа.
// Товары берутся из products.json. Скрыть товар: "visible": false. Нет в наличии: "inStock": false.
(function () {
  const { esc, val, store } = window.SHOP;
  const $ = (id) => document.getElementById(id);
  const rub = (n) => n.toLocaleString("ru-RU") + " ₽";

  let products = [];
  let byId = {};
  let S = {};
  const state = { cat: "Все", q: "" };

  // ---------- корзина (хранится в браузере покупателя) ----------
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem("cart") || "[]"); } catch (e) { cart = []; }
  const saveCart = () => { try { localStorage.setItem("cart", JSON.stringify(cart)); } catch (e) {} updateCount(); };
  const cartItems = () => cart.filter((l) => byId[l.id] && byId[l.id].inStock);
  const cartTotal = () => cartItems().reduce((s, l) => s + byId[l.id].price * l.qty, 0);
  function updateCount() { const c = $("cartCount"); if (c) c.textContent = cart.reduce((n, l) => n + l.qty, 0); }
  function add(id) {
    const l = cart.find((x) => x.id === id);
    if (l) l.qty += 1; else cart.push({ id, qty: 1 });
    saveCart();
  }

  // ---------- каталог ----------
  const norm = (s) => s.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, "");
  function matches(p) {
    if (state.cat !== "Все" && p.category !== state.cat) return false;
    if (!state.q) return true;
    const hay = norm([p.title, p.sku, p.category, ...(p.compat || [])].join(" "));
    return hay.includes(norm(state.q));
  }

  function card(p) {
    const sale = p.oldPrice ? `<span class="sale">−${Math.round((1 - p.price / p.oldPrice) * 100)}%</span>` : "";
    return `
    <article class="card">
      <button class="card-photo" type="button" data-open="${p.id}" aria-label="Открыть: ${esc(p.title)}">
        <img src="${p.photos[0]}" alt="${esc(p.title)}" loading="lazy">
        ${sale}${p.photos.length > 1 ? `<span class="nphotos">${p.photos.length} фото</span>` : ""}
      </button>
      <div class="card-body">
        <div class="sku"><span>${esc(p.sku)}</span><span class="stock ${p.inStock ? "" : "out"}">${p.inStock ? "в наличии" : "нет в наличии"}</span></div>
        <h3><button type="button" data-open="${p.id}">${esc(p.title)}</button></h3>
        <div class="compat">${(p.compat || []).slice(0, 5).map((c) => `<span>${esc(c)}</span>`).join("")}${p.compat && p.compat.length > 5 ? `<span>+${p.compat.length - 5}</span>` : ""}</div>
        <div class="card-foot">
          <div class="price">${rub(p.price)}${p.oldPrice ? `<s>${rub(p.oldPrice)}</s>` : ""}</div>
          <button class="btn" type="button" data-add="${p.id}" ${p.inStock ? "" : "disabled"}>${p.inStock ? "В корзину" : "Нет"}</button>
        </div>
      </div>
    </article>`;
  }

  function renderGrid() {
    const list = products.filter(matches);
    $("grid").innerHTML = list.length
      ? list.map(card).join("")
      : `<div class="empty">Под «${esc(state.q)}» ничего не нашлось. Напишите нам — подберём под ваш двигатель.</div>`;
    const found = document.querySelector(".found"); if (found) found.textContent = `${list.length} из ${products.length}`;
  }

  // Полки «Лидеры продаж» и «Новое поступление»: товары с "hit": true / "new": true
  function renderShelves() {
    [["hit", "hits", "hitsSec"], ["new", "news", "newSec"]].forEach(([flag, grid, sec]) => {
      const list = products.filter((p) => p[flag]).slice(0, 8);
      $(sec).hidden = !list.length;
      $(grid).innerHTML = list.map(card).join("");
    });
  }

  // ---------- баннер-карусель ----------
  function initSlider(banners) {
    const root = $("slider");
    if (!banners || !banners.length) { root.closest("section").hidden = true; return; }
    $("slides").innerHTML = banners.map((b, i) => `
      <div class="slide" role="group" aria-roledescription="слайд" aria-label="${i + 1} из ${banners.length}" ${i ? 'aria-hidden="true"' : ""}>
        <img src="${esc(b.img)}" alt="" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}>
        <div class="slide-text">
          <${i ? "h2" : "h1"} class="slide-title">${esc(b.title)}</${i ? "h2" : "h1"}>
          ${b.text ? `<p>${esc(b.text)}</p>` : ""}
          ${b.button ? `<a class="btn" href="${esc(b.link || "#catalog")}" ${i ? 'tabindex="-1"' : ""}>${esc(b.button)}</a>` : ""}
        </div>
      </div>`).join("");
    const many = banners.length > 1;
    $("slPrev").hidden = $("slNext").hidden = !many;
    $("slDots").innerHTML = many ? banners.map((_, i) => `<button type="button" data-dot="${i}" aria-label="Слайд ${i + 1}" aria-current="${i === 0}"></button>`).join("") : "";
    let cur = 0, timer = null;
    const slides = root.querySelectorAll(".slide");
    function go(n) {
      cur = (n + slides.length) % slides.length;
      $("slides").style.transform = `translateX(-${cur * 100}%)`;
      slides.forEach((s, i) => {
        s.setAttribute("aria-hidden", String(i !== cur));
        s.querySelectorAll("a").forEach((a) => (i === cur ? a.removeAttribute("tabindex") : a.setAttribute("tabindex", "-1")));
      });
      root.querySelectorAll("[data-dot]").forEach((d, i) => d.setAttribute("aria-current", String(i === cur)));
    }
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const play = () => { stop(); if (many && !reduce) timer = setInterval(() => go(cur + 1), 6000); };
    const stop = () => { if (timer) clearInterval(timer); timer = null; };
    $("slPrev").onclick = () => { go(cur - 1); play(); };
    $("slNext").onclick = () => { go(cur + 1); play(); };
    $("slDots").onclick = (e) => { const d = e.target.closest("[data-dot]"); if (d) { go(+d.dataset.dot); play(); } };
    root.addEventListener("mouseenter", stop); root.addEventListener("mouseleave", play);
    root.addEventListener("focusin", stop); root.addEventListener("focusout", play);
    // свайп на телефоне
    let x0 = null;
    root.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; stop(); }, { passive: true });
    root.addEventListener("touchend", (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1)); x0 = null; play(); });
    play();
  }

  function renderCats() {
    const cats = ["Все", ...new Set(products.map((p) => p.category))];
    $("cats").innerHTML = cats.map((c) => `<button class="cat" type="button" data-cat="${esc(c)}" aria-pressed="${c === state.cat}">${esc(c)}</button>`).join("") + `<span class="found"></span>`;
  }

  function renderChips() {
    const popular = ["172FMM", "NB300", "YBS300", "CB300", "MT250 Lanza", "GR8", "KTM 2023+"];
    $("chips").innerHTML = popular.map((c) => `<button class="chip" type="button" data-chip="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join("");
  }
  function syncChips() {
    document.querySelectorAll("[data-chip]").forEach((b) => b.setAttribute("aria-pressed", String(norm(b.dataset.chip) === norm(state.q))));
  }

  function renderFacts() {
    const d = S.delivery || {};
    $("facts").innerHTML = `
      <div><b>Проверено на себе</b><span>Ставим эти детали на свои мотоциклы, прежде чем продавать.</span></div>
      <div><b>Отправка за ${val(d.shipWithin)}</b><span>СДЭКом, ${val(d.regions)}.</span></div>
      <div><b>Оплата онлайн</b><span>Картой или по СБП через Т-Банк, чек придёт на почту.</span></div>
      <div><b>Возврат ${S.returns ? S.returns.days : 7} дней</b><span>Если деталь не подошла и не была в установке.</span></div>`;
  }

  // ---------- карточка товара ----------
  function openProduct(id) {
    const p = byId[id]; if (!p) return;
    const main = $("pdMain");
    main.src = p.photos[0]; main.alt = p.title;
    $("pdThumbs").innerHTML = p.photos.length > 1 ? p.photos.map((src, i) =>
      `<button type="button" data-thumb="${src}" aria-current="${i === 0}" aria-label="Фото ${i + 1}"><img src="${src}" alt=""></button>`).join("") : "";
    $("pdInfo").innerHTML = `
      <div class="sku"><span>${esc(p.sku)} · ${esc(p.category)}</span><span class="stock ${p.inStock ? "" : "out"}">${p.inStock ? "в наличии" : "нет в наличии"}</span></div>
      <h2>${esc(p.title)}</h2>
      <div class="price">${rub(p.price)}${p.oldPrice ? `<s>${rub(p.oldPrice)}</s>` : ""}</div>
      <button class="btn wide" type="button" data-add="${p.id}" data-close="1" ${p.inStock ? "" : "disabled"}>${p.inStock ? "Добавить в корзину" : "Нет в наличии"}</button>
      ${p.description.map((t) => `<p>${esc(t)}</p>`).join("")}
      ${p.compat && p.compat.length ? `<div class="section-label">Подходит</div><div class="compat">${p.compat.map((c) => `<span>${esc(c)}</span>`).join("")}</div>` : ""}
      ${p.specs && p.specs.length ? `<div class="section-label">Характеристики</div><table class="specs"><tbody>${p.specs.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</tbody></table>` : ""}
      <div class="section-label">Подтверждение соответствия</div>
      <p style="font-size:14px;color:var(--muted)">${p.conformity ? (/^https?:\/\//.test(p.conformity) ? `<a href="${esc(p.conformity)}" target="_blank" rel="noopener">Сертификат / декларация</a>` : esc(p.conformity)) : val(S.conformityDefault)}</p>`;
    const dlg = $("pd");
    if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", ""); }
  }
  function closeProduct() { const d = $("pd"); if (d.open) { if (d.close) d.close(); else d.removeAttribute("open"); } }

  // ---------- корзина и оформление ----------
  let view = "cart"; // cart | checkout | done
  function openCart() { view = cart.length ? "cart" : "cart"; renderDrawer(); $("drawer").classList.add("open"); $("drawer").setAttribute("aria-hidden", "false"); $("scrim").hidden = false; }
  function closeCart() { $("drawer").classList.remove("open"); $("drawer").setAttribute("aria-hidden", "true"); $("scrim").hidden = true; }

  function renderDrawer(extra) {
    const body = $("drawerBody");
    const items = cartItems();
    if (view === "done") { $("drawerTitle").textContent = "Заказ принят"; body.innerHTML = extra; return; }
    if (!items.length) { $("drawerTitle").textContent = "Корзина"; body.innerHTML = `<p class="empty">В корзине пока пусто. Подберите детали под свой двигатель в каталоге.</p>`; return; }
    const lines = items.map((l) => { const p = byId[l.id]; return `
      <div class="line">
        <img src="${p.photos[0]}" alt="">
        <div><div class="t">${esc(p.title)}</div>
          <div class="qty"><button type="button" data-dec="${p.id}" aria-label="Меньше">−</button><span>${l.qty}</span><button type="button" data-inc="${p.id}" aria-label="Больше">+</button></div></div>
        <div class="p">${rub(p.price * l.qty)}</div>
      </div>`; }).join("");
    const total = `<div class="total"><div>Итого<small>доставка СДЭК считается отдельно по тарифу</small></div><div>${rub(cartTotal())}</div></div>`;
    if (view === "cart") {
      $("drawerTitle").textContent = "Корзина";
      body.innerHTML = lines + total + `<button class="btn wide" type="button" id="toCheckout">Оформить заказ</button>`;
      return;
    }
    // checkout
    $("drawerTitle").textContent = "Оформление";
    const opts = ((S.delivery && S.delivery.options) || []).map((o) => `<option>${esc(o.name)}</option>`).join("");
    body.innerHTML = total + `
      <form class="checkout" id="checkout" novalidate>
        <div class="field"><label for="c_name">Имя и фамилия</label><input id="c_name" name="name" autocomplete="name" required></div>
        <div class="row2">
          <div class="field"><label for="c_phone">Телефон</label><input id="c_phone" name="phone" type="tel" autocomplete="tel" placeholder="+7" required></div>
          <div class="field"><label for="c_email">Почта для чека</label><input id="c_email" name="email" type="email" autocomplete="email" required></div>
        </div>
        <div class="field"><label for="c_delivery">Доставка</label><select id="c_delivery" name="delivery">${opts}</select></div>
        <div class="field"><label for="c_address">Город и адрес или пункт выдачи</label><input id="c_address" name="address" autocomplete="street-address" required></div>
        <div class="field"><label for="c_comment">Комментарий: модель мотоцикла, двигатель</label><textarea id="c_comment" name="comment"></textarea></div>
        <label class="consent"><input type="checkbox" id="c_ok" name="consent" required> <span>Принимаю условия <a href="oferta.html" target="_blank">публичной оферты</a> и <a href="vozvrat.html" target="_blank">правил возврата</a></span></label>
        <label class="consent"><input type="checkbox" id="c_pd" name="pd" required> <span>Я даю <a href="soglasie.html" target="_blank">согласие на обработку персональных данных</a> на условиях <a href="politika.html" target="_blank">Политики обработки персональных данных</a> в целях оформления, оплаты и доставки заказа и связи со мной</span></label>
        <div class="err" id="c_err" role="alert"></div>
        <button class="btn wide" type="submit" id="c_submit">Перейти к оплате ${rub(cartTotal())}</button>
        <div class="pay-note">Нажимая кнопку, вы принимаете условия <a href="oferta.html" target="_blank">публичной оферты</a></div>
        <div class="pay-note">Оплата картой или по СБП на защищённой странице Т-Банка</div>
        <button class="btn ghost" type="button" id="backToCart">← Назад в корзину</button>
      </form>`;
  }

  // Так заказ выглядит в Telegram. Тот же формат собирает сервер (server.js).
  function botMessage(o) {
    const lines = o.items.map((i) => `• ${i.title} × ${i.qty} — ${rub(i.price * i.qty)}`).join("\n");
    return `🆕 Новый заказ №${o.orderId}\nСумма: ${rub(o.total)} · ${o.paid ? "оплачен ✅" : "ожидает оплаты"}\n\n${lines}\n\n👤 ${o.customer.name}\n📞 ${o.customer.phone}\n✉️ ${o.customer.email}\n🚚 ${o.customer.delivery}\n📍 ${o.customer.address}${o.customer.comment ? `\n💬 ${o.customer.comment}` : ""}`;
  }

  async function submit(form) {
    const f = Object.fromEntries(new FormData(form).entries());
    const err = $("c_err");
    const missing = [];
    if (!f.name || f.name.trim().length < 2) missing.push("имя");
    if (!f.phone || f.phone.replace(/\D/g, "").length < 10) missing.push("телефон");
    if (!f.email || !/^\S+@\S+\.\S+$/.test(f.email)) missing.push("почту");
    if (!f.address || f.address.trim().length < 3) missing.push("адрес");
    if (missing.length) { err.textContent = `Заполните: ${missing.join(", ")}.`; return; }
    if (!form.consent.checked || !form.pd.checked) { err.textContent = "Отметьте обе галочки: оферту и согласие на обработку данных."; return; }
    err.textContent = "";
    const btn = $("c_submit"); btn.disabled = true; btn.textContent = "Создаём заказ…";
    const customer = { name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim(), delivery: f.delivery, address: f.address.trim(), comment: (f.comment || "").trim() };
    const items = cartItems().map((l) => ({ id: l.id, qty: l.qty }));
    let res = null;
    try {
      const r = await fetch("api/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer, items }) });
      if (r.ok) res = await r.json();
      else if (r.status === 400 || r.status === 502) { const j = await r.json().catch(() => ({})); err.textContent = j.error || "Не получилось создать заказ. Попробуйте ещё раз или напишите нам."; btn.disabled = false; btn.textContent = "Перейти к оплате"; return; }
    } catch (e) { res = null; }

    if (res && res.paymentUrl) { cart = []; saveCart(); location.href = res.paymentUrl; return; }

    // Без сервера (превью) или без ключей банка: показываем, что придёт в Telegram
    const order = res || {
      orderId: "DEMO-" + Math.floor(1000 + Math.random() * 9000),
      total: cartTotal(),
      items: cartItems().map((l) => ({ title: byId[l.id].title, qty: l.qty, price: byId[l.id].price })),
      customer, paid: false, preview: true,
    };
    const text = order.telegramText || botMessage(order);
    cart = []; saveCart(); renderGrid();
    view = "done";
    renderDrawer(`
      <div class="done">
        <h3>Заказ №${esc(order.orderId)} принят</h3>
        <p>${order.preview ? "Это превью без сервера: заказ никуда не ушёл. На настоящем сайте сразу откроется страница оплаты Т-Банка, а бот пришлёт в группу такое сообщение:" : "Мы получили заказ и скоро свяжемся с вами. Вот что ушло продавцу в Telegram:"}</p>
        <div class="botmsg">${esc(text)}</div>
        <button class="btn ghost" type="button" id="doneClose">Вернуться в каталог</button>
      </div>`);
  }

  // ---------- события ----------
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-open],[data-add],[data-cat],[data-chip],[data-thumb],[data-inc],[data-dec],#toCheckout,#backToCart,#doneClose,#cartOpen,#cartClose,#scrim,#pdClose");
    if (!t) return;
    if (t.dataset.open) return openProduct(t.dataset.open);
    if (t.dataset.add) { add(t.dataset.add); if (t.dataset.close) closeProduct(); const old = t.textContent; t.textContent = "Добавлено ✓"; setTimeout(() => (t.textContent = old), 1100); return; }
    if (t.dataset.cat) { state.cat = t.dataset.cat; renderCats(); renderGrid(); return; }
    if (t.dataset.chip) { state.q = norm(state.q) === norm(t.dataset.chip) ? "" : t.dataset.chip; $("q").value = state.q; syncChips(); renderGrid(); document.getElementById("catalog").scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (t.dataset.thumb) { $("pdMain").src = t.dataset.thumb; document.querySelectorAll("[data-thumb]").forEach((b) => b.setAttribute("aria-current", String(b === t))); return; }
    if (t.dataset.inc) { cart.find((l) => l.id === t.dataset.inc).qty++; saveCart(); return renderDrawer(); }
    if (t.dataset.dec) { const l = cart.find((x) => x.id === t.dataset.dec); l.qty--; if (l.qty <= 0) cart = cart.filter((x) => x !== l); saveCart(); return renderDrawer(); }
    if (t.id === "toCheckout") { view = "checkout"; return renderDrawer(); }
    if (t.id === "backToCart") { view = "cart"; return renderDrawer(); }
    if (t.id === "doneClose" || t.id === "cartClose" || t.id === "scrim") { view = "cart"; return closeCart(); }
    if (t.id === "cartOpen") return openCart();
    if (t.id === "pdClose") return closeProduct();
  });
  document.addEventListener("submit", (e) => { if (e.target.id === "checkout") { e.preventDefault(); submit(e.target); } });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCart(); });
  $("pd").addEventListener("click", (e) => { if (e.target === $("pd")) closeProduct(); });
  $("q").addEventListener("input", (e) => { state.q = e.target.value.trim(); syncChips(); renderGrid(); });

  // ---------- старт ----------
  Promise.all([store, fetch("products.json", { cache: "no-cache" }).then((r) => r.json())]).then(([s, list]) => {
    S = s;
    products = list.filter((p) => p.visible !== false);
    byId = Object.fromEntries(products.map((p) => [p.id, p]));
    cart = cart.filter((l) => byId[l.id]);
    initSlider(s.banners);
    renderChips(); renderCats(); renderGrid(); renderShelves(); renderFacts(); updateCount();
    if (location.hash === "#cart") openCart();
  });
})();
