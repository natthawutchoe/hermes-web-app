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
  pendingClarifications: {},
  learnedAliases: {},
  chat: [
    { role: "hermes", text: "Inbox พร้อมแล้ว ส่งงานหรือ deadline จาก Discord/Inbox มาได้เลย เดี๋ยวผมแยกเข้าวิชาและ Dashboard ให้" }
  ]
};

const aliases = [
  { code: "01132326-65", name: "Organization Development", short: "Org", terms: ["organization development", "org dev", "org", "องค์การ", "พัฒนาองค์การ"] },
  { code: "03521101-67", name: "Sea and Life", short: "Sea", terms: ["sea and life", "sea", "ทะเล", "ชีวิตกับทะเล"] },
  { code: "01132417-65", name: "Sustainability Management", short: "Sustain", terms: ["sustainability", "sustainability management", "sustain", "ความยั่งยืน"] },
  { code: "01132333-65", name: "Business Information Systems", short: "BIS", terms: ["bis", "business information systems", "database", "ระบบ", "ระบบสารสนเทศ", "ฐานข้อมูล"] },
  { code: "03754221-67", name: "Basic English Pronunciation", short: "English", terms: ["english pronunciation", "pronunciation", "english", "eng", "อิ้ง", "อังกฤษ", "การออกเสียง"] },
  { code: "01132332-65", name: "Quantitative Analysis for Decision Making", short: "QA", terms: ["qa", "qadm", "quantitative", "decision making", "quant", "คิวเอ", "วิเคราะห์", "วิเคราะห์เชิงปริมาณ", "วิเคราะห์ปริมาณ"] },
  { code: "01362101-67", name: "Chinese I", short: "Chinese", terms: ["chinese", "จีน", "ภาษาจีน"] }
];

const datePattern = /(วันนี้|พรุ่งนี้|มะรืน|today|tomorrow|day after tomorrow|จันทร์|อังคาร|พุธ|พฤหัส|ศุกร์|เสาร์|อาทิตย์|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b|\b\d{1,2}[/-]\d{1,2}\b)/i;
const fillerPattern = /(วิชา|class|course|มี|ส่ง|due|deadline|ต้อง|ทำ|ยังไม่ได้เริ่ม|not started|วันนี้|พรุ่งนี้|มะรืน|นี้|จันทร์|อังคาร|พุธ|พฤหัส|ศุกร์|เสาร์|อาทิตย์|today|tomorrow)/gi;

function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json"
  };
}

function supabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function assertSupabaseEnv() {
  if (!supabaseUrl()) {
    throw new Error("Missing SUPABASE_URL. Set SUPABASE_URL in Vercel Environment Variables.");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY. Set the Supabase service_role key in Vercel Environment Variables.");
  }
}

function isAuthorized(req) {
  const requestKey = req.headers["x-hermes-key"];
  const allowedKeys = [
    process.env.HERMES_APP_KEY,
    process.env.HERMES_DASHBOARD_KEY
  ].filter(Boolean);
  if (!requestKey || !allowedKeys.length) return false;
  return allowedKeys.includes(requestKey);
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
    pendingClarifications: state?.pendingClarifications && typeof state.pendingClarifications === "object" ? state.pendingClarifications : {},
    learnedAliases: state?.learnedAliases && typeof state.learnedAliases === "object" ? state.learnedAliases : {},
    chat: Array.isArray(state?.chat) ? state.chat : defaultState.chat
  };
}

