const defaultState = {
  settings: { hourTarget: 3, riskWindow: 3 },
  weekOffset: 0,
  courses: [
    { id: "c-01132326-65", code: "01132326-65", name: "Organization Development", color: "amber" },
    { id: "c-03521101-67", code: "03521101-67", name: "Sea and Life", color: "amber" },
    { id: "c-01132417-65", code: "01132417-65", name: "Sustainability Management", color: "amber" },
    { id: "c-01132333-65", code: "01132333-65", name: "Business Information Systems", color: "green" },
    { id: "c-03754221-67", code: "03754221-67", name: "Basic English Pronunciation", color: "green" },
    { id: "c-01132332-65", code: "01132332-65", name: "Quantitative Analysis for Decision Making", color: "blue" },
    { id: "c-01362101-67", code: "01362101-67", name: "Chinese I", color: "blue" }
  ],
  classes: [
    { id: "class-org-dev-tue", day: "Tue", dayIndex: 2, start: "13:00", end: "16:00", courseCode: "01132326-65", title: "Organization Development", room: "10212", section: "800" },
    { id: "class-sea-life-wed", day: "Wed", dayIndex: 3, start: "09:00", end: "12:00", courseCode: "03521101-67", title: "Sea and Life", room: "17402", section: "800" },
    { id: "class-sustainability-wed", day: "Wed", dayIndex: 3, start: "13:00", end: "16:00", courseCode: "01132417-65", title: "Sustainability Management", room: "27603", section: "800" },
    { id: "class-bis-thu", day: "Thu", dayIndex: 4, start: "09:00", end: "12:00", courseCode: "01132333-65", title: "Business Information Systems", room: "27501", section: "800" },
    { id: "class-english-thu", day: "Thu", dayIndex: 4, start: "13:00", end: "16:00", courseCode: "03754221-67", title: "Basic English Pronunciation", room: "10207", section: "800" },
    { id: "class-quant-fri", day: "Fri", dayIndex: 5, start: "09:00", end: "12:00", courseCode: "01132332-65", title: "Quantitative Analysis for Decision Making", room: "17303", section: "800" },
    { id: "class-chinese-fri", day: "Fri", dayIndex: 5, start: "13:00", end: "16:00", courseCode: "01362101-67", title: "Chinese I", room: "17205", section: "801" }
  ],
  tasks: [],
  chat: [
    { role: "hermes", text: "Inbox พร้อมแล้ว ส่งงานหรือ deadline จาก Discord/Inbox มาได้เลย เดี๋ยวผมแยกเข้าวิชาและ Dashboard ให้" }
  ]
};

const aliases = [
  { code: "01132326-65", name: "Organization Development", terms: ["organization development", "org dev", "องค์การ", "พัฒนาองค์การ"] },
  { code: "03521101-67", name: "Sea and Life", terms: ["sea and life", "ทะเล", "ชีวิตกับทะเล"] },
  { code: "01132417-65", name: "Sustainability Management", terms: ["sustainability", "sustainability management", "ความยั่งยืน"] },
  { code: "01132333-65", name: "Business Information Systems", terms: ["bis", "business information systems", "database", "ระบบสารสนเทศ", "ฐานข้อมูล"] },
  { code: "03754221-67", name: "Basic English Pronunciation", terms: ["english pronunciation", "pronunciation", "อังกฤษ", "การออกเสียง"] },
  { code: "01132332-65", name: "Quantitative Analysis for Decision Making", terms: ["quantitative", "decision making", "quant", "วิเคราะห์เชิงปริมาณ"] },
  { code: "01362101-67", name: "Chinese I", terms: ["chinese", "จีน"] }
];

function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json"
  };
}

function assertSupabaseEnv() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
}

function isAuthorized(req) {
  if (!process.env.HERMES_APP_KEY) return false;
  return req.headers["x-hermes-key"] === process.env.HERMES_APP_KEY;
}

function requireAuthorized(req, res) {
  if (isAuthorized(req)) return true;
  json(res, 401, { error: "Unauthorized" });
  return false;
}

