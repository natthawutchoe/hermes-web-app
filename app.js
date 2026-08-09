const STORAGE_KEY = "hermes-university-agent-v1";
const APP_KEY_STORAGE_KEY = "hermes-app-key";
const API_STATE_URL = "/api/state";
const API_BRAIN_DUMP_URL = "/api/brain-dump";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const courseHints = ["FIN", "MKT", "BIS", "ACC", "BUS", "ENG", "ECO", "MAT", "STA", "IS"];

const realCourses = [
  { id: "c-01132326-65", code: "01132326-65", name: "Organization Development", color: "amber" },
  { id: "c-03521101-67", code: "03521101-67", name: "Sea and Life", color: "amber" },
  { id: "c-01132417-65", code: "01132417-65", name: "Sustainability Management", color: "amber" },
  { id: "c-01132333-65", code: "01132333-65", name: "Business Information Systems", color: "green" },
  { id: "c-03754221-67", code: "03754221-67", name: "Basic English Pronunciation", color: "green" },
  { id: "c-01132332-65", code: "01132332-65", name: "Quantitative Analysis for Decision Making", color: "blue" },
  { id: "c-01362101-67", code: "01362101-67", name: "Chinese I", color: "blue" }
];

const realClasses = [
  { id: "class-org-dev-tue", day: "Tue", dayIndex: 2, start: "13:00", end: "16:00", courseCode: "01132326-65", title: "Organization Development", room: "10212", section: "800" },
  { id: "class-sea-life-wed", day: "Wed", dayIndex: 3, start: "09:00", end: "12:00", courseCode: "03521101-67", title: "Sea and Life", room: "17402", section: "800" },
  { id: "class-sustainability-wed", day: "Wed", dayIndex: 3, start: "13:00", end: "16:00", courseCode: "01132417-65", title: "Sustainability Management", room: "27603", section: "800" },
  { id: "class-bis-thu", day: "Thu", dayIndex: 4, start: "09:00", end: "12:00", courseCode: "01132333-65", title: "Business Information Systems", room: "27501", section: "800" },
  { id: "class-english-thu", day: "Thu", dayIndex: 4, start: "13:00", end: "16:00", courseCode: "03754221-67", title: "Basic English Pronunciation", room: "10207", section: "800" },
  { id: "class-quant-fri", day: "Fri", dayIndex: 5, start: "09:00", end: "12:00", courseCode: "01132332-65", title: "Quantitative Analysis for Decision Making", room: "17303", section: "800" },
  { id: "class-chinese-fri", day: "Fri", dayIndex: 5, start: "13:00", end: "16:00", courseCode: "01362101-67", title: "Chinese I", room: "17205", section: "801" }
];

const courseAliases = [
  { code: "01132326-65", name: "Organization Development", terms: ["organization development", "org dev", "องค์การ", "พัฒนาองค์การ"] },
  { code: "03521101-67", name: "Sea and Life", terms: ["sea and life", "ทะเล", "ชีวิตกับทะเล"] },
  { code: "01132417-65", name: "Sustainability Management", terms: ["sustainability", "sustainability management", "ความยั่งยืน"] },
  { code: "01132333-65", name: "Business Information Systems", terms: ["bis", "business information systems", "database", "ระบบสารสนเทศ", "ฐานข้อมูล"] },
  { code: "03754221-67", name: "Basic English Pronunciation", terms: ["english pronunciation", "pronunciation", "อังกฤษ", "การออกเสียง"] },
  { code: "01132332-65", name: "Quantitative Analysis for Decision Making", terms: ["quantitative", "decision making", "quant", "วิเคราะห์เชิงปริมาณ"] },
  { code: "01362101-67", name: "Chinese I", terms: ["chinese", "จีน"] },
  { code: "FIN000", name: "Finance", terms: ["finance", "financial", "ไฟแนนซ์", "การเงิน"] },
  { code: "ACC000", name: "Accounting", terms: ["accounting", "account", "บัญชี"] },
  { code: "MKT000", name: "Marketing", terms: ["marketing", "market", "การตลาด"] }
];

