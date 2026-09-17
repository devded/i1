/**
 * OLDSMAR SCADA SAFETY INTERLOCK CONSOLE
 * Real-time telemetry, smooth gradient live charts, cyber-physical pipeline animation,
 * and attack simulation studio.
 */

// Global Chart References
let phChart = null;
let sensorChart = null;
let doseChart = null;

// Telemetry State Tracking for Deltas
let previousTelemetry = {
  flow: null,
  feed: null,
  resulting: null,
  ph: null,
  dose: null
};

// Processed Events Set
const seenEventIds = new Set();
let blockDecayTimeout = null;

document.addEventListener("DOMContentLoaded", () => {
  initCharts();
  bindSidebarTabs();
  bindUIEvents();
  bindAttackStudio();
  startTelemetryPolling();
  loadAuditTrail();
});

/**
 * Modern Chart.js Initialization with Area Gradients & Monotone Splines
 */
function initCharts() {
  const chartFont = {
    family: "'Inter', sans-serif",
    size: 10
  };

  const gridConfig = {
    color: "rgba(255, 255, 255, 0.04)",
    drawBorder: false
  };

  // 1. Finished Water pH Chart
  const ctxPh = document.getElementById("phChart").getContext("2d");
  const phGrad = ctxPh.createLinearGradient(0, 0, 0, 250);
  phGrad.addColorStop(0, "rgba(56, 189, 248, 0.25)");
  phGrad.addColorStop(1, "rgba(56, 189, 248, 0.0)");

  phChart = new Chart(ctxPh, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Finished Water pH",
        data: [],
        borderColor: "#38bdf8",
        backgroundColor: phGrad,
        borderWidth: 2.5,
        cubicInterpolationMode: "monotone",
        pointRadius: (ctx) => (ctx.dataIndex === ctx.dataset.data.length - 1 ? 4 : 0),
        pointBackgroundColor: "#ffffff",
        pointBorderColor: "#38bdf8",
        pointBorderWidth: 2,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          grid: gridConfig,
          ticks: { font: chartFont, color: "#64748b", maxTicksLimit: 12 }
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
              backgroundColor: "rgba(16, 185, 129, 0.08)",
              borderWidth: 0,
              drawTime: "beforeDatasetsDraw"
            },
            elevatedBand: {
              type: "box",
              yMin: 8.5,
              yMax: 10.0,
              backgroundColor: "rgba(245, 158, 11, 0.10)",
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
            safeLine: {
              type: "line",
              yMin: 8.5,
              yMax: 8.5,
              borderColor: "rgba(245, 158, 11, 0.5)",
              borderWidth: 1.5,
              borderDash: [5, 4],
              label: {
                display: true,
                content: "Safe Ceiling (8.5 pH)",
                position: "start",
                backgroundColor: "rgba(0,0,0,0.65)",
                font: { size: 9, family: "'Inter', sans-serif" },
                color: "#fbbf24"
              }
            },
            dangerLine: {
              type: "line",
              yMin: 10.0,
              yMax: 10.0,
              borderColor: "rgba(239, 68, 68, 0.6)",
              borderWidth: 1.5,
              borderDash: [5, 4],
              label: {
                display: true,
                content: "Hazard Threshold (10.0 pH)",
                position: "start",
                backgroundColor: "rgba(0,0,0,0.65)",
                font: { size: 9, family: "'Inter', sans-serif" },
                color: "#f87171"
              }
            }
          }
        }
      }
    }
  });

  // 2. Dual Sensor Channels (Primary vs Verification)
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
          cubicInterpolationMode: "monotone",
          pointRadius: (ctx) => (ctx.dataIndex === ctx.dataset.data.length - 1 ? 4 : 0),
          pointBackgroundColor: "#f43f5e",
          fill: false
        },
        {
          label: "Independent Verification Channel",
          data: [],
          borderColor: "#10b981",
          borderWidth: 2,
          cubicInterpolationMode: "monotone",
          pointRadius: (ctx) => (ctx.dataIndex === ctx.dataset.data.length - 1 ? 4 : 0),
          pointBackgroundColor: "#10b981",
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
            callback: (v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: { font: chartFont, color: "#94a3b8", boxWidth: 10, padding: 6 }
        }
      }
    }
  });

  // 3. Pump Actuator Command (The Ghost Line)
  const ctxDose = document.getElementById("doseChart").getContext("2d");
  const doseGrad = ctxDose.createLinearGradient(0, 0, 0, 200);
  doseGrad.addColorStop(0, "rgba(14, 165, 233, 0.18)");
  doseGrad.addColorStop(1, "rgba(14, 165, 233, 0.0)");

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
          cubicInterpolationMode: "monotone",
          pointRadius: (ctx) => (ctx.dataIndex === ctx.dataset.data.length - 1 ? 4 : 0),
          pointBackgroundColor: "#ef4444",
          fill: false
        },
        {
          label: "Actual Actuator Dose",
          data: [],
          borderColor: "#38bdf8",
          backgroundColor: doseGrad,
          borderWidth: 2.5,
          cubicInterpolationMode: "monotone",
          pointRadius: (ctx) => (ctx.dataIndex === ctx.dataset.data.length - 1 ? 4 : 0),
          pointBackgroundColor: "#38bdf8",
          fill: true
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
            callback: (v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)
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
              borderColor: "rgba(245, 158, 11, 0.6)",
              borderWidth: 1.5,
              borderDash: [4, 4],
              label: {
                display: true,
                content: "SIS Hard Ceiling (150 ppm)",
                position: "start",
                backgroundColor: "rgba(0,0,0,0.65)",
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
 * Sidebar Tab Switching
 */
function switchTab(tabKey) {
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach((n) => {
    if (n.dataset.tab === tabKey) n.classList.add("active");
    else n.classList.remove("active");
  });

  document.querySelectorAll(".view-page").forEach((page) => page.classList.remove("active"));
  const targetPage = document.getElementById(`view-${tabKey}`);
  if (targetPage) {
    targetPage.classList.add("active");
  }

  if (tabKey === "audit-trail") {
    loadAuditTrail();
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function bindSidebarTabs() {
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const tabKey = item.dataset.tab;
      window.location.hash = tabKey;
      switchTab(tabKey);
    });
  });

  // Handle initial hash routing
  const initialHash = window.location.hash.replace("#", "");
  if (initialHash && document.getElementById(`view-${initialHash}`)) {
    switchTab(initialHash);
  }
}

