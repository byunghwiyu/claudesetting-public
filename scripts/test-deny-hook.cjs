// 사용자 홈을 참조하지 않고 저장소 정책과 실제 훅을 함께 검증한다.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const hook = path.join(root, 'hooks/validate-deny.js');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'deny-patterns.json'), 'utf8'));
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-deny-test-'));
const policyPath = path.join(fixture, '.claude/deny-patterns.json');
fs.mkdirSync(path.dirname(policyPath));
fs.writeFileSync(policyPath, JSON.stringify(policy));
let count = 0;

// 아래 문자열은 도구 입력 데이터이며 셸에서 실행하지 않는다.
const examples = [
  ['git-force-push', 'git push --force origin main'],
  ['git-reset-hard', 'git reset --hard HEAD'],
  ['rm-rf', 'rm -rf example'],
  ['drop-table-cmd', 'DROP TABLE example;'],
  ['drop-table-code', 'DROP TABLE example;'],
  ['process-env-prod-in-tests', 'process.env.PROD'],
  ['unity-critical-dir-rm', 'rm Assets/example'],
  ['api-key-leak', 'sk-' + 'TEST'.repeat(8)],
  ['sudo', 'sudo example'],
  ['package-publish', 'npm publish'],
  ['gh-release-create', 'gh release create example'],
  ['drop-db-cmd', 'DROP DATABASE example;'],
  ['drop-db-code', 'DROP DATABASE example;'],
  ['powershell-recursive-force-delete', 'Remove-Item -LiteralPath C:/example -Recurse -Force'],
  ['protected-path-write', 'Set-Content Assets/example.txt value'],
];

function check(input, status, id) {
  const result = spawnSync(process.execPath, [hook], {
    env: { ...process.env, HOME: fixture, USERPROFILE: fixture },
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8', timeout: 10000, windowsHide: true,
  });
  assert.ifError(result.error);
  assert.equal(result.status, status, `예상 종료 코드 불일치: ${id || '정상/오류 입력'}`);
  if (id) assert.ok(result.stderr.includes(`[Deny:${id}]`), `차단 규칙 불일치: ${id}`);
  count++;
}

try {
  assert.deepEqual(policy.patterns.map(p => p.id).sort(), examples.map(p => p[0]).sort());
  for (const [id, content] of examples) {
    const pattern = policy.patterns.find(p => p.id === id);
    for (const tool of pattern.tools) {
      const filePath = id === 'process-env-prod-in-tests' ? 'tests/example.test.js' : 'migrations/example.sql';
      const input = ['Bash', 'PowerShell'].includes(tool)
        ? { command: content }
        : { file_path: filePath, [tool === 'Edit' ? 'new_string' : 'content']: content };
      check({ tool_name: tool, tool_input: input }, 2, id);
    }
  }
  for (const tool of ['Bash', 'PowerShell', 'Write', 'Edit']) {
    check({ tool_name: tool, tool_input: { command: 'git status', file_path: 'example.txt', content: 'hello' } }, 0);
  }
  check('{broken', 2);
  fs.writeFileSync(policyPath, '{broken');
  check({ tool_name: 'Bash', tool_input: { command: 'git status' } }, 2);
  for (const name of ['settings.macos.json', 'settings.windows.json']) {
    const settings = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
    const entry = settings.hooks.PreToolUse.find(e => e.hooks.some(h => h.command.includes('validate-deny.js')));
    assert.ok(entry, `${name}: 안전 훅 없음`);
    for (const tool of ['Bash', 'PowerShell', 'Write', 'Edit']) {
      assert.ok(new RegExp(`^(?:${entry.matcher})$`).test(tool), `${name}: ${tool} 연결 누락`);
    }
  }
  console.log(`PASS: 격리 홈 안전 훅 ${count}건, 정책 15개, OS 설정 2개`);
} finally {
  // 이 검사에서 생성한 고정 접두사의 임시 폴더만 정리한다.
  assert.equal(path.dirname(fixture), path.resolve(os.tmpdir()));
  assert.ok(path.basename(fixture).startsWith('claude-deny-test-'));
  fs.rmSync(fixture, { recursive: true, force: true });
}