const defaultState = {
  settings: { hourTarget: 3, riskWindow: 3 },
  weekOffset: 0,
  courses: structuredClone(realCourses),
  classes: structuredClone(realClasses),
  tasks: [],
  chat: [
    { role: "hermes", text: "Inbox พร้อมแล้ว ส่งงานหรือ deadline จาก Discord/Inbox มาได้เลย เดี๋ยวผมแยกเข้าวิชาและ Dashboard ให้" }
  ]
};

let state = loadState();
let apiSyncAvailable = false;
let lastStateSnapshot = "";

function $(selector) {
  return document.querySelector(selector);
}

function $all(selector) {
  return [...document.querySelectorAll(selector)];
}

function getAppKey() {
  return localStorage.getItem(APP_KEY_STORAGE_KEY) || "";
}

function apiHeaders() {
  const headers = { "Content-Type": "application/json" };
  const key = getAppKey();
  if (key) headers["x-hermes-key"] = key;
  return headers;
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysFromNow(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaultState);
  try {
    return normalizeState(JSON.parse(saved));
  } catch {
    return structuredClone(defaultState);
  }
}

function normalizeState(nextState) {
  return {
    ...structuredClone(defaultState),
    ...nextState,
    settings: { ...defaultState.settings, ...(nextState?.settings || {}) },
    courses: Array.isArray(nextState?.courses) ? nextState.courses : structuredClone(defaultState.courses),
    classes: Array.isArray(nextState?.classes) ? nextState.classes : structuredClone(defaultState.classes),
    tasks: Array.isArray(nextState?.tasks) ? nextState.tasks : [],
    chat: Array.isArray(nextState?.chat) ? nextState.chat : structuredClone(defaultState.chat)
  };
}

async function loadStateFromApi({ silent = true } = {}) {
  if (location.protocol === "file:") return false;
  try {
    const response = await fetch(`${API_STATE_URL}?t=${Date.now()}`, {
      cache: "no-store",
      headers: apiHeaders()
    });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const remoteState = normalizeState(await response.json());
    const snapshot = JSON.stringify(remoteState);
    apiSyncAvailable = true;
    if (snapshot !== lastStateSnapshot) {
      state = remoteState;
      lastStateSnapshot = snapshot;
      renderAll({ persist: false });
    }
    return true;
  } catch (error) {
    apiSyncAvailable = false;
    if (!silent) console.warn("Hermes API sync unavailable", error);
    return false;
  }
}

async function sendBrainDumpToApi(text) {
  if (location.protocol === "file:") return null;
  try {
    const response = await fetch(API_BRAIN_DUMP_URL, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({ text, source: "dashboard" })
    });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const payload = await response.json();
    apiSyncAvailable = true;
    if (payload.state) {
      state = normalizeState(payload.state);
      lastStateSnapshot = JSON.stringify(state);
    }
    return payload;
  } catch (error) {
    apiSyncAvailable = false;
    console.warn("Hermes API brain dump failed, using local state", error);
    return null;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (location.protocol !== "file:") {
    fetch(API_STATE_URL, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify(state)
    })
      .then((response) => {
        apiSyncAvailable = response.ok;
        lastStateSnapshot = JSON.stringify(state);
      })
      .catch(() => {
        apiSyncAvailable = false;
      });
  }
}

function parseDateLoose(text) {
  const lower = text.toLowerCase();
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  if (/(วันนี้|today)/i.test(text)) return now;
  if (/(พรุ่งนี้|tomorrow)/i.test(text)) return addDays(now, 1);
  if (/(มะรืน|day after tomorrow)/i.test(text)) return addDays(now, 2);

  const nextDayMap = [
    ["จันทร์", 1], ["monday", 1],
    ["อังคาร", 2], ["tuesday", 2],
    ["พุธ", 3], ["wednesday", 3],
    ["พฤหัส", 4], ["thursday", 4],
    ["ศุกร์", 5], ["friday", 5],
    ["เสาร์", 6], ["saturday", 6],
    ["อาทิตย์", 0], ["sunday", 0]
  ];
  for (const [label, targetDay] of nextDayMap) {
    if (lower.includes(label)) {
      let diff = targetDay - now.getDay();
      if (diff <= 0) diff += 7;
      return addDays(now, diff);
    }
  }

  const iso = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12);
  const shortDate = text.match(/\b(\d{1,2})[/-](\d{1,2})\b/);
  if (shortDate) return new Date(now.getFullYear(), Number(shortDate[2]) - 1, Number(shortDate[1]), 12);
  return addDays(now, 3);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function extractCourse(text) {
  const uppercase = text.toUpperCase();
  const kuCode = text.match(/\b\d{8}-\d{2}\b/);
  if (kuCode) return kuCode[0];
  const known = state.courses.find((course) => uppercase.includes(course.code) || uppercase.includes(course.name.toUpperCase()));
  if (known) return known.code;
  const alias = courseAliases.find((item) => item.terms.some((term) => text.toLowerCase().includes(term.toLowerCase())));
  if (alias) return alias.code;
  const courseCode = uppercase.match(/\b[A-Z]{2,4}\s?\d{2,4}\b/);
  if (courseCode) return courseCode[0].replace(/\s+/g, "");
  const hint = courseHints.find((prefix) => uppercase.includes(prefix));
  return hint ? `${hint}000` : "GEN000";
}