/**
 * General UI Bindings
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

  const resetAction = async () => {
    await fetch("/reset", { method: "POST" });
    toggle.checked = true;
    updateInterlockBadge(true);
    seenEventIds.clear();
    document.getElementById("event-log").innerHTML = "";
    document.querySelectorAll(".attack-scenario-card").forEach((c) => c.classList.remove("active-exploit"));
    resetCustomSliders();
    resetPipelineSchematic();
  };

  document.getElementById("btn-reset-top").addEventListener("click", resetAction);
  document.getElementById("btn-refresh-audit").addEventListener("click", loadAuditTrail);
}

/**
 * Cyberattack Simulation Studio Bindings
 */
function bindAttackStudio() {
  // 1. Scenario launch buttons
  document.querySelectorAll(".launch-exploit-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const variant = btn.dataset.variant;
      document.querySelectorAll(".attack-scenario-card").forEach((c) => c.classList.remove("active-exploit"));
      const parentCard = btn.closest(".attack-scenario-card");
      if (parentCard) parentCard.classList.add("active-exploit");

      await fetch(`/attack/${variant}`, { method: "POST" });
    });
  });

  // 2. Custom Exploit Sliders
  const primaryRange = document.getElementById("custom-primary-range");
  const primaryLabel = document.getElementById("slider-primary-val");
  primaryRange.addEventListener("input", (e) => {
    primaryLabel.textContent = `${parseFloat(e.target.value).toFixed(1)} ppm`;
  });

  const flowRange = document.getElementById("custom-flow-range");
  const flowLabel = document.getElementById("slider-flow-val");
  flowRange.addEventListener("input", (e) => {
    flowLabel.textContent = `${parseFloat(e.target.value).toFixed(1)} L/s`;
  });

  // Quick presets
  document.querySelectorAll(".quick-preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = parseFloat(btn.dataset.val);
      primaryRange.value = val;
      primaryLabel.textContent = `${val.toFixed(1)} ppm`;
    });
  });

  // Fire custom injection
  document.getElementById("btn-fire-custom").addEventListener("click", async () => {
    const pVal = parseFloat(primaryRange.value);
    const fVal = parseFloat(flowRange.value);

    await fetch("/sensors/primary/inject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: pVal })
    });

    if (Math.abs(fVal - 50.0) > 1.0) {
      await fetch("/sensors/flow/inject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: fVal })
      });
    }
  });

  // Stop all attacks
  document.getElementById("btn-stop-all").addEventListener("click", async () => {
    await fetch("/attack/stop", { method: "POST" });
    document.querySelectorAll(".attack-scenario-card").forEach((c) => c.classList.remove("active-exploit"));
    resetCustomSliders();
  });
}

