const statusBanner = document.getElementById("statusBanner");
const statusTitle = document.getElementById("statusTitle");
const statusSubtitle = document.getElementById("statusSubtitle");
const aiStatus = document.getElementById("aiStatus");
const findingsList = document.getElementById("findingsList");
const findingsCount = document.getElementById("findingsCount");
const actions = document.getElementById("actions");
const overrideBtn = document.getElementById("overrideBtn");
const refreshBtn = document.getElementById("refreshBtn");
const overrideReason = document.getElementById("overrideReason");
const overrideMessage = document.getElementById("overrideMessage");

function aiStatusLabel(status) {
  const map = {
    pending: "Waiting to start",
    running: "Review in progress",
    complete: "Review complete",
    skipped: "Skipped",
    error: "Error",
  };
  return map[status] ?? status;
}

function renderAi(scan) {
  const rows = [];
  rows.push(row("Provider", `${scan.provider} (${scan.model})`));
  rows.push(
    row(
      "Status",
      `<span class="statusValue ${scan.aiStatus}">${scan.aiStatus === "running" ? '<span class="pulse"></span>' : ""}${aiStatusLabel(scan.aiStatus)}</span>`,
      true,
    ),
  );

  if (scan.stagedFileCount !== undefined) {
    rows.push(row("Staged files", String(scan.stagedFileCount)));
  }

  if (scan.chunkProgress) {
    const p = scan.chunkProgress;
    const wait = p.waitingMs
      ? ` — pacing ${Math.ceil(p.waitingMs / 1000)}s`
      : "";
    rows.push(
      row(
        "Progress",
        `Chunk ${p.current}/${p.total}: ${p.filePaths.join(", ")}${wait}`,
      ),
    );
  } else if (scan.chunksInvoked && scan.chunksTotal) {
    rows.push(row("Chunks", `${scan.chunksInvoked} / ${scan.chunksTotal} requests`));
  }

  if (scan.aiInvoked) {
    rows.push(row("AI invoked", "Yes"));
  }

  if (scan.skipReason) {
    rows.push(row("Skip reason", scan.skipReason));
  }

  if (scan.errorMessage) {
    rows.push(row("Error", `<span class="statusValue error">${escapeHtml(scan.errorMessage)}</span>`, true));
  }

  aiStatus.innerHTML = rows.join("");
}

function row(label, value, html = false) {
  return `<div class="statusRow">
    <span class="statusLabel">${label}</span>
    <span class="statusValue">${html ? value : escapeHtml(String(value))}</span>
  </div>`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderFindings(findings) {
  findingsCount.textContent =
    findings.length === 0 ? "" : `${findings.length} finding${findings.length === 1 ? "" : "s"}`;

  if (findings.length === 0) {
    findingsList.innerHTML = '<p class="muted">No findings reported.</p>';
    return;
  }

  findingsList.innerHTML = findings
    .map(
      (f) => `
    <article class="findingCard" data-severity="${f.severity}">
      <div class="findingHeader">
        <span class="severityChip ${f.severity}">${f.severity}</span>
        <span class="severityChip">${f.category}</span>
        <span class="findingId">${escapeHtml(f.id)}</span>
      </div>
      ${f.filePath ? `<div class="findingLocation">${escapeHtml(f.filePath)}${f.line ? `:${f.line}` : ""}</div>` : ""}
      <p class="findingReason">${escapeHtml(f.reasoning)}</p>
      <div class="findingActions">
        <button type="button" class="ghostBtn" data-ignore="${escapeHtml(f.id)}">Ignore finding</button>
      </div>
    </article>`,
    )
    .join("");

  findingsList.querySelectorAll("[data-ignore]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-ignore");
      btn.disabled = true;
      try {
        const res = await fetch(`/api/ignore/${encodeURIComponent(id)}`, { method: "POST" });
        if (!res.ok) throw new Error(await res.text());
        btn.textContent = "Ignored — re-run commit";
      } catch (e) {
        btn.disabled = false;
        alert(e.message || "Failed to ignore");
      }
    });
  });
}

function renderSession(session) {
  statusBanner.hidden = false;
  statusBanner.className = "statusBanner";

  if (session.phase === "scanning") {
    statusBanner.classList.add("scanning");
    statusTitle.textContent = "Scanning staged changes…";
    statusSubtitle.textContent =
      "Your commit is paused while Veynt reviews. This page updates automatically.";
    actions.hidden = true;
  } else if (session.blocked) {
    statusBanner.classList.add("blocked");
    statusTitle.textContent = "Commit blocked";
    statusSubtitle.textContent =
      "Resolve the findings below, ignore them, or override to allow the next commit.";
    actions.hidden = false;
  } else if (session.overrideActive) {
    statusBanner.classList.add("passed");
    statusTitle.textContent = "Override active";
    statusSubtitle.textContent = "Run git commit again — review will be skipped for this commit.";
    actions.hidden = true;
  } else {
    statusBanner.classList.add("passed");
    statusTitle.textContent = "Review passed";
    statusSubtitle.textContent = "No blocking findings at current strictness.";
    actions.hidden = true;
  }

  renderAi(session.scan);
  renderFindings(session.findings);
}

async function fetchStatus() {
  const res = await fetch("/api/status");
  if (!res.ok) throw new Error("Failed to load status");
  const data = await res.json();
  if (data.session) {
    renderSession(data.session);
  }
}

overrideBtn.addEventListener("click", async () => {
  overrideBtn.disabled = true;
  overrideMessage.hidden = true;
  try {
    const res = await fetch("/api/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: overrideReason.value.trim() || undefined }),
    });
    if (!res.ok) throw new Error(await res.text());
    overrideMessage.hidden = false;
    overrideMessage.className = "overrideMessage";
    overrideMessage.textContent =
      "Override saved. Run git commit again to complete your commit.";
    await fetchStatus();
  } catch (e) {
    overrideMessage.hidden = false;
    overrideMessage.className = "overrideMessage error";
    overrideMessage.textContent = e.message || "Override failed";
    overrideBtn.disabled = false;
  }
});

refreshBtn.addEventListener("click", () => fetchStatus().catch(console.error));

fetchStatus().catch(() => {
  aiStatus.innerHTML = '<p class="muted">Could not reach scan session. Is a scan running?</p>';
});

setInterval(() => fetchStatus().catch(() => {}), 800);