function ensureCourse(courseCode) {
  const existing = state.courses.find((course) => course.code === courseCode);
  if (existing) return existing;
  const alias = courseAliases.find((item) => item.code === courseCode);
  const course = {
    id: `course-${Date.now()}`,
    code: courseCode,
    name: alias ? alias.name : courseCode === "GEN000" ? "General Academic Inbox" : courseCode,
    color: "dark"
  };
  state.courses.push(course);
  return course;
}

function extractTitle(text, courseCode) {
  const cleaned = text
    .replace(courseCode, "")
    .replace(/(?:วิชา|class|course)\s*[^\s,，:：]+(?:\s+[^\s,，:：]+)?/gi, " ")
    .replace(/(วิชา|class|course|มี|ส่ง|due|deadline|ต้อง|ทำ|ยังไม่ได้เริ่ม|not started)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Review and organize course task";
}

function inferPriority(dueDate, text) {
  const days = Math.ceil((startOfDay(dueDate) - startOfDay(new Date())) / 86400000);
  if (/(ด่วน|urgent|ยังไม่ได้เริ่ม|not started|สอบ|exam|quiz)/i.test(text) || days <= 1) return "high";
  if (days <= Number(state.settings.riskWindow)) return "medium";
  return "low";
}

function taskFromBrainDump(text) {
  const courseCode = extractCourse(text);
  ensureCourse(courseCode);
  const dueDate = parseDateLoose(text);
  const priority = inferPriority(dueDate, text);
  return {
    id: `task-${Date.now()}`,
    courseCode,
    title: extractTitle(text, courseCode),
    due: dueDate.toISOString().slice(0, 10),
    status: /(เสร็จ|done|finished)/i.test(text)
      ? "done"
      : /(เริ่ม|started|กำลัง)/i.test(text)
        ? "in-progress"
        : "not-started",
    estimate: priority === "high" ? 45 : 35,
    priority,
    source: text
  };
}

function formatDate(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function daysUntil(iso) {
  return Math.ceil((startOfDay(new Date(`${iso}T12:00:00`)) - startOfDay(new Date())) / 86400000);
}

function sortedOpenTasks() {
  return state.tasks.filter((task) => task.status !== "done").sort((a, b) => new Date(a.due) - new Date(b.due));
}

function classesForDay(dayIndex) {
  return state.classes.filter((item) => Number(item.dayIndex) === Number(dayIndex)).sort((a, b) => a.start.localeCompare(b.start));
}

function priorityLabel(priority) {
  if (priority === "high") return "High risk";
  if (priority === "medium") return "Watch";
  return "Light";
}

function colorForClass(classItem) {
  return state.courses.find((item) => item.code === classItem.courseCode)?.color || "blue";
}

function renderClassCard(classItem, showDay = false) {
  return `
    <article class="class-card ${escapeHtml(colorForClass(classItem))}">
      <div class="task-top">
        <div>
          ${showDay ? `<div class="class-day">${escapeHtml(classItem.day)}</div>` : ""}
          <p class="task-title">${escapeHtml(classItem.title)}</p>
          <div class="task-meta">
            <span class="tag">${escapeHtml(classItem.courseCode)}</span>
            <span>Room ${escapeHtml(classItem.room)}</span>
            <span>Sec ${escapeHtml(classItem.section)}</span>
          </div>
        </div>
        <span class="class-time">${escapeHtml(classItem.start)}-${escapeHtml(classItem.end)}</span>
      </div>
    </article>
  `;
}

function renderTask(task, compact = false) {
  const delta = daysUntil(task.due);
  const dueText = delta < 0 ? `${Math.abs(delta)}d late` : delta === 0 ? "Today" : delta === 1 ? "Tomorrow" : `${delta}d left`;
  return `
    <article class="task-card">
      <div class="task-top">
        <div>
          <p class="task-title">${escapeHtml(task.title)}</p>
          <div class="task-meta">
            <span class="tag">${escapeHtml(task.courseCode)}</span>
            <span>${formatDate(task.due)}</span>
            <span>${dueText}</span>
            <span>${task.estimate} min</span>
          </div>
        </div>
        <span class="tag ${task.priority}">${priorityLabel(task.priority)}</span>
      </div>
      ${compact ? "" : `
        <div class="task-actions">
          <button data-action="start" data-id="${task.id}" type="button">Start</button>
          <button data-action="done" data-id="${task.id}" type="button">Done</button>
        </div>
      `}
    </article>
  `;
}

function renderDashboard() {
  const open = sortedOpenTasks();
  const dueSoon = open.filter((task) => daysUntil(task.due) <= 3);
  const highRisk = open.filter((task) => task.priority === "high");
  const todayPlan = open.slice(0, 3);
  const plannedMinutes = todayPlan.reduce((sum, task) => sum + Number(task.estimate || 0), 0);

  $("#metricDue").textContent = dueSoon.length;
  $("#metricRisk").textContent = highRisk.length;
  $("#metricHours").textContent = `${(plannedMinutes / 60).toFixed(1)}h`;
  $("#metricCourses").textContent = state.courses.length;
  $("#metricDueText").textContent = dueSoon.length ? "Due in 3 days" : "No pressure today";

  $("#todayPlan").innerHTML = todayPlan.length
    ? todayPlan.map((task) => renderTask(task)).join("")
    : `<div class="empty-state">ยังไม่มีงานในระบบ ส่งงานหรือ deadline ให้ Hermes จาก Discord หรือ Inbox ได้เลย</div>`;
  $("#deadlineList").innerHTML = open.length
    ? open.slice(0, 12).map((task) => renderTask(task, true)).join("")
    : `<div class="empty-state">No upcoming deadlines.</div>`;
  $("#nextDeadline").innerHTML = open[0]
    ? `<strong>Next deadline</strong><p>${escapeHtml(open[0].courseCode)} · ${escapeHtml(open[0].title)} · ${formatDate(open[0].due)}</p>`
    : `<strong>All clear</strong><p>No deadline has been captured yet.</p>`;

  renderWeek();
  renderTodayClasses();
}

function renderTodayClasses() {
  const todayClasses = classesForDay(new Date().getDay());
  $("#todayClasses").innerHTML = todayClasses.length
    ? todayClasses.map((item) => renderClassCard(item)).join("")
    : `<div class="empty-state">วันนี้ไม่มีคลาสตามตารางเรียนที่ให้มา</div>`;
}

function renderWeek() {
  const base = new Date();
  base.setDate(base.getDate() + state.weekOffset * 7);
  const start = new Date(base);
  start.setDate(base.getDate() - base.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  $("#weekTitle").textContent = `${start.toLocaleDateString("en-GB", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-GB", { month: "short", day: "numeric" })}`;

  const todayIso = daysFromNow(0);
  $("#weekStrip").innerHTML = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const iso = date.toISOString().slice(0, 10);
    const taskCount = state.tasks.filter((task) => task.due === iso && task.status !== "done").length;
    const classCount = classesForDay(date.getDay()).length;
    return `
      <button class="day-pill ${iso === todayIso ? "is-today" : ""}" type="button">
        <span>${dayNames[date.getDay()]}</span>
        <strong>${date.getDate()}</strong>
        <small>${classCount ? `${classCount} class` : taskCount ? `${taskCount} task` : ""}</small>
      </button>
    `;
  }).join("");
}

function renderWeeklyClasses() {
  const grouped = [1, 2, 3, 4, 5, 6, 0].flatMap((dayIndex) => classesForDay(dayIndex).map((item) => renderClassCard(item, true)));
  $("#weeklyClasses").innerHTML = grouped.length ? grouped.join("") : `<div class="empty-state">No classes saved yet.</div>`;
}

function renderCourses() {
  $("#courseList").innerHTML = state.courses.map((course) => {
    const tasks = state.tasks.filter((task) => task.courseCode === course.code);
    const done = tasks.filter((task) => task.status === "done").length;
    const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    return `
      <article class="course-card">
        <div class="course-row">
          <div>
            <p class="task-title">${escapeHtml(course.code)}</p>
            <div class="task-meta">${escapeHtml(course.name)}</div>
          </div>
          <span class="tag">${tasks.length} tasks</span>
        </div>
        <div class="progress"><span style="width: ${progress}%"></span></div>
        <div class="task-meta">${progress}% cleared</div>
      </article>
    `;
  }).join("");
}

function renderCalendar() {
  const open = sortedOpenTasks();
  renderWeeklyClasses();
  $("#timeline").innerHTML = open.length
    ? open.map((task) => `
      <article class="timeline-item ${task.priority}">
        <p class="task-title">${formatDate(task.due)} · ${escapeHtml(task.courseCode)}</p>
        <div class="task-meta">${escapeHtml(task.title)} · ${priorityLabel(task.priority)}</div>
      </article>
    `).join("")
    : `<div class="empty-state">Calendar is empty until Hermes captures your first deadline.</div>`;
}

function renderChat() {
  $("#chatLog").innerHTML = state.chat.map((message) => `
    <div class="chat-bubble ${message.role}">
      ${escapeHtml(message.text)}
    </div>
  `).join("");
  $("#chatLog").scrollTop = $("#chatLog").scrollHeight;
}

function renderSettings() {
  $("#hourTarget").value = state.settings.hourTarget;
  $("#riskWindow").value = state.settings.riskWindow;
  $("#appKeyInput").value = getAppKey();
}

function currentScheduleTemplate() {
  return {
    courses: state.courses.map(({ id, code, name, color }) => ({ id, code, name, color })),
    classes: state.classes.map(({ id, day, dayIndex, start, end, courseCode, title, room, section }) => ({ id, day, dayIndex, start, end, courseCode, title, room, section }))
  };
}

function normalizeImportedSchedule(payload) {
  const importedClasses = Array.isArray(payload?.classes) ? payload.classes : Array.isArray(payload) ? payload : [];
  if (!importedClasses.length) throw new Error("Schedule file needs a classes array.");
  const classes = importedClasses.map((item, index) => {
    const dayIndex = Number(item.dayIndex);
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) throw new Error(`Class ${index + 1} needs dayIndex 0-6.`);
    for (const field of ["start", "end", "courseCode", "title"]) {
      if (!item[field]) throw new Error(`Class ${index + 1} is missing ${field}.`);
    }
    return {
      id: item.id || `class-${String(item.courseCode).toLowerCase()}-${dayNames[dayIndex].toLowerCase()}-${String(item.start).replace(":", "")}`,
      day: item.day || dayNames[dayIndex],
      dayIndex,
      start: String(item.start),
      end: String(item.end),
      courseCode: String(item.courseCode),
      title: String(item.title),
      room: item.room ? String(item.room) : "-",
      section: item.section ? String(item.section) : "-"
    };
  });

  const coursesByCode = new Map();
  (Array.isArray(payload?.courses) ? payload.courses : []).forEach((course) => {
    if (!course?.code) return;
    coursesByCode.set(String(course.code), {
      id: course.id || `c-${String(course.code).toLowerCase()}`,
      code: String(course.code),
      name: course.name ? String(course.name) : String(course.code),
      color: course.color ? String(course.color) : "blue"
    });
  });
  classes.forEach((classItem, index) => {
    if (!coursesByCode.has(classItem.courseCode)) {
      coursesByCode.set(classItem.courseCode, {
        id: `c-${classItem.courseCode.toLowerCase()}`,
        code: classItem.courseCode,
        name: classItem.title,
        color: ["amber", "green", "blue"][index % 3]
      });
    }
  });
  return { courses: [...coursesByCode.values()], classes };
}