function resetCustomSliders() {
  document.getElementById("custom-primary-range").value = 100;
  document.getElementById("slider-primary-val").textContent = "100.0 ppm";
  document.getElementById("custom-flow-range").value = 50;
  document.getElementById("slider-flow-val").textContent = "50.0 L/s";
}

/**
 * 500ms Real-Time Telemetry Polling
 */
function startTelemetryPolling() {
  const poll = async () => {
    try {
      const res = await fetch("/state");
      if (!res.ok) return;
      const state = await res.json();
      renderState(state);
    } catch (err) {
      console.warn("Dropped telemetry tick:", err);
    }
  };
  poll(); // Run immediate initial fetch
  setInterval(poll, 500);
}

/**
 * Main State Render Cycle
 */
function renderState(state) {
  // 1. Header Telemetry
  document.getElementById("run-id-text").textContent = state.run_id;
  document.getElementById("uptime-text").textContent = `${state.uptime_seconds.toFixed(1)}s`;

  // Sync SIS Key Switch toggle
  const toggle = document.getElementById("interlock-toggle");
  if (toggle.checked !== state.interlock_on) {
    toggle.checked = state.interlock_on;
  }
  updateInterlockBadge(state.interlock_on);

  // Status Pill & Sustained Block Choreography
  updateStatusPill(state);

  // 2. Stat Cards
  const sensors = state.sensors;
  const control = state.control;

  updateStat("stat-flow", "stat-flow-delta", sensors.flow_l_s, previousTelemetry.flow, "L/s");
  updateStat("stat-feed", "stat-feed-delta", control.feed_rate_mg_s, previousTelemetry.feed, "mg/s", 0);
  updateStat("stat-resulting", "stat-resulting-delta", control.resulting_ppm, previousTelemetry.resulting, "ppm");
  updateStat("stat-dose", "stat-dose-delta", control.actual_dose_ppm, previousTelemetry.dose, "ppm");

  // pH readout & dynamic styling
  const phEl = document.getElementById("stat-ph");
  phEl.textContent = control.ph.toFixed(2);
  phEl.className = `stat-value tabular-nums ph-${control.ph_band}`;

  const phBadge = document.getElementById("ph-band-badge");
  phBadge.textContent = `${control.ph_band.toUpperCase()} BAND`;
  phBadge.className =
    control.ph_band === "safe"
      ? "badge badge-outline"
      : control.ph_band === "elevated"
      ? "badge badge-warning"
      : "badge badge-destructive";

  updateDelta("stat-ph-delta", control.ph, previousTelemetry.ph, "pH");

  // Ghost divergence badge
  const ghostBadge = document.getElementById("ghost-divergence-badge");
  const doseDiff = Math.abs(control.requested_dose_ppm - control.actual_dose_ppm);
  if (doseDiff > 50.0) {
    ghostBadge.textContent = `DIVERGENCE: +${doseDiff.toFixed(0)} PPM`;
    ghostBadge.className = "badge badge-destructive";
  } else {
    ghostBadge.textContent = "ALIGNED";
    ghostBadge.className = "badge badge-secondary";
  }

  // Sensor Channel Divergence Badge
  const denom = Math.max(sensors.verification_ppm, 1.0);
  const divPct = (Math.abs(sensors.primary_ppm - sensors.verification_ppm) / denom) * 100;
  const divBadge = document.getElementById("divergence-badge");
  divBadge.textContent = `DIV: ${divPct.toFixed(1)}%`;
  divBadge.className = divPct > 15.0 ? "badge badge-destructive" : "badge badge-secondary";

  // Cache for deltas
  previousTelemetry = {
    flow: sensors.flow_l_s,
    feed: control.feed_rate_mg_s,
    resulting: control.resulting_ppm,
    ph: control.ph,
    dose: control.actual_dose_ppm
  };

  // 3. Update Chart Curves
  const history = state.history;
  const labels = history.time_labels;

  phChart.data.labels = labels;
  phChart.data.datasets[0].data = history.ph;
  phChart.update("none");

  sensorChart.data.labels = labels;
  sensorChart.data.datasets[0].data = history.primary;
  sensorChart.data.datasets[1].data = history.verification;
  sensorChart.update("none");

  doseChart.data.labels = labels;
  doseChart.data.datasets[0].data = history.requested_dose;
  doseChart.data.datasets[1].data = history.actual_dose;
  doseChart.update("none");

  // 4. Update Cyber-Physical Pipeline & Defense Schematic
  updatePipelineSchematic(state);

  // 5. Update Exploit Stepper & Gate Statuses
  updateStepperAndGates(state);

  // 6. Update Event Log
  renderEvents(state.events);
}

