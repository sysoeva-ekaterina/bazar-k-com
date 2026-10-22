// Общая часть всех страниц: верхняя полоса с контактами, шапка, подвал, cookie-баннер
// и подстановка данных магазина из store.json.
// Всё, что нужно поменять (телефон, реквизиты, доставка, баннеры), меняется в store.json — не здесь.
(function () {
  const isTodo = (v) => typeof v === "string" && /^\[.*\]$/.test(v.trim());
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
  // значение в виде HTML: незаполненное поле подсвечивается жёлтым
  const val = (v) => (v == null ? "" : isTodo(v) ? `<span class="todo">${esc(v.slice(1, -1))}</span>` : esc(v));
  const tel = (p) => (isTodo(p) ? val(p) : `<a href="tel:${esc(String(p).replace(/[^\d+]/g, ""))}">${esc(p)}</a>`);
  const mail = (m) => (isTodo(m) ? val(m) : `<a href="mailto:${esc(m)}">${esc(m)}</a>`);

  // Документы сайта — одним списком, чтобы ссылки в подвале и на страницах совпадали
  const DOCS = [
    ["oferta.html", "Публичная оферта"],
    ["politika.html", "Политика обработки персональных данных"],
    ["soglasie.html", "Согласие на обработку персональных данных"],
    ["soglasie-rassylka.html", "Согласие на рекламную рассылку"],
    ["cookie.html", "Политика cookie"],
    ["vozvrat.html", "Возврат и обмен"],
    ["kontakty.html", "Реквизиты и контакты"],
  ];

  function cartCount() {
    try { return (JSON.parse(localStorage.getItem("cart") || "[]")).reduce((n, l) => n + l.qty, 0); } catch (e) { return 0; }
  }

  function topbar(s) {
    return `
    <div class="topbar"><div class="wrap">
      <div class="tb-phones">
        <span><small>Продажи и заказы</small>${tel(s.phone)}</span>
        ${s.phone2 ? `<span><small>${esc(s.phone2Name)} — ${esc(s.phone2Note)}</small>${tel(s.phone2)}</span>` : ""}
      </div>
      <div class="tb-info">
        <span>${val(s.hours)}</span>
        ${s.avito ? `<a href="${esc(s.avito)}" target="_blank" rel="noopener">Мы на Авито</a>` : ""}
      </div>
    </div></div>`;
  }

  function header(s, page) {
    const onIndex = page === "index";
    return `
    <div class="demo-bar" ${s.demo ? "" : "hidden"}>Тестовый режим: оплата пока не подключена, деньги не списываются</div>
    ${topbar(s)}
    <header class="site-header"><div class="wrap">
      <a class="brand" href="index.html" aria-label="${esc(s.name)} — на главную">
        <span class="brand-name">${esc(s.name).replace("-R-", "-<b>R</b>-")}</span>
        <span class="brand-tag">${esc(s.tagline)}</span>
      </a>
      <nav class="nav" aria-label="Разделы">
        <a href="index.html#catalog">Каталог</a>
        <a href="dostavka-i-oplata.html">Доставка и оплата</a>
        <a href="vozvrat.html">Возврат</a>
        <a href="kontakty.html">Контакты</a>
      </nav>
      ${onIndex
        ? `<button class="cart-btn" id="cartOpen" type="button">Корзина <span class="count" id="cartCount">0</span></button>`
        : `<a class="cart-btn" href="index.html#cart" style="text-decoration:none">Корзина <span class="count">${cartCount()}</span></a>`}
    </div></header>`;
  }

  function footer(s) {
    const r = s.seller || {};
    return `
    <footer class="site-footer"><div class="wrap">
      <div>
        <h4>${esc(s.name)}</h4>
        <p style="margin:0 0 8px">${esc(s.about)}</p>
        <div>Продажи и заказы: <span style="white-space:nowrap">${tel(s.phone)}</span></div>
        ${s.phone2 ? `<div>${esc(s.phone2Name)} (${esc(s.phone2Note)}): <span style="white-space:nowrap">${tel(s.phone2)}</span></div>` : ""}
        <div>Telegram: ${val(s.telegram)}</div>
        <div>Почта: ${mail(s.email)}</div>
        <div class="paybadges" aria-label="Способы оплаты"><span>МИР</span><span>VISA</span><span>MASTERCARD</span><span>СБП</span><span>Т-БАНК</span></div>
      </div>
      <div>
        <h4>Покупателям</h4>
        <ul>
          <li><a href="index.html#catalog">Каталог</a></li>
          <li><a href="dostavka-i-oplata.html">Доставка и оплата</a></li>
          <li><a href="vozvrat.html">Возврат и обмен</a></li>
          <li><a href="kontakty.html">Контакты</a></li>
        </ul>
      </div>
      <div>
        <h4>Документы</h4>
        <ul>
          ${DOCS.map(([href, t]) => `<li><a href="${href}">${t}</a></li>`).join("")}
          <li><button class="linklike" type="button" data-cookie-settings>Настройки cookie</button></li>
        </ul>
      </div>
      <div class="legal">
        ${val(r.shortName)} · ИНН ${val(r.inn)} · ОГРНИП ${val(r.ogrn)}<br>
        Адрес: ${val(r.address)} · Телефон: ${tel(s.phone2 || s.phone)} · E-mail: ${mail(s.email)}<br>
        Претензии принимаются по почтовому адресу и на e-mail, указанные выше. © ${new Date().getFullYear()} ${esc(s.name)}. Цены на сайте указаны в рублях.
      </div>
    </div></footer>`;
  }

  // ---------- cookie-баннер ----------
  // Выбор хранится в браузере 12 месяцев. Аналитику (например, Яндекс Метрику) подключать
  // только через SHOP.onAnalyticsConsent(() => { ...код счётчика... }) — тогда она не запустится без согласия.
  const CK = "cookieConsent";
  function readConsent() {
    try {
      const c = JSON.parse(localStorage.getItem(CK) || "null");
      if (c && Date.now() - c.at < 365 * 864e5) return c;
    } catch (e) {}
    return null;
  }
  const analyticsHooks = [];
  function applyConsent(c) { if (c && c.analytics) analyticsHooks.splice(0).forEach((fn) => { try { fn(); } catch (e) {} }); }
  function saveConsent(analytics) {
    const c = { analytics, at: Date.now() };
    try { localStorage.setItem(CK, JSON.stringify(c)); } catch (e) {}
    applyConsent(c);
  }
  function cookieBanner(show) {
    let el = document.getElementById("cookieBar");
    if (!el) {
      el = document.createElement("div");
      el.id = "cookieBar"; el.className = "cookie-bar"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Cookie");
      const cur = readConsent();
      el.innerHTML = `
        <p>Мы используем cookie: необходимые — для работы сайта и корзины, аналитические — чтобы понимать, как сайтом пользуются. Аналитические cookie включаются только с вашего согласия. <a href="cookie.html">Подробнее</a></p>
        <label class="ck-opt"><input type="checkbox" checked disabled> Необходимые — всегда включены</label>
        <label class="ck-opt"><input type="checkbox" id="ckAnalytics" ${cur && cur.analytics ? "checked" : ""}> Аналитические</label>
        <div class="ck-btns">
          <button class="btn" type="button" data-ck="all">Принять все</button>
          <button class="btn ghost" type="button" data-ck="min">Только необходимые</button>
          <button class="btn ghost" type="button" data-ck="save">Сохранить выбор</button>
        </div>`;
      document.body.appendChild(el);
      el.addEventListener("click", (e) => {
        const b = e.target.closest("[data-ck]"); if (!b) return;
        const k = b.dataset.ck;
        saveConsent(k === "all" ? true : k === "min" ? false : document.getElementById("ckAnalytics").checked);
        el.hidden = true;
      });
    }
    el.hidden = !show;
  }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-cookie-settings]")) cookieBanner(true); });

  // Подставляет поля store.json в элементы с атрибутом data-s="путь.к.полю"
  function fill(s, root) {
    root.querySelectorAll("[data-s]").forEach((el) => { el.innerHTML = val(get(s, el.dataset.s)); });
  }

  window.SHOP = {
    isTodo, esc, val, get, tel, mail, DOCS,
    onAnalyticsConsent(fn) { const c = readConsent(); if (c && c.analytics) fn(); else analyticsHooks.push(fn); },
    store: fetch("store.json", { cache: "no-cache" }).then((r) => r.json()).then((s) => {
      const page = document.body.dataset.page || "";
      const h = document.getElementById("header"); if (h) h.outerHTML = header(s, page);
      const f = document.getElementById("footer"); if (f) f.outerHTML = footer(s);
      fill(s, document);
      const dn = document.getElementById("docnav");
      if (dn) { const here = location.pathname.split("/").pop() || "index.html"; dn.innerHTML = DOCS.map(([href, t]) => `<a href="${href}" ${href === here ? 'aria-current="page"' : ""}>${t}</a>`).join(""); }
      document.querySelectorAll("[data-render]").forEach((el) => {
        const fn = window[el.dataset.render]; if (typeof fn === "function") el.innerHTML = fn(s);
      });
      cookieBanner(!readConsent());
      return s;
    }),
  };
})();