async function readState() {
  assertSupabaseEnv();
  const response = await fetch(`${supabaseUrl()}/rest/v1/hermes_state?id=eq.default&select=state`, {
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
  const response = await fetch(`${supabaseUrl()}/rest/v1/hermes_state`, {
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

function hasExplicitDate(text) {
  return datePattern.test(text);
}

function extractCourse(state, text) {
  const upper = text.toUpperCase();
  const kuCode = text.match(/\b\d{8}-\d{2}\b/);
  if (kuCode) return kuCode[0];
  const known = state.courses.find((course) => upper.includes(course.code) || upper.includes(course.name.toUpperCase()));
  if (known) return known.code;
  const learned = Object.entries(state.learnedAliases || {}).find(([term]) => termMatches(text, term));
  if (learned) return learned[1];
  const alias = aliases.find((item) => item.terms.some((term) => termMatches(text, term)));
  if (alias) return alias.code;
  const courseCode = upper.match(/\b[A-Z]{2,4}\s?\d{2,4}\b/);
  if (courseCode) return courseCode[0].replace(/\s+/g, "");
  return "GEN000";
}

function termMatches(text, term) {
  const lower = text.toLowerCase();
  const needle = String(term || "").toLowerCase();
  if (!needle) return false;
  if (/^[a-z0-9]{1,4}$/.test(needle)) {
    return new RegExp(`(^|[^a-z0-9])${needle}([^a-z0-9]|$)`).test(lower);
  }
  return lower.includes(needle);
}

function ensureCourse(state, courseCode) {
  if (courseCode === "GEN000") return;
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
  const alias = aliases.find((item) => item.code === courseCode);
  let cleaned = text.replace(courseCode, "");
  if (alias) {
    for (const term of alias.terms) {
      cleaned = cleaned.replace(new RegExp(escapeRegExp(term), "gi"), " ");
    }
  }
  cleaned = cleaned
    .replace(/(?:วิชา|class|course)\s*[^\s,，:：]+(?:\s+[^\s,，:：]+)?/gi, " ")
    .replace(fillerPattern, " ")
    .replace(/\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/g, " ")
    .replace(/\b\d{1,2}[/-]\d{1,2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Review and organize course task";
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function taskFromText(state, text, source = "dashboard", options = {}) {
  const courseCode = options.courseCode || extractCourse(state, text);
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

function analyzeTaskText(state, text, source = "dashboard", options = {}) {
  const task = taskFromText(state, text, source, options);
  const missing = [];
  let confidence = 0.35;

  if (task.courseCode === "GEN000") missing.push("course");
  else confidence += 0.3;

  if (!hasExplicitDate(text)) missing.push("due");
  else confidence += 0.2;

  if (!task.title || task.title === "Review and organize course task" || task.title.length < 3) missing.push("title");
  else confidence += 0.15;

  return { task, confidence: Math.min(1, Number(confidence.toFixed(2))), missing };
}

function pendingKey(source, userId) {
  return `${source}:${userId || "unknown"}`;
}

function courseChoices(state) {
  return state.courses
    .filter((course) => course.code !== "GEN000")
    .map((course) => {
      const alias = aliases.find((item) => item.code === course.code);
      return alias?.short || course.code;
    })
    .join(" / ");
}

function shortQuestionFor(missing, state) {
  if (missing.includes("course")) return `งานนี้เป็นวิชาไหน? ตอบ ${courseChoices(state)}`;
  if (missing.includes("due")) return "งานนี้ส่งวันไหน? ตอบ วันนี้ / พรุ่งนี้ / ศุกร์นี้ / หรือวันที่แบบ 15/8";
  return "ขอรายละเอียดงานเพิ่มอีกนิด เช่น ชื่องานหรือสิ่งที่ต้องส่ง";
}

function answerLooksLikeCourse(state, text) {
  const code = extractCourse(state, text);
  return code === "GEN000" ? "" : code;
}

function learnAliasFromClarification(state, originalText, courseCode) {
  const text = originalText.toLowerCase().trim();
  const actionIndex = text.search(/ส่ง|ทำ|อ่าน|สอบ|quiz|exam|due|deadline/);
  if (actionIndex <= 0 || actionIndex > 24) return;

  const candidate = text
    .slice(0, actionIndex)
    .replace(/^(วิชา|class|course)\s+/i, "")
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (candidate.length >= 2 && candidate.length <= 16 && extractCourse({ ...state, learnedAliases: {} }, candidate) === "GEN000") {
    state.learnedAliases[candidate] = courseCode;
  }
}

function processBrainDump(state, text, source = "dashboard", userId = "unknown") {
  const key = pendingKey(source, userId);
  const pending = state.pendingClarifications?.[key];

  if (pending) {
    const courseCode = pending.missing.includes("course") ? answerLooksLikeCourse(state, text) : pending.draftTask.courseCode;
    const extraText = pending.missing.includes("course") && courseCode ? "" : ` ${text}`;
    if (pending.missing.includes("course") && !courseCode) {
      return {
        ok: false,
        needsClarification: true,
        question: shortQuestionFor(["course"], state),
        missing: ["course"]
      };
    }

    const mergedText = `${pending.originalText}${extraText}`.trim();
    const analysis = analyzeTaskText(state, mergedText, source, { courseCode });
    delete state.pendingClarifications[key];
    learnAliasFromClarification(state, pending.originalText, analysis.task.courseCode);
    state.tasks.push(analysis.task);
    state.chat.push({ role: "user", text });
    state.chat.push({ role: "hermes", text: `เพิ่มแล้ว: ${analysis.task.courseCode} - ${analysis.task.title} (${analysis.task.due})` });
    return { ok: true, task: analysis.task, confidence: analysis.confidence, learned: true };
  }

  const analysis = analyzeTaskText(state, text, source);
  if (analysis.confidence < 0.65 || analysis.missing.includes("course")) {
    const question = shortQuestionFor(analysis.missing, state);
    state.pendingClarifications[key] = {
      originalText: text,
      missing: analysis.missing,
      draftTask: analysis.task,
      createdAt: new Date().toISOString()
    };
    state.chat.push({ role: "user", text });
    state.chat.push({ role: "hermes", text: question });
    return {
      ok: false,
      needsClarification: true,
      question,
      missing: analysis.missing,
      confidence: analysis.confidence
    };
  }

  state.tasks.push(analysis.task);
  state.chat.push({ role: "user", text });
  state.chat.push({ role: "hermes", text: `เพิ่มแล้ว: ${analysis.task.courseCode} - ${analysis.task.title} (${analysis.task.due})` });
  return { ok: true, task: analysis.task, confidence: analysis.confidence };
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
  processBrainDump,
  requireAuthorized,
  readState,
  taskFromText,
  writeState
};