/**
 * Real-Time Cyber-Physical Schematic Animation
 */
function updatePipelineSchematic(state) {
  const sensors = state.sensors;
  const control = state.control;
  const isBlocked = state.system_status === "BLOCKED";
  const isDanger = state.system_status === "DANGER";
  const isAttacking = state.active_attack !== null || sensors.primary_injected || sensors.flow_injected;

  // Text values on SVG
  document.getElementById("svg-text-primary").textContent = `P: ${sensors.primary_ppm.toFixed(0)} ppm`;
  document.getElementById("svg-text-verif").textContent = `V: ${sensors.verification_ppm.toFixed(0)} ppm`;
  document.getElementById("svg-req-dose").textContent = `Req: ${control.requested_dose_ppm.toFixed(0)} ppm`;
  document.getElementById("svg-act-dose").textContent = `Act: ${control.actual_dose_ppm.toFixed(0)} ppm`;
  document.getElementById("svg-tank-ph").textContent = `${control.ph.toFixed(2)} pH`;

  // Attacker Beam
  const attackBeam = document.getElementById("svg-attack-beam");
  const attackLabel = document.getElementById("svg-attack-label");
  if (isAttacking) {
    attackBeam.setAttribute("opacity", "1");
    attackLabel.setAttribute("opacity", "1");
    document.getElementById("svg-node-sensor").setAttribute("stroke", "#ef4444");
  } else {
    attackBeam.setAttribute("opacity", "0");
    attackLabel.setAttribute("opacity", "0");
    document.getElementById("svg-node-sensor").setAttribute("stroke", "#0ea5e9");
  }

  // SIS Defense Shield
  const shield = document.getElementById("svg-sis-shield");
  const shieldText = document.getElementById("svg-shield-text");
  const pipelineBadge = document.getElementById("pipeline-status-badge");

  if (!state.interlock_on) {
    // Interlock Bypassed (Switch OFF)
    shield.setAttribute("filter", "");
    shield.querySelector("circle").setAttribute("stroke", "#71717a");
    shield.querySelector("circle").setAttribute("stroke-dasharray", "4 4");
    shield.querySelector("path").setAttribute("fill", "#71717a");
    shieldText.textContent = "SIS BYPASSED";
    shieldText.setAttribute("fill", "#71717a");
    pipelineBadge.textContent = "SAFETY BYPASSED";
    pipelineBadge.className = "badge badge-destructive";
  } else if (isBlocked) {
    // Actively Deflecting Malicious Attack!
    shield.setAttribute("filter", "url(#glowRed)");
    shield.querySelector("circle").setAttribute("stroke", "#ef4444");
    shield.querySelector("circle").setAttribute("stroke-dasharray", "");
    shield.querySelector("path").setAttribute("fill", "#ef4444");
    shieldText.textContent = "SHIELD: DOSE DEFLECTED";
    shieldText.setAttribute("fill", "#ef4444");
    pipelineBadge.textContent = "DOSE BLOCKED BY SIS";
    pipelineBadge.className = "badge badge-destructive";
  } else {
    // Armed and nominal
    shield.setAttribute("filter", "url(#glowGreen)");
    shield.querySelector("circle").setAttribute("stroke", "#10b981");
    shield.querySelector("circle").setAttribute("stroke-dasharray", "");
    shield.querySelector("path").setAttribute("fill", "#10b981");
    shieldText.textContent = "SIS INTERLOCK (SIL-3)";
    shieldText.setAttribute("fill", "#10b981");
    pipelineBadge.textContent = "SHIELD ARMED";
    pipelineBadge.className = "badge badge-outline";
  }

  // Pump Actuator & Tank Color
  const pumpNode = document.getElementById("svg-node-pump");
  const tankNode = document.getElementById("svg-node-tank");
  const tankText = document.getElementById("svg-tank-ph");

  if (isDanger) {
    pumpNode.setAttribute("stroke", "#ef4444");
    pumpNode.setAttribute("fill", "rgba(239, 68, 68, 0.2)");
    tankNode.setAttribute("stroke", "#ef4444");
    tankNode.setAttribute("fill", "rgba(239, 68, 68, 0.3)");
    tankText.setAttribute("fill", "#ef4444");
  } else if (control.ph_band === "elevated") {
    pumpNode.setAttribute("stroke", "#f59e0b");
    tankNode.setAttribute("stroke", "#f59e0b");
    tankText.setAttribute("fill", "#fbbf24");
  } else {
    pumpNode.setAttribute("stroke", "#0ea5e9");
    pumpNode.setAttribute("fill", "#18181b");
    tankNode.setAttribute("stroke", "#10b981");
    tankNode.setAttribute("fill", "#18181b");
    tankText.setAttribute("fill", "#34d399");
  }
}

