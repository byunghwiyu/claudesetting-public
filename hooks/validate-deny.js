/**
 * PreToolUse Hook — 글로벌 Deny Pattern 검사
 * deny-patterns.json 로드 후 tool_name + input 매칭
 * 매칭 시 stderr에 [Deny] reason 출력하고 exit 2 (시스템 차단)
 */
const fs = require("fs");
const path = require("path");

const PATTERNS_FILE = path.join(
  process.env.USERPROFILE || process.env.HOME,
  ".claude",
  "deny-patterns.json"
);

let input;
try {
  const rawInput = fs.readFileSync(0, "utf-8").replace(/^\uFEFF/, "");
  input = JSON.parse(rawInput);
} catch (error) {
  console.error(`[Deny] 입력 JSON 파싱 실패 — 안전을 위해 도구 실행을 차단합니다: ${error.message}`);
  process.exit(2);
}

const toolName = input?.tool_name;
const ti = input?.tool_input ?? {};
const command = ti.command ?? "";
// 경로 검사에서 Windows 구분자도 정책의 슬래시와 동일하게 취급한다.
const filePath = (ti.file_path ?? "").replace(/\\/g, "/");
const content = ti.content ?? ti.new_string ?? "";

let patterns;
try {
  patterns = JSON.parse(fs.readFileSync(PATTERNS_FILE, "utf-8")).patterns;
  if (!Array.isArray(patterns) || patterns.length === 0) throw new Error("patterns 배열이 없거나 비어 있습니다.");
  // 필수 필드와 정규식을 미리 검증·컴파일해 잘못된 정책이 조용히 통과하지 않게 한다.
  patterns = patterns.map((p, index) => {
    const label = typeof p?.id === "string" ? p.id : `#${index}`;
    if (typeof p?.id !== "string" || !Array.isArray(p.tools) || p.tools.length === 0) {
      throw new Error(`필수 필드(id, tools) 누락: ${label}`);
    }
    if (!p.command_regex && !p.content_regex) throw new Error(`검사 정규식 없음: ${label}`);
    const compile = (source) => (source ? new RegExp(source, p.flags || "") : null);
    try {
      return { ...p, pathRe: compile(p.path_regex), commandRe: compile(p.command_regex), contentRe: compile(p.content_regex) };
    } catch (error) {
      throw new Error(`정규식 오류: ${label} — ${error.message}`);
    }
  });
} catch (error) {
  console.error(`[Deny] 정책 로드 실패 — 안전을 위해 도구 실행을 차단합니다: ${error.message}`);
  process.exit(2);
}

for (const p of patterns) {
  if (!p.tools.includes(toolName)) continue;

  if (p.pathRe && !p.pathRe.test(filePath)) continue;

  let matched = false;
  if (p.commandRe && command) {
    if (p.commandRe.test(command)) matched = true;
  }
  if (!matched && p.contentRe) {
    // 셸 도구(Bash/PowerShell)는 tool_input에 content가 없고 command만 있다.
    // 이전 구현은 PowerShell일 때 빈 content를 검사해 content_regex 전용 패턴이 무력화됐다.
    const haystack = [command, content].filter(Boolean).join("\n");
    if (haystack && p.contentRe.test(haystack)) matched = true;
  }

  if (matched) {
    console.error(`[Deny:${p.id}] ${p.reason}`);
    console.error(`  → 정책 차단 사유를 확인하세요. 대화상 승인으로 우회하지 않습니다.`);
    process.exit(2);
  }
}

process.exit(0);
