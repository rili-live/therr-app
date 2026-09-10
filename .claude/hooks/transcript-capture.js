const fs = require('fs');
const path = require('path');

// Stop hook: appends the first 500 chars of the latest assistant response to a
// daily transcript file (context/transcripts/{YYYY-MM-DD}.md).
//
// The Stop hook stdin payload is { session_id, transcript_path, cwd,
// hook_event_name, ... } — it does NOT contain the response text. We read the
// response from the JSONL transcript at `transcript_path`: each line is a
// message envelope { type, message, uuid, ... } where `message` is the
// Anthropic API message. The final text response of a turn is the last
// assistant message whose `message.stop_reason === 'end_turn'`; its text lives
// in `message.content[]` blocks of type "text".

try {
  const input = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
  const transcriptPath = input.transcript_path;
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    process.exit(0);
  }

  const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
  let last = null;
  for (const ln of lines) {
    if (!ln.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(ln);
    } catch (e) {
      continue;
    }
    const msg = obj.message;
    if (obj.type === 'assistant' && msg && msg.stop_reason === 'end_turn') {
      last = obj;
    }
  }

  if (!last) {
    process.exit(0);
  }

  const text = (last.message.content || [])
    .filter((b) => b && b.type === 'text' && b.text)
    .map((b) => b.text)
    .join('\n')
    .trim();
  if (!text) {
    process.exit(0);
  }

  const dir = path.join(process.env.CLAUDE_PROJECT_DIR || input.cwd || '.', 'context', 'transcripts');
  fs.mkdirSync(dir, { recursive: true });

  // Dedupe: skip if we already captured this assistant message (Stop can fire
  // again without a new end_turn). Track the last-seen message uuid per session.
  const stateFile = path.join(dir, '.last-captured.json');
  const msgId = last.uuid || (last.message && last.message.id) || '';
  let state = {};
  try {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch (e) {
    state = {};
  }
  const sessionKey = input.session_id || 'default';
  if (msgId && state[sessionKey] === msgId) {
    process.exit(0);
  }

  const today = new Date().toISOString().slice(0, 10);
  const file = path.join(dir, `${today}.md`);
  const summary = text.slice(0, 500).replace(/\n{3,}/g, '\n\n');
  const timestamp = new Date().toISOString().slice(11, 19);
  const entry = `\n## ${timestamp}\n${summary}\n`;
  fs.appendFileSync(file, entry);

  if (msgId) {
    state[sessionKey] = msgId;
    fs.writeFileSync(stateFile, JSON.stringify(state));
  }
} catch (e) {
  // Fire and forget — never break the session.
  process.exit(0);
}