function resetPipelineSchematic() {
  document.getElementById("svg-attack-beam").setAttribute("opacity", "0");
  document.getElementById("svg-attack-label").setAttribute("opacity", "0");
  document.getElementById("svg-node-sensor").setAttribute("stroke", "#0ea5e9");
}

/**
 * Update Exploit Stage Stepper & Safety Gate Status Cards
 */
function updateStepperAndGates(state) {
  const isAttacking = state.active_attack !== null || state.sensors.primary_injected;
  const isBlocked = state.system_status === "BLOCKED";
  const isDanger = state.system_status === "DANGER";

  const step1 = document.getElementById("step-phase-1");
  const step2 = document.getElementById("step-phase-2");
  const step3 = document.getElementById("step-phase-3");
  const step4 = document.getElementById("step-phase-4");

  if (isAttacking) {
    step1.className = "step-item passed";
    step2.className = "step-item passed";
    if (state.interlock_on && isBlocked) {
      step3.className = "step-item active";
      step4.className = "step-item passed";
    } else if (!state.interlock_on && isDanger) {
      step3.className = "step-item";
      step4.className = "step-item active";
    }
  } else {
    step1.className = "step-item";
    step2.className = "step-item";
    step3.className = "step-item";
    step4.className = "step-item";
  }

  // Safety Gate Badges
  const g1 = document.getElementById("gate1-status");
  const g2 = document.getElementById("gate2-status");
  const g3 = document.getElementById("gate3-status");

  const lastReason = state.last_decision ? state.last_decision.reason : "";
  if (isBlocked && lastReason.includes("HARD_BOUND_EXCEEDED")) {
    g1.textContent = "TRIPPED";
    g1.className = "gate-badge badge-destructive";
  } else {
    g1.textContent = "MONITORING";
    g1.className = "gate-badge badge-outline";
  }

  if (isBlocked && lastReason.includes("RATE_OF_CHANGE_EXCEEDED")) {
    g2.textContent = "TRIPPED";
    g2.className = "gate-badge badge-destructive";
  } else {
    g2.textContent = "MONITORING";
    g2.className = "gate-badge badge-outline";
  }

  if (isBlocked && lastReason.includes("SENSOR_DISAGREEMENT")) {
    g3.textContent = "TRIPPED";
    g3.className = "gate-badge badge-destructive";
  } else {
    g3.textContent = "MONITORING";
    g3.className = "gate-badge badge-outline";
  }
}

/**
 * Status Pill & Sustained 3s Block Glow Choreography
 */
