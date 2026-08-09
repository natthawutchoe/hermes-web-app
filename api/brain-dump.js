const { json, methodNotAllowed, readState, requireAuthorized, taskFromText, writeState } = require("./_hermes");

module.exports = async function handler(req, res) {
  try {
    if (!requireAuthorized(req, res)) return;

    if (req.method !== "POST") {
      methodNotAllowed(res);
      return;
    }

    const text = String(req.body?.text || "").trim();
    if (!text) {
      json(res, 400, { error: "Missing text" });
      return;
    }

    const source = String(req.body?.source || "dashboard");
    const state = await readState();
    const task = taskFromText(state, text, source);
    state.tasks.push(task);
    state.chat.push({ role: "user", text });
    state.chat.push({
      role: "hermes",
      text: `ผมจับจาก ${source} ได้ว่าเป็น ${task.courseCode}: ${task.title} ส่ง ${task.due} และเพิ่มเข้า Dashboard แล้ว`
    });

    const saved = await writeState(state);
    json(res, 200, { ok: true, task, state: saved });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
};
