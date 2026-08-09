const { json, methodNotAllowed, normalizeState, readState, requireAuthorized, writeState } = require("./_hermes");

module.exports = async function handler(req, res) {
  try {
    if (!requireAuthorized(req, res)) return;

    if (req.method === "GET") {
      json(res, 200, await readState());
      return;
    }

    if (req.method === "POST") {
      json(res, 200, { ok: true, state: await writeState(normalizeState(req.body || {})) });
      return;
    }

    methodNotAllowed(res);
  } catch (error) {
    json(res, 500, { error: error.message });
  }
};