function replaceSchedule(schedule) {
  state.courses = schedule.courses;
  state.classes = schedule.classes;
  state.weekOffset = 0;
  state.chat.push({ role: "hermes", text: `อัปเดตตารางเรียนแล้ว: ${schedule.courses.length} วิชา, ${schedule.classes.length} คาบ` });
  $("#scheduleStatus").textContent = `Imported ${schedule.courses.length} courses and ${schedule.classes.length} classes.`;
  renderAll();
}

function renderAll({ persist = true } = {}) {
  renderDashboard();
  renderCourses();
  renderCalendar();
  renderChat();
  renderSettings();
  if (persist) saveState();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function switchTab(tab) {
  $all(".view").forEach((view) => view.classList.remove("is-active"));
  $(`#${tab}View`).classList.add("is-active");
  $all("[data-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.tab === tab));
}

document.addEventListener("click", (event) => {
  const tabButton = event.target.closest("[data-tab]");
  if (tabButton) switchTab(tabButton.dataset.tab);
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    const task = state.tasks.find((item) => item.id === actionButton.dataset.id);
    if (!task) return;
    task.status = actionButton.dataset.action === "done" ? "done" : "in-progress";
    renderAll();
  }
});

$("#brainForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = $("#brainInput").value.trim();
  if (!text) return;
  $("#brainInput").value = "";
  const apiPayload = await sendBrainDumpToApi(text);
  if (apiPayload?.state) {
    renderAll({ persist: false });
    return;
  }
  const task = taskFromBrainDump(text);
  state.tasks.push(task);
  state.chat.push({ role: "user", text });
  state.chat.push({
    role: "hermes",
    text: `ผมจับได้ว่าเป็น ${task.courseCode}: ${task.title} ส่ง ${formatDate(task.due)} เพิ่มเข้า Dashboard แล้ว และตั้ง priority เป็น ${priorityLabel(task.priority)}`
  });
  renderAll();
});

