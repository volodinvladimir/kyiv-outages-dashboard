(() => {
  const CITY = "kiev";
  const LIVE_URL = "https://api.yasno.com.ua/api/v1/pages/home/schedule-turn-off-electricity";
  const FALLBACK_URL = "./data/yasno.json"; // оновлюється GitHub Actions (якщо ввімкнеш workflow)

  const els = {
    meta: document.getElementById("meta"),
    notice: document.getElementById("notice"),
    todayTitle: document.getElementById("todayTitle"),
    tomorrowTitle: document.getElementById("tomorrowTitle"),
    todayTable: document.getElementById("todayTable"),
    tomorrowTable: document.getElementById("tomorrowTable"),
    tomorrowCard: document.getElementById("tomorrowCard"),
    refreshBtn: document.getElementById("refreshBtn"),
    preferLive: document.getElementById("preferLive"),
    sourceBadge: document.getElementById("sourceBadge"),
  };

  const pad2 = (n) => String(n).padStart(2, "0");

  function stripTags(html) {
    try {
      const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
      return (doc.body.textContent || "").trim();
    } catch {
      return String(html || "");
    }
  }

  function parseWrapper(json) {
    // Якщо GitHub Action записує wrapper-об'єкт: { fetchedAt, source, payload }
    if (json && typeof json === "object" && json.payload) return json;
    return { fetchedAt: null, source: LIVE_URL, payload: json };
  }

  function findComponent(data, templateName) {
    const comps = data?.components;
    if (!Array.isArray(comps)) return null;
    return comps.find((c) => c?.template_name === templateName) || null;
  }

  function findNoticeText(data) {
    const comps = data?.components;
    if (!Array.isArray(comps)) return null;
    const editor = comps.find((c) => c?.template_name === "editor" && (c?.available_regions?.includes?.(CITY) || !c?.available_regions));
    if (!editor?.content) return null;
    return stripTags(editor.content);
  }

  function typeToClass(t) {
    const s = String(t || "").toUpperCase();
    if (s.includes("OUTAGE")) return s.includes("POSSIBLE") || s.includes("MAYBE") ? "maybe" : "off";
    if (s.includes("POWER") || s.includes("AVAILABLE")) return s.includes("POSSIBLE") || s.includes("MAYBE") ? "maybe" : "on";
    return "unknown";
  }

  function buildSlots(intervals) {
  // Якщо інтервали не покривають весь день (у тижневому schedule так буває),
  // то "порожні" проміжки не хочеться показувати сірими.
  // Якщо в даних є POSSIBLE — вважаємо базово "світло є", а POSSIBLE/OUTAGE намалюємо поверх.
  let base = "unknown";
  if (Array.isArray(intervals) && intervals.length > 0) {
    const hasPossible = intervals.some((it) =>
      String(it?.type || "").toUpperCase().includes("POSSIBLE")
    );
    if (hasPossible) base = "on";
  }

  const slots = new Array(48).fill(base); // 48 слотів по 30 хв

  if (!Array.isArray(intervals)) return slots;

  for (const it of intervals) {
    const start = Number(it?.start);
    const end = Number(it?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;

    const cls = typeToClass(it?.type);
    const a = Math.max(0, Math.min(48, Math.round(start * 2)));
    const b = Math.max(0, Math.min(48, Math.round(end * 2)));
    for (let i = a; i < b; i++) slots[i] = cls;
  }

  return slots;
}


  function makeTimeline(slots) {
    const tl = document.createElement("div");
    tl.className = "timeline";
    for (let i = 0; i < 48; i++) {
      const span = document.createElement("div");
      span.className = `slot ${slots[i]}`;
      const h = Math.floor(i / 2);
      const m = i % 2 === 0 ? "00" : "30";
      span.title = `${pad2(h)}:${m} · ${labelFor(slots[i])}`;
      tl.appendChild(span);
    }
    return tl;
  }

  function labelFor(cls) {
    if (cls === "on") return "світло є";
    if (cls === "off") return "світла немає";
    if (cls === "maybe") return "може бути";
    return "н/д";
  }

  function renderScale(container) {
    const scale = document.createElement("div");
    scale.className = "scale";

    const blank = document.createElement("div");
    blank.textContent = "";
    scale.appendChild(blank);

    const ticks = document.createElement("div");
    ticks.className = "ticks";
    for (let h = 0; h < 24; h++) {
      const s = document.createElement("span");
      s.textContent = pad2(h);
      ticks.appendChild(s);
    }
    scale.appendChild(ticks);

    container.appendChild(scale);
  }

  function sortGroupKeys(keys) {
    return [...keys].sort((a, b) => {
      const [a1, a2] = String(a).split(".").map((x) => parseInt(x, 10));
      const [b1, b2] = String(b).split(".").map((x) => parseInt(x, 10));
      if (a1 !== b1) return (a1 || 0) - (b1 || 0);
      return (a2 || 0) - (b2 || 0);
    });
  }

  function renderDay(tableEl, groupsObj) {
    tableEl.innerHTML = "";
    if (!groupsObj || typeof groupsObj !== "object") {
      tableEl.innerHTML = "<div class='notice'>Немає даних по групах.</div>";
      return;
    }

    const keys = sortGroupKeys(Object.keys(groupsObj));
    for (const g of keys) {
      const row = document.createElement("div");
      row.className = "row";

      const label = document.createElement("div");
      label.className = "group";
      label.textContent = g;

      const slots = buildSlots(groupsObj[g]);
      const tl = makeTimeline(slots);

      row.appendChild(label);
      row.appendChild(tl);
      tableEl.appendChild(row);
    }

    renderScale(tableEl);
  }

  function fmtDate(d) {
    try {
      return new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" }).format(d);
    } catch {
      return String(d);
    }
  }

  function setNotice(text) {
    if (!text) {
      els.notice.hidden = true;
      els.notice.textContent = "";
      return;
    }
    els.notice.hidden = false;
    els.notice.textContent = text;
  }

  function setMeta({ sourceLabel, fetchedAt, apiUpdatedAt }) {
    const parts = [];
    if (apiUpdatedAt) parts.push(`Останнє оновлення в даних: ${fmtDate(apiUpdatedAt)}`);
    if (fetchedAt) parts.push(`Завантажено: ${fmtDate(fetchedAt)}`);
    parts.push("Автооновлення: 1 раз/год (поки сторінка відкрита).");
    els.meta.textContent = parts.join(" · ");
    els.sourceBadge.textContent = sourceLabel;
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store", headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  async function loadData() {
    const useLive = els.preferLive.checked;

    // 1) пробуємо live API (якщо ввімкнено)
    if (useLive) {
      try {
        const json = await fetchJson(`${LIVE_URL}?_=${Date.now()}`);
        els.sourceBadge.textContent = "YASNO API (live)";
        return parseWrapper(json);
      } catch (e) {
        // якщо CORS/мережа/помилка — падаємо на кеш
      }
    }

    // 2) fallback — локальний файл (оновлюється GitHub Actions)
    const cached = await fetchJson(`${FALLBACK_URL}?_=${Date.now()}`);
    els.sourceBadge.textContent = "GitHub кеш";
    return parseWrapper(cached);
  }

function extractSchedules(payload) {
  const comp = findComponent(payload, "electricity-outages-daily-schedule");
  const daily = comp?.dailySchedule?.[CITY] || null;   // фактичний (сьогодні/завтра)
  const weekly = comp?.schedule?.[CITY] || null;       // тижневий (імовірний) по групах
  return { comp, daily, weekly };
}

function dayIndexMon0(date) {
  // JS: 0=Нд..6=Сб -> 0=Пн..6=Нд
  return (date.getDay() + 6) % 7;
}

function weeklyToDayGroups(weekly, date) {
  if (!weekly || typeof weekly !== "object") return null;
  const idx = dayIndexMon0(date);

  const out = {};
  for (const [rawKey, weekArr] of Object.entries(weekly)) {
    if (!Array.isArray(weekArr)) continue;
    const key = String(rawKey).replace(/^group_/, ""); // group_1.1 -> 1.1
    out[key] = Array.isArray(weekArr[idx]) ? weekArr[idx] : [];
  }
  return out;
}


  async function refresh() {
    els.refreshBtn.disabled = true;
    els.refreshBtn.textContent = "Оновлюю…";
    try {
      const wrapper = await loadData();
      const payload = wrapper.payload;

      const noticeText = findNoticeText(payload);
      setNotice(noticeText);

      const { comp, daily, weekly } = extractSchedules(payload);

      const apiUpdatedAt = Number.isFinite(comp?.lastRegistryUpdateTime)
        ? new Date(comp.lastRegistryUpdateTime * 1000)
        : null;

      const fetchedAt = wrapper.fetchedAt ? new Date(wrapper.fetchedAt) : null;

      setMeta({
        sourceLabel: els.sourceBadge.textContent,
        fetchedAt: fetchedAt || new Date(),
        apiUpdatedAt,
      });

      if (!daily?.today?.groups) {
  // якщо добового нема — показуємо тижневий "імовірний"
  const now = new Date();
  const todayGroups = weeklyToDayGroups(weekly, now);

  if (todayGroups) {
    els.todayTitle.textContent = "Сьогодні";
    renderDay(els.todayTable, todayGroups);

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowGroups = weeklyToDayGroups(weekly, tomorrow);

    els.tomorrowCard.hidden = false;
    els.tomorrowTitle.textContent = "Завтра";
    renderDay(els.tomorrowTable, tomorrowGroups);
    return;
  }

  // реально немає даних
  els.todayTitle.textContent = "Сьогодні";
  els.todayTable.innerHTML =
    "<div class='notice'>Наразі немає опублікованого добового графіка (або обмеження не застосовуються).</div>";
  els.tomorrowCard.hidden = true;
  return;
}


      els.todayTitle.textContent = daily.today.title || "Сьогодні";
      renderDay(els.todayTable, daily.today.groups);

      if (daily.tomorrow?.groups) {
        els.tomorrowCard.hidden = false;
        els.tomorrowTitle.textContent = daily.tomorrow.title || "Завтра";
        renderDay(els.tomorrowTable, daily.tomorrow.groups);
      } else {
        els.tomorrowCard.hidden = true;
      }
    } catch (err) {
      setNotice("Не вдалося завантажити дані. Якщо Live API заблоковано, увімкни GitHub Actions (кеш) або вимкни перемикач Live.");
      els.meta.textContent = `Помилка: ${String(err?.message || err)}`;
      els.todayTable.innerHTML = "";
      els.tomorrowTable.innerHTML = "";
      els.tomorrowCard.hidden = true;
    } finally {
      els.refreshBtn.disabled = false;
      els.refreshBtn.textContent = "Оновити зараз";
    }
  }

  // events
  els.refreshBtn.addEventListener("click", refresh);
  els.preferLive.addEventListener("change", refresh);

  // first load + hourly refresh while open
  refresh();
  setInterval(refresh, 60 * 60 * 1000);
})();
