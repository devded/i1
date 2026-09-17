/**
 * OLDSMAR SCADA SAFETY INTERLOCK CONSOLE
 * Real-time telemetry, Chart.js multi-channel rendering, and block choreography.
 */

// Global Chart references
let phChart = null;
let sensorChart = null;
let doseChart = null;

// Telemetry state tracking for delta calculation
let previousTelemetry = {
  flow: null,
  feed: null,
  resulting: null,
  ph: null,
  dose: null
};

// Set of processed event IDs to prevent duplicate DOM inserts
const seenEventIds = new Set();

// Block choreography timer
let blockDecayTimeout = null;

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  initCharts();
  bindUIEvents();
  startTelemetryPolling();
});

/**
 * Initialize Chart.js instances with fixed-axis bounds and custom styling
 */
function initCharts() {
  const chartFont = {
    family: "'Inter', sans-serif",
    size: 10
  };

  const gridConfig = {
    color: "rgba(255, 255, 255, 0.05)",
    drawBorder: false
  };

  // 1. pH Chart (Finished Water Acidity & Alkalinity)
  const ctxPh = document.getElementById("phChart").getContext("2d");
  phChart = new Chart(ctxPh, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Finished Water pH",
        data: [],
        borderColor: "#38bdf8",
        borderWidth: 2.5,
        tension: 0.25,
        pointRadius: 0,
        fill: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          grid: gridConfig,
          ticks: { font: chartFont, color: "#64748b", maxTicksLimit: 10 }
        },
        y: {
          min: 6.0,
          max: 13.5,
          grid: gridConfig,
          ticks: { font: chartFont, color: "#94a3b8", stepSize: 1.0 }
        }
      },
      plugins: {
        legend: { display: false },
        annotation: {
          annotations: {
            safeBand: {
              type: "box",
              yMin: 6.0,
              yMax: 8.5,
              backgroundColor: "rgba(34, 197, 94, 0.10)",
              borderWidth: 0,
              drawTime: "beforeDatasetsDraw"
            },
            elevatedBand: {
              type: "box",
              yMin: 8.5,
              yMax: 10.0,
              backgroundColor: "rgba(245, 158, 11, 0.12)",
              borderWidth: 0,
              drawTime: "beforeDatasetsDraw"
            },
            dangerBand: {
              type: "box",
              yMin: 10.0,
              yMax: 13.5,
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              borderWidth: 0,
              drawTime: "beforeDatasetsDraw"
            },
            safeCeilingLine: {
              type: "line",
              yMin: 8.5,
              yMax: 8.5,
              borderColor: "rgba(245, 158, 11, 0.6)",
              borderWidth: 1.5,
              borderDash: [5, 4],
              label: {
                display: true,
                content: "Safe Ceiling (pH 8.5)",
                position: "start",
                backgroundColor: "rgba(0,0,0,0.6)",
                font: { size: 9, family: "'Inter', sans-serif" },
                color: "#fbbf24"
              }
            },
            dangerThresholdLine: {
              type: "line",
              yMin: 10.0,
              yMax: 10.0,
              borderColor: "rgba(239, 68, 68, 0.7)",
              borderWidth: 1.5,
              borderDash: [5, 4],
              label: {
                display: true,
                content: "Hazard Threshold (pH 10.0)",
                position: "start",
                backgroundColor: "rgba(0,0,0,0.6)",
                font: { size: 9, family: "'Inter', sans-serif" },
                color: "#f87171"
              }
            }
          }
        }
      }
    }
  });

  // 2. Sensor Chart (Primary vs Verification)
  const ctxSensor = document.getElementById("sensorChart").getContext("2d");
  sensorChart = new Chart(ctxSensor, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Primary Sensor (Attack Surface)",
          data: [],
          borderColor: "#f43f5e",
          borderWidth: 2,
          tension: 0.2,
          pointRadius: 0,
          fill: false
        },
        {
          label: "Independent Verification",
          data: [],
          borderColor: "#10b981",
          borderWidth: 2,
          tension: 0.2,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          grid: gridConfig,
          ticks: { font: chartFont, color: "#64748b", maxTicksLimit: 8 }
        },
        y: {
          min: 0,
          max: 12000,
          grid: gridConfig,
          ticks: {
            font: chartFont,
            color: "#94a3b8",
            callback: (v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: { font: chartFont, color: "#94a3b8", boxWidth: 12, padding: 8 }
        }
      }
    }
  });

  // 3. Dose Chart: The Ghost Line (Requested vs Actual Dose)
  const ctxDose = document.getElementById("doseChart").getContext("2d");
  doseChart = new Chart(ctxDose, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Requested Dose (SCADA Command)",
          data: [],
          borderColor: "rgba(239, 68, 68, 0.75)",
          borderWidth: 2,
          borderDash: [6, 4],
          tension: 0.2,
          pointRadius: 0,
          fill: false
        },
        {
          label: "Actual Dose (Physical Actuator)",
          data: [],
          borderColor: "#38bdf8",
          borderWidth: 2.5,
          tension: 0.2,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          grid: gridConfig,
          ticks: { font: chartFont, color: "#64748b", maxTicksLimit: 8 }
        },
        y: {
          min: 0,
          max: 12000,
          grid: gridConfig,
          ticks: {
            font: chartFont,
            color: "#94a3b8",
            callback: (v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
          }
        }
      },
      plugins: {
        legend: { display: false },
        annotation: {
          annotations: {
            hardCeiling: {
              type: "line",
              yMin: 150,
              yMax: 150,
              borderColor: "rgba(245, 158, 11, 0.7)",
              borderWidth: 1.5,
              borderDash: [4, 4],
              label: {
                display: true,
                content: "SIS Hard Bound Limit (150 ppm)",
                position: "start",
                backgroundColor: "rgba(0,0,0,0.7)",
                font: { size: 9, family: "'Inter', sans-serif" },
                color: "#fbbf24"
              }
            }
          }
        }
      }
    }
  });
}

