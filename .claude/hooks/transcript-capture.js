const fs = require('fs');
const path = require('path');

// Stop hook: captures first 500 chars of assistant response to daily transcript file
const input = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));

if (input.stop_reason === 'end_turn' && input.response) {
  const today = new Date().toISOString().slice(0, 10);
  const dir = path.join(process.env.CLAUDE_PROJECT_DIR || '.', 'context', 'transcripts');
  const file = path.join(dir, `${today}.md`);

  try {
    fs.mkdirSync(dir, { recursive: true });
    const summary = input.response.slice(0, 500).replace(/\n{3,}/g, '\n\n');
    const timestamp = new Date().toISOString().slice(11, 19);
    const entry = `\n## ${timestamp}\n${summary}\n`;
    fs.appendFileSync(file, entry);
  } catch (e) {
    // Fire and forget — don't break the session
  }
}
