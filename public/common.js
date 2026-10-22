// Общая часть всех страниц: шапка, подвал и подстановка данных магазина из store.json.
// Всё, что нужно поменять (телефон, реквизиты, доставка), меняется в store.json — не здесь.
(function () {
  const isTodo = (v) => typeof v === "string" && /^\[.*\]$/.test(v.trim());
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
  // значение в виде HTML: незаполненное поле подсвечивается жёлтым
  const val = (v) => (v == null ? "" : isTodo(v) ? `<span class="todo">${esc(v.slice(1, -1))}</span>` : esc(v));

  function cartCount() {
    try { return (JSON.parse(localStorage.getItem("cart") || "[]")).reduce((n, l) => n + l.qty, 0); } catch (e) { return 0; }
  }

  function header(s, page) {
    const onIndex = page === "index";
    return `
    <div class="demo-bar" ${s.demo ? "" : "hidden"}>Тестовый режим: оплата пока не подключена, деньги не списываются</div>
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
        <div>Продажи и заказы: <span style="white-space:nowrap">${val(s.phone)}</span></div>
        ${s.phone2 ? `<div>${esc(s.phone2Name)} (${esc(s.phone2Note)}): <span style="white-space:nowrap">${val(s.phone2)}</span></div>` : ""}
        <div>Telegram: ${val(s.telegram)}</div>
        <div>Почта: ${val(s.email)}</div>
        <div class="paybadges" aria-label="Способы оплаты"><span>МИР</span><span>VISA</span><span>MASTERCARD</span><span>СБП</span><span>Т-БАНК</span></div>
      </div>
      <div>
        <h4>Покупателям</h4>
        <ul>
          <li><a href="dostavka-i-oplata.html">Доставка и оплата</a></li>
          <li><a href="vozvrat.html">Возврат и гарантия</a></li>
          <li><a href="oferta.html">Публичная оферта</a></li>
          <li><a href="politika.html">Политика конфиденциальности</a></li>
          <li><a href="soglasie.html">Согласие на обработку данных</a></li>
          <li><a href="kontakty.html">Контакты и реквизиты</a></li>
        </ul>
      </div>
      <div>
        <h4>Продавец</h4>
        <div>${val(r.fullName)}</div>
        <div>ИНН ${val(r.inn)}</div>
        <div>ОГРНИП ${val(r.ogrn)}</div>
        <div>${val(r.address)}</div>
      </div>
      <div class="copy">© ${new Date().getFullYear()} ${esc(s.name)}. Цены на сайте указаны в рублях.</div>
    </div></footer>`;
  }

  // Подставляет поля store.json в элементы с атрибутом data-s="путь.к.полю"
  function fill(s, root) {
    root.querySelectorAll("[data-s]").forEach((el) => { el.innerHTML = val(get(s, el.dataset.s)); });
  }

  window.SHOP = {
    isTodo, esc, val, get,
    store: fetch("store.json", { cache: "no-cache" }).then((r) => r.json()).then((s) => {
      const page = document.body.dataset.page || "";
      const h = document.getElementById("header"); if (h) h.outerHTML = header(s, page);
      const f = document.getElementById("footer"); if (f) f.outerHTML = footer(s);
      fill(s, document);
      document.querySelectorAll("[data-render]").forEach((el) => {
        const fn = window[el.dataset.render]; if (typeof fn === "function") el.innerHTML = fn(s);
      });
      return s;
    }),
  };
})();
