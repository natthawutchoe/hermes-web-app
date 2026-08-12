const { json, methodNotAllowed, processBrainDump, readState, requireAuthorized, writeState } = require("./_hermes");

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
    const userId = String(req.body?.userId || req.body?.user_id || "unknown");
    const state = await readState();
    const result = processBrainDump(state, text, source, userId);
    const saved = await writeState(state);
    json(res, 200, { ...result, state: saved });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
};
