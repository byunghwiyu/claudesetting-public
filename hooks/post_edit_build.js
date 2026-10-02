/**
 * PostToolUse Hook — .cs 파일 수정 시 빌드 + 포맷 검증 (범용)
 * 수정된 파일 경로에서 위로 탐색해 가장 가까운 .csproj를 자동으로 찾음
 * .cs가 아닌 파일(md, csv, json 등)은 즉시 종료
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// 파일로부터 위로 탐색해 가장 가까운 .csproj 위치 반환
function selectCsproj(dir, files) {
  if (files.length === 1) return files[0];

  const directoryProject = `${path.basename(dir)}.csproj`;
  if (files.includes(directoryProject)) return directoryProject;
  if (files.includes("Assembly-CSharp.csproj")) return "Assembly-CSharp.csproj";

  const error = new Error(`여러 프로젝트 중 대상을 결정할 수 없음: ${files.join(", ")}`);
  error.code = "AMBIGUOUS_CSPROJ";
  throw error;
}

function findCsproj(startDir) {
  let dir = startDir;
  while (true) {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".csproj") && !f.includes("Editor"))
      .sort();
    if (files.length > 0) return { dir, csproj: selectCsproj(dir, files) };
    const parent = path.dirname(dir);
    if (parent === dir) return null; // 루트까지 탐색 실패
    dir = parent;
  }
}

let data;
try {
  // Windows 네이티브 Node에서도 동작하도록 표준 입력 파일 디스크립터를 직접 읽는다.
  const raw = fs.readFileSync(0, "utf-8").replace(/^\uFEFF/, "");
  data = JSON.parse(raw);
} catch (error) {
  console.error(`[Hook] 입력 JSON 파싱 실패: ${error.message}`);
  process.exit(1);
}

const inputPath = data?.tool_input?.file_path ?? "";

// .cs 파일이 아니면 건너뜀
if (typeof inputPath !== "string" || !inputPath.toLowerCase().endsWith(".cs")) {
  process.exit(0);
}
const filePath = path.resolve(data.cwd || process.cwd(), inputPath);

// 수정 파일 기준으로 .csproj 탐색
const startDir = path.dirname(filePath);
let found;
try {
  found = findCsproj(startDir);
} catch (error) {
  if (error.code === "AMBIGUOUS_CSPROJ") {
    console.error(`[Hook] 프로젝트 탐색 실패: ${error.message}`);
    process.exit(1);
  }
  console.log(`[Hook] 프로젝트 탐색 실패로 빌드 건너뜀: ${error.message}`);
  process.exit(0);
}
if (!found) {
  console.log("[Hook] .csproj를 찾을 수 없어 빌드 건너뜀");
  process.exit(0);
}

const { dir: projectDir, csproj } = found;
console.log(`[Hook] .cs 수정 감지: ${path.basename(filePath)}`);
console.log(`[Hook] 프로젝트: ${path.join(projectDir, csproj)}`);
console.log("[Hook] dotnet build 실행 중...");

// 1. 빌드 검증
try {
  execFileSync("dotnet", ["build", csproj, "-nologo", "-v", "quiet"], {
    cwd: projectDir,
    stdio: "pipe",
    windowsHide: true,
    timeout: 300000,
  });
  console.log("[Hook] ✅ 빌드 통과");
} catch (e) {
  console.error(`[Hook] 빌드 ${e.code === "ENOENT" ? "미실행: dotnet을 찾을 수 없음" : "실패"}`);
  console.error((e.stdout?.toString() || "") + (e.stderr?.toString() || "") || e.message);
  process.exit(1);
}

// 2. 수정 파일만 검증한다. 포맷 오류와 도구 오류 모두 자동 수정하지 않는다.
console.log(`[Hook] 포맷 검사 대상: ${filePath}`);
try {
  execFileSync("dotnet", ["format", csproj, "--verify-no-changes", "--include", path.relative(projectDir, filePath), "-v", "quiet"], {
    cwd: projectDir,
    stdio: "pipe",
    windowsHide: true,
    timeout: 300000,
  });
  console.log("[Hook] ✅ 포맷 통과");
} catch (error) {
  console.error("[Hook] 포맷 검사 실패 — 자동 교정하지 않았습니다. 위반 또는 도구 오류를 확인하세요.");
  console.error((error.stdout?.toString() || "") + (error.stderr?.toString() || "") || error.message);
  process.exit(1);
}