$("#sampleButton").addEventListener("click", () => {
  $("#brainInput").value = "BIS มี project database ส่งศุกร์หน้า ต้องทำ ER diagram กับ presentation ยังไม่ได้เริ่ม";
  $("#brainInput").focus();
});

$("#prevWeek").addEventListener("click", () => {
  state.weekOffset -= 1;
  renderAll();
});

$("#nextWeek").addEventListener("click", () => {
  state.weekOffset += 1;
  renderAll();
});

$("#addCourseButton").addEventListener("click", () => {
  $("#courseDialog").showModal();
  $("#courseCode").focus();
});

$("#courseForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const code = $("#courseCode").value.trim().toUpperCase();
  const name = $("#courseName").value.trim() || code;
  if (!code) return;
  ensureCourse(code);
  state.courses.find((item) => item.code === code).name = name;
  $("#courseCode").value = "";
  $("#courseName").value = "";
  $("#courseDialog").close();
  renderAll();
});

$("#hourTarget").addEventListener("change", (event) => {
  state.settings.hourTarget = Number(event.target.value);
  renderAll();
});

$("#riskWindow").addEventListener("change", (event) => {
  state.settings.riskWindow = Number(event.target.value);
  renderAll();
});

function saveAppKeyFromInput(event) {
  localStorage.setItem(APP_KEY_STORAGE_KEY, event.target.value.trim());
}