function updateStatusPill(state) {
  const pill = document.getElementById("status-pill");
  const text = document.getElementById("status-text");
  const sideStatus = document.getElementById("sidebar-status-text");

  if (state.system_status === "DANGER") {
    pill.className = "status-pill danger";
    text.textContent = `CRITICAL DANGER: pH ${state.control.ph.toFixed(2)}`;
    sideStatus.textContent = "HAZARD TRIP";
    sideStatus.className = "badge badge-destructive";
    triggerBlockGlow();
  } else if (state.system_status === "BLOCKED") {
    pill.className = "status-pill blocked";
    const gateName = state.last_decision ? state.last_decision.reason.split(":")[0] : "DOSE BLOCKED";
    text.textContent = `BLOCKED: ${gateName}`;
    sideStatus.textContent = "DOSE BLOCKED";
    sideStatus.className = "badge badge-destructive";
    triggerBlockGlow();
  } else {
    pill.className = "status-pill nominal";
    text.textContent = "NOMINAL OPERATION";
    sideStatus.textContent = "OPTIMAL";
    sideStatus.className = "badge badge-outline";
  }
}

function triggerBlockGlow() {
  document.body.classList.add("block-active");
  if (blockDecayTimeout) clearTimeout(blockDecayTimeout);
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
    el.style.color = "var(--muted-foreground)";
    return;
  }
  const diff = current - previous;
  if (Math.abs(diff) < 0.05) {
    el.textContent = "■ 0.0";
    el.style.color = "var(--muted-foreground)";
  } else if (diff > 0) {
    el.textContent = `▲ +${diff.toFixed(decimals)}`;
    el.style.color = "#f87171";
  } else {
    el.textContent = `▼ ${diff.toFixed(decimals)}`;
    el.style.color = "#38bdf8";
  }
}

/**
 * Event Log Rendering
 */
function renderEvents(events) {
  const container = document.getElementById("event-log");
  const countBadge = document.getElementById("event-count-badge");
  countBadge.textContent = `${events.length} EVENTS`;

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
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span class="badge ${badgeClass}">${ev.type}</span>
        <span class="mono" style="font-size: 0.65rem; color: var(--muted-foreground);">${ev.time_str}</span>
      </div>
      <div style="font-weight: 600; color: var(--foreground);">${escapeHtml(ev.message)}</div>
      <div style="font-size: 0.68rem; color: var(--muted-foreground);">${escapeHtml(ev.detail)}</div>
    `;

    container.insertBefore(item, container.firstChild);
  });
}

/**
 * Query SQLite Audit Trail
 */
async function loadAuditTrail() {
  const tbody = document.getElementById("audit-table-body");
  try {
    const runsRes = await fetch("/runs");
    const runs = await runsRes.json();
    if (!runs || !runs.length) {
      tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 2rem; color: var(--muted-foreground);">No audit records found in SQLite sink.</td></tr>`;
      return;
    }

    const latestRun = runs[0].run_id;
    const decRes = await fetch(`/runs/${latestRun}/decisions?limit=100`);
    const decData = await decRes.json();
    const records = decData.decisions || [];

    if (!records.length) {
      tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 2rem; color: var(--muted-foreground);">Run ${latestRun} has no decisions recorded.</td></tr>`;
      return;
    }

    tbody.innerHTML = records
      .slice(-30)
      .reverse()
      .map(
        (r) => `
      <tr>
        <td class="mono" style="color: var(--muted-foreground);">${r.iso_time.split(" ")[1] || r.iso_time}</td>
        <td class="mono font-bold">${r.run_id.slice(-6)}</td>
        <td>
          <span class="badge ${r.decision === "BLOCKED" ? "badge-destructive" : "badge-outline"}">
            ${r.decision}
          </span>
        </td>
        <td class="mono font-bold" style="color: #f87171;">${r.requested_dose.toFixed(1)}</td>
        <td class="mono font-bold" style="color: #38bdf8;">${r.actual_dose.toFixed(1)}</td>
        <td class="mono">${r.resulting_ppm.toFixed(1)}</td>
        <td class="mono font-bold ${r.ph > 10 ? "ph-dangerous" : r.ph > 8.5 ? "ph-elevated" : "ph-safe"}">${r.ph.toFixed(2)}</td>
        <td class="mono">${r.primary_ppm.toFixed(1)}</td>
        <td class="mono">${r.verification_ppm.toFixed(1)}</td>
        <td class="mono">${r.flow.toFixed(1)}</td>
        <td style="font-size: 0.7rem; color: var(--muted-foreground); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(r.reason)}">
          ${escapeHtml(r.reason)}
        </td>
      </tr>
    `
      )
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: #f87171; padding: 2rem;">Failed to load audit records: ${err}</td></tr>`;
  }
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