function normalizeState(state) {
  return {
    ...defaultState,
    ...state,
    settings: { ...defaultState.settings, ...(state?.settings || {}) },
    courses: Array.isArray(state?.courses) ? state.courses : defaultState.courses,
    classes: Array.isArray(state?.classes) ? state.classes : defaultState.classes,
    tasks: Array.isArray(state?.tasks) ? state.tasks : [],
    chat: Array.isArray(state?.chat) ? state.chat : defaultState.chat
  };
}

async function readState() {
  assertSupabaseEnv();
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/hermes_state?id=eq.default&select=state`, {
    headers: supabaseHeaders()
  });
  if (!response.ok) throw new Error(`Supabase read failed: ${response.status}`);
  const rows = await response.json();
  if (rows[0]?.state) return normalizeState(rows[0].state);
  await writeState(defaultState);
  return normalizeState(defaultState);
}

async function writeState(state) {
  assertSupabaseEnv();
  const nextState = normalizeState(state);
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/hermes_state`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(),
      prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify({
      id: "default",
      state: nextState,
      updated_at: new Date().toISOString()
    })
  });
  if (!response.ok) throw new Error(`Supabase write failed: ${response.status}`);
  return nextState;
}

function parseDateLoose(text) {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  if (/(วันนี้|today)/i.test(text)) return now;
  if (/(พรุ่งนี้|tomorrow)/i.test(text)) return addDays(now, 1);
  if (/(มะรืน|day after tomorrow)/i.test(text)) return addDays(now, 2);

  const dayMap = [
    ["จันทร์", 1], ["monday", 1],
    ["อังคาร", 2], ["tuesday", 2],
    ["พุธ", 3], ["wednesday", 3],
    ["พฤหัส", 4], ["thursday", 4],
    ["ศุกร์", 5], ["friday", 5],
    ["เสาร์", 6], ["saturday", 6],
    ["อาทิตย์", 0], ["sunday", 0]
  ];
  const lower = text.toLowerCase();
  for (const [label, day] of dayMap) {
    if (lower.includes(label)) {
      let diff = day - now.getDay();
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

function extractCourse(state, text) {
  const upper = text.toUpperCase();
  const kuCode = text.match(/\b\d{8}-\d{2}\b/);
  if (kuCode) return kuCode[0];
  const known = state.courses.find((course) => upper.includes(course.code) || upper.includes(course.name.toUpperCase()));
  if (known) return known.code;
  const alias = aliases.find((item) => item.terms.some((term) => text.toLowerCase().includes(term.toLowerCase())));
  if (alias) return alias.code;
  const courseCode = upper.match(/\b[A-Z]{2,4}\s?\d{2,4}\b/);
  if (courseCode) return courseCode[0].replace(/\s+/g, "");
  return "GEN000";
}

function ensureCourse(state, courseCode) {
  if (state.courses.some((course) => course.code === courseCode)) return;
  const alias = aliases.find((item) => item.code === courseCode);
  state.courses.push({
    id: `course-${Date.now()}`,
    code: courseCode,
    name: alias?.name || (courseCode === "GEN000" ? "General Academic Inbox" : courseCode),
    color: "dark"
  });
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

function inferPriority(dueDate, text, state) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const days = Math.ceil((due - today) / 86400000);
  if (/(ด่วน|urgent|ยังไม่ได้เริ่ม|not started|สอบ|exam|quiz)/i.test(text) || days <= 1) return "high";
  if (days <= Number(state.settings.riskWindow || 3)) return "medium";
  return "low";
}

function taskFromText(state, text, source = "dashboard") {
  const courseCode = extractCourse(state, text);
  ensureCourse(state, courseCode);
  const dueDate = parseDateLoose(text);
  const priority = inferPriority(dueDate, text, state);
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
    source,
    rawText: text
  };
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function methodNotAllowed(res) {
  json(res, 405, { error: "Method not allowed" });
}

module.exports = {
  defaultState,
  json,
  methodNotAllowed,
  normalizeState,
  requireAuthorized,
  readState,
  taskFromText,
  writeState
};