/**
 * Bind DOM buttons, switches, and click handlers
 */
function bindUIEvents() {
  const toggle = document.getElementById("interlock-toggle");
  toggle.addEventListener("change", async (e) => {
    const isEnabled = e.target.checked;
    await fetch("/interlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: isEnabled })
    });
    updateInterlockBadge(isEnabled);
  });

  document.getElementById("btn-attack-oldsmar").addEventListener("click", () => triggerAttack("oldsmar_spike"));
  document.getElementById("btn-attack-stealth").addEventListener("click", () => triggerAttack("single_channel_stealth"));
  document.getElementById("btn-attack-ramp").addEventListener("click", () => triggerAttack("slow_ramp"));
  document.getElementById("btn-attack-flow").addEventListener("click", () => triggerAttack("flow_falsification"));
  document.getElementById("btn-attack-stop").addEventListener("click", () => triggerAttack("stop"));

  document.getElementById("btn-reset").addEventListener("click", async () => {
    await fetch("/reset", { method: "POST" });
    // Reset toggle visually
    toggle.checked = true;
    updateInterlockBadge(true);
    seenEventIds.clear();
    document.getElementById("event-log").innerHTML = "";
  });
}

/**
 * Trigger cyberattack variant via API
 */
async function triggerAttack(variant) {
  try {
    await fetch(`/attack/${variant}`, { method: "POST" });
  } catch (err) {
    console.error("Failed to trigger attack:", err);
  }
}

/**
 * Start 500ms polling loop
 */
function startTelemetryPolling() {
  setInterval(async () => {
    try {
      const res = await fetch("/state");
      if (!res.ok) return;
      const state = await res.json();
      renderState(state);
    } catch (err) {
      console.warn("Telemetry poll dropped tick:", err);
    }
  }, 500);
}

/**
 * Render telemetry update into UI and Charts
 */
function renderState(state) {
  // 1. Header Telemetry
  document.getElementById("run-id-text").textContent = state.run_id;
  document.getElementById("uptime-text").textContent = `${state.uptime_seconds.toFixed(1)}s`;
  
  // Update SIS Key Switch state if needed
  const toggle = document.getElementById("interlock-toggle");
  if (toggle.checked !== state.interlock_on) {
    toggle.checked = state.interlock_on;
  }
  updateInterlockBadge(state.interlock_on);

  // Status Pill & Sustained Block Choreography
  updateStatusPill(state);

  // Active Attack Badge
  const attackBadge = document.getElementById("active-attack-badge");
  if (state.active_attack) {
    attackBadge.textContent = state.active_attack.toUpperCase().replace(/_/g, " ");
    attackBadge.className = "badge badge-destructive";
  } else {
    attackBadge.textContent = "STANDBY";
    attackBadge.className = "badge badge-secondary";
  }

  // 2. Stat Cards
  const sensors = state.sensors;
  const control = state.control;

  updateStat("stat-flow", "stat-flow-delta", sensors.flow_l_s, previousTelemetry.flow, "L/s");
  updateStat("stat-feed", "stat-feed-delta", control.feed_rate_mg_s, previousTelemetry.feed, "mg/s", 0);
  updateStat("stat-resulting", "stat-resulting-delta", control.resulting_ppm, previousTelemetry.resulting, "ppm");
  updateStat("stat-dose", "stat-dose-delta", control.actual_dose_ppm, previousTelemetry.dose, "ppm");

  // pH Stat with dynamic color bands
  const phEl = document.getElementById("stat-ph");
  phEl.textContent = control.ph.toFixed(2);
  phEl.className = `stat-value tabular-nums ph-${control.ph_band}`;

  const phBandBadge = document.getElementById("ph-band-badge");
  phBandBadge.textContent = control.ph_band.toUpperCase();
  phBandBadge.className = control.ph_band === "safe" ? "badge badge-outline" :
                          (control.ph_band === "elevated" ? "badge badge-warning" : "badge badge-destructive");

  updateDelta("stat-ph-delta", control.ph, previousTelemetry.ph, "pH");

  // Save telemetry for delta calculations
  previousTelemetry = {
    flow: sensors.flow_l_s,
    feed: control.feed_rate_mg_s,
    resulting: control.resulting_ppm,
    ph: control.ph,
    dose: control.actual_dose_ppm
  };

  // Channel Divergence Badge
  const denom = Math.max(sensors.verification_ppm, 1.0);
  const divergencePct = (Math.abs(sensors.primary_ppm - sensors.verification_ppm) / denom) * 100;
  const divergenceBadge = document.getElementById("divergence-badge");
  divergenceBadge.textContent = `DIV: ${divergencePct.toFixed(1)}%`;
  if (divergencePct > 15.0) {
    divergenceBadge.className = "badge badge-destructive";
  } else {
    divergenceBadge.className = "badge badge-secondary";
  }

  // 3. Update Charts
  const history = state.history;
  const labels = history.time_labels;

  // pH Chart
  phChart.data.labels = labels;
  phChart.data.datasets[0].data = history.ph;
  phChart.update("none");

  // Sensor Chart
  sensorChart.data.labels = labels;
  sensorChart.data.datasets[0].data = history.primary;
  sensorChart.data.datasets[1].data = history.verification;
  sensorChart.update("none");

  // Dose Chart
  doseChart.data.labels = labels;
  doseChart.data.datasets[0].data = history.requested_dose;
  doseChart.data.datasets[1].data = history.actual_dose;
  doseChart.update("none");

  // 4. Update Event Log
  renderEvents(state.events);
}