$("#appKeyInput").addEventListener("input", saveAppKeyFromInput);

$("#appKeyInput").addEventListener("change", (event) => {
  saveAppKeyFromInput(event);
  loadStateFromApi({ silent: false });
});

$("#saveAppKeyButton").addEventListener("click", () => {
  localStorage.setItem(APP_KEY_STORAGE_KEY, $("#appKeyInput").value.trim());
  loadStateFromApi({ silent: false });
});

$("#scheduleImport").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    replaceSchedule(normalizeImportedSchedule(JSON.parse(await file.text())));
    event.target.value = "";
  } catch (error) {
    $("#scheduleStatus").textContent = `Import failed: ${error.message}`;
  }
});

$("#downloadScheduleButton").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(currentScheduleTemplate(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "hermes-schedule-template.json";
  link.click();
  URL.revokeObjectURL(url);
  $("#scheduleStatus").textContent = "Downloaded current schedule template.";
});

$("#resetDemoButton").addEventListener("click", () => {
  state = structuredClone(defaultState);
  renderAll();
});

$("#searchButton").addEventListener("click", () => {
  switchTab("chat");
  $("#brainInput").focus();
});

renderAll({ persist: false });
loadStateFromApi({ silent: true });
setInterval(() => loadStateFromApi({ silent: true }), 4000);
