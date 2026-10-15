(() => {
  const nativeFetch = window.fetch.bind(window);
  let timeline = null;

  async function refreshTimeline() {
    try {
      const response = await nativeFetch("../Briefly/history.json?jarvisTimeline=" + Date.now(), { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      if (data && typeof data === "object") {
        timeline = data;
        window.JarvisBrieflyHistory = data;
      }
    } catch {}
  }

  function parseDate(value) {
    const date = new Date(String(value || ""));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function startOfToday(hour = 0) {
    const now = new Date();
    const date = new Date(now);
    date.setHours(hour, 0, 0, 0);
    return date;
  }

  function requestedWindow(question) {
    const q = String(question || "").toLowerCase();
    const now = new Date();
    const match = q.match(/\b(?:last|past)\s+(\d{1,2})\s*hours?\b/);
    if (match) {
      const hours = Math.max(1, Math.min(72, Number(match[1]) || 1));
      return { since: new Date(now.getTime() - hours * 3600000), label: `the last ${hours} hours` };
    }
    if (/\bovernight\b/.test(q)) {
      const since = startOfToday(18);
      since.setDate(since.getDate() - 1);
      return { since, label: "overnight" };
    }
    if (/\bsince (?:this )?morning\b/.test(q)) return { since: startOfToday(6), label: "since this morning" };
    if (/\bsince (?:this )?afternoon\b/.test(q)) return { since: startOfToday(12), label: "since this afternoon" };
    if (/\bsince (?:this )?evening\b/.test(q)) return { since: startOfToday(17), label: "since this evening" };
    if (/\bsince yesterday\b/.test(q)) {
      const since = startOfToday(0);
      since.setDate(since.getDate() - 1);
      return { since, label: "since yesterday" };
    }
    if (/\b(what changed today|what happened today|anything new today|today'?s changes)\b/.test(q)) {
      return { since: startOfToday(0), label: "today" };
    }
    if (/\bsince (?:earlier|last time)\b/.test(q)) {
      return { since: new Date(now.getTime() - 6 * 3600000), label: "the last 6 hours" };
    }
    return null;
  }

  function isTimelineQuestion(question) {
    return Boolean(requestedWindow(question)) && /\b(news|briefly|changed|change|new|happened|important|update|updates|overnight|today|world|canada|india|ai|market|economy)\b/i.test(String(question || ""));
  }

  function uniqueNotes(snapshots) {
    const seen = new Set();
    const notes = [];
    snapshots.forEach(snapshot => {
      const note = String(snapshot?.change || "").trim();
      if (!snapshot?.changed || !note || seen.has(note)) return;
      seen.add(note);
      notes.push(note);
    });
    return notes.slice(0, 3);
  }

  function eventRows(windowInfo) {
    if (!timeline?.events || typeof timeline.events !== "object") return [];
    const sinceMs = windowInfo.since.getTime();
    const rows = [];

    Object.values(timeline.events).forEach(event => {
      const snapshots = Array.isArray(event?.snapshots) ? [...event.snapshots] : [];
      snapshots.sort((a, b) => String(a?.at || "").localeCompare(String(b?.at || "")));
      if (!snapshots.length) return;

      const firstSeen = parseDate(event?.firstSeen);
      const before = snapshots.filter(snapshot => {
        const at = parseDate(snapshot?.at);
        return at && at.getTime() < sinceMs;
      }).at(-1);
      const within = snapshots.filter(snapshot => {
        const at = parseDate(snapshot?.at);
        return at && at.getTime() >= sinceMs;
      });
      if (!within.length) return;

      const newInWindow = Boolean(firstSeen && firstSeen.getTime() >= sinceMs);
      const changedWithin = within.some(snapshot => snapshot?.changed === true);
      if (!newInWindow && !changedWithin) return;

      const latest = within.at(-1);
      const baseline = before || within[0];
      rows.push({
        cat: event?.cat || "News",
        title: latest?.title || event?.latestTitle || "Untitled event",
        currentSummary: latest?.summary || event?.latestSummary || "",
        baselineSummary: baseline?.summary || "",
        firstSeen: event?.firstSeen || "",
        lastSeen: event?.lastSeen || latest?.at || "",
        importanceScore: Number(latest?.importanceScore || 0),
        sourceCount: Number(latest?.sourceCount || 1),
        sourceQuality: latest?.sourceQuality || "unknown",
        verified: latest?.verified === true,
        confidence: latest?.confidence || "unknown",
        newInWindow,
        notes: uniqueNotes(within),
        url: event?.url || ""
      });
    });

    return rows.sort((a, b) => (b.importanceScore - a.importanceScore) || String(b.lastSeen).localeCompare(String(a.lastSeen))).slice(0, 8);
  }

  function buildTimelineContext(question) {
    const windowInfo = requestedWindow(question);
    if (!windowInfo || !timeline) return "";
    const rows = eventRows(windowInfo);
    const availableFrom = timeline?.snapshots?.[0]?.at || "";
    const updated = timeline?.updated || "";

    if (!rows.length) {
      return [
        "BRIEFLY EVENT TIMELINE:",
        `Window requested: ${windowInfo.label}.`,
        availableFrom ? `History currently available from ${availableFrom}.` : "",
        updated ? `Latest history snapshot: ${updated}.` : "",
        "No material new or changed events are recorded in this window. Do not invent changes to fill the answer."
      ].filter(Boolean).join("\n");
    }

    const lines = rows.map((row, index) => {
      const trust = row.verified ? "verified" : `source-backed/${row.confidence}`;
      const state = row.newInWindow ? "NEW IN WINDOW" : "UPDATED IN WINDOW";
      const baseline = row.baselineSummary && row.baselineSummary !== row.currentSummary ? `baseline before/at start: ${String(row.baselineSummary).slice(0, 420)}` : "";
      const changes = row.notes.length ? `recorded changes: ${row.notes.join(" | ")}` : "";
      return [
        `${index + 1}. [${row.cat}] ${row.title}`,
        state,
        `trust: ${trust}; source quality: ${row.sourceQuality}; sources: ${row.sourceCount}; importance: ${row.importanceScore}`,
        row.firstSeen ? `first seen: ${row.firstSeen}` : "",
        row.lastSeen ? `last seen: ${row.lastSeen}` : "",
        changes,
        baseline,
        row.currentSummary ? `current summary: ${String(row.currentSummary).slice(0, 520)}` : "",
        row.url ? `source URL: ${row.url}` : ""
      ].filter(Boolean).join(" — ");
    });

    return [
      "BRIEFLY EVENT TIMELINE (bounded historical context; use only the records below):",
      `Window requested: ${windowInfo.label}.`,
      availableFrom ? `History currently available from ${availableFrom}.` : "",
      updated ? `Latest history snapshot: ${updated}.` : "",
      "Explain only material new developments or changes recorded inside the requested window. Do not call an unchanged continuing event new. Respect verification labels and say when the timeline is too short to support the requested comparison.",
      ...lines
    ].filter(Boolean).join("\n");
  }

  window.fetch = async function(input, init) {
    const url = typeof input === "string" ? input : String(input?.url || "");
    const method = String(init?.method || (typeof input !== "string" ? input?.method : "GET") || "GET").toUpperCase();

    if (method === "POST" && /\/chat(?:\?|$)/.test(url) && typeof init?.body === "string") {
      try {
        const body = JSON.parse(init.body);
        const messages = Array.isArray(body?.messages) ? body.messages : [];
        const last = messages[messages.length - 1];
        if (last?.role === "user" && isTimelineQuestion(last.content)) {
          const context = buildTimelineContext(last.content);
          if (context) {
            body.messages = [...messages.slice(0, -1), { role: "user", content: context }, last];
            init = { ...init, body: JSON.stringify(body) };
          }
        }
      } catch {}
    }

    return nativeFetch(input, init);
  };

  refreshTimeline();
  const timer = setInterval(refreshTimeline, 10 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshTimeline();
  });
  window.addEventListener("beforeunload", () => clearInterval(timer), { once: true });
})();