/**
 * Sustained 3-Second Block Choreography & Status Pill
 */
function updateStatusPill(state) {
  const pill = document.getElementById("status-pill");
  const text = document.getElementById("status-text");

  if (state.system_status === "DANGER") {
    pill.className = "status-pill danger";
    text.textContent = `CRITICAL DANGER — pH ${state.control.ph.toFixed(2)}`;
    triggerBlockGlow();
  } else if (state.system_status === "BLOCKED") {
    pill.className = "status-pill blocked";
    const reasonPrefix = state.last_decision && state.last_decision.reason
      ? state.last_decision.reason.split(":")[0]
      : "DOSE BLOCKED";
    text.textContent = `BLOCKED: ${reasonPrefix}`;
    triggerBlockGlow();
  } else {
    pill.className = "status-pill nominal";
    text.textContent = "NOMINAL OPERATION";
  }
}

/**
 * Trigger red glowing screen perimeter that persists for 3 seconds
 */
function triggerBlockGlow() {
  document.body.classList.add("block-active");

  if (blockDecayTimeout) {
    clearTimeout(blockDecayTimeout);
  }

  blockDecayTimeout = setTimeout(() => {
    document.body.classList.remove("block-active");
  }, 3000);
}

function updateInterlockBadge(isEnabled) {
  const badge = document.getElementById("interlock-badge");
  if (isEnabled) {
    badge.textContent = "ENGAGED";
    badge.className = "badge badge-outline";
  } else {
    badge.textContent = "BYPASSED";
    badge.className = "badge badge-destructive";
  }
}

function updateStat(valId, deltaId, current, previous, unit, decimals = 1) {
  document.getElementById(valId).textContent = current.toFixed(decimals);
  updateDelta(deltaId, current, previous, unit, decimals);
}

function updateDelta(elemId, current, previous, unit, decimals = 1) {
  const el = document.getElementById(elemId);
  if (previous === null || previous === undefined) {
    el.textContent = "--";
    el.className = "stat-delta delta-flat";
    return;
  }
  const diff = current - previous;
  if (Math.abs(diff) < 0.05) {
    el.textContent = "■ 0.0";
    el.className = "stat-delta delta-flat";
  } else if (diff > 0) {
    el.textContent = `▲ +${diff.toFixed(decimals)}`;
    el.className = "stat-delta delta-up";
  } else {
    el.textContent = `▼ ${diff.toFixed(decimals)}`;
    el.className = "stat-delta delta-down";
  }
}

/**
 * Render new audit event items into scrollable log
 */
function renderEvents(events) {
  const container = document.getElementById("event-log");
  const countBadge = document.getElementById("event-count-badge");
  countBadge.textContent = `${events.length} EVENTS`;

  // Process any unseen events
  events.forEach((ev) => {
    if (seenEventIds.has(ev.id)) return;
    seenEventIds.add(ev.id);

    const item = document.createElement("div");
    const itemType = ev.type.toLowerCase();
    item.className = `event-item ${itemType}`;

    let badgeClass = "badge-secondary";
    if (ev.type === "BLOCKED") badgeClass = "badge-destructive";
    else if (ev.type === "ALLOWED") badgeClass = "badge-outline";
    else if (ev.type === "ATTACK") badgeClass = "badge-warning";

    item.innerHTML = `
      <div class="event-header">
        <span class="badge ${badgeClass}">${ev.type}</span>
        <span class="event-time mono">${ev.time_str}</span>
      </div>
      <div class="event-msg">${escapeHtml(ev.message)}</div>
      <div class="event-detail">${escapeHtml(ev.detail)}</div>
    `;

    // Prepend new event so most recent is at the top
    container.insertBefore(item, container.firstChild);
  });
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}
