# Claude Code 공개용 설정

Claude Code의 작업 지침과 설정을 공유하기 위해 준비 중인 저장소입니다.
핵심 지침·정책·훅·설치기를 준비하고 아래 범위를 로컬에서 검증했습니다. **라이선스와 GitHub 게시 승인이 남은 공개 전 검토본입니다.**

## 현재 포함된 파일

- [.gitattributes](.gitattributes)
- [.gitignore](.gitignore)
- [CLAUDE.md](CLAUDE.md)
- [deny-patterns.json](deny-patterns.json)
- [hooks/post_edit_build.js](hooks/post_edit_build.js)
- [hooks/validate-deny.js](hooks/validate-deny.js)
- [install-macos.sh](install-macos.sh)
- [mcp.json](mcp.json)
- `README.md`: 이 안내
- [rules/01-basic.md](rules/01-basic.md)
- [rules/02-execution.md](rules/02-execution.md)
- [rules/03-quality.md](rules/03-quality.md)
- [rules/04-safety.md](rules/04-safety.md)
- [rules/05-ai-delegation.md](rules/05-ai-delegation.md)
- [rules/06-rubric.md](rules/06-rubric.md)
- [scripts/test-deny-hook.cjs](scripts/test-deny-hook.cjs)
- [SECURITY.md](SECURITY.md)
- [settings.macos.json](settings.macos.json)
- [settings.windows.json](settings.windows.json)
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

## MCP 설정 예시

`mcp.json`의 `mcpServers`는 빈 객체입니다. Figma 등 외부 서버나 인증 정보를 포함하지 않으며 설치기가 이 파일을 복사하거나 MCP를 등록하지 않습니다.
필요한 서버는 해당 서버의 설치 안내를 확인하고 개인 설정에 별도로 등록합니다.

## 설치와 기존 설정 보존

설치 전 Node.js와 Bash를 준비하고 Claude Code를 설치·로그인합니다. C# 빌드 훅을 사용하면 .NET SDK도 필요합니다.
아래 명령은 이 저장소 루트에서 실행합니다. 기본 `~/.claude`에 핵심 파일만 복사하며, 스킬·개인 기록·MCP는 설치하지 않습니다.

```bash
bash install-macos.sh --dry-run
bash install-macos.sh
```

기존 `settings.json`은 보존합니다. 이 경우 새 훅이 자동 등록되지 않으므로 아래 출력과 비교해 필요한 항목만 병합합니다.

```bash
bash install-macos.sh --print-settings
```

`settings.windows.json`은 Windows용 참고 설정입니다. Windows 자동 설치기는 이번 배포 범위에 없습니다.
설정 예시의 훅 명령은 Node.js의 홈 경로 조회를 사용합니다. 실제 앱의 등록·호출 여부는 설치 후 따로 확인합니다.
설치기는 기본 홈만 지원하며 사용자 지정 `CLAUDE_CONFIG_DIR`, 링크 대상, 파일·폴더 충돌은 쓰기 전에 거부합니다.

## 포함하지 않는 자료

대화·세션 기록, 작업 계획, 사용자 메모리, 실제 프로젝트 자료, 인증 정보, 개인 PC 설정은 배포하지 않습니다.
기존 개인 백업 저장소의 Git 이력도 가져오지 않습니다.

스킬·프로젝트 템플릿은 핵심 설정과 분리해 검토합니다. 출처, 배포 조건, 필수 참조와 실행 의존성을 확인한 항목만 후속 공개 대상으로 삼습니다.

## 지원 환경과 검증 상태

2026-10-02 기준, Windows의 격리된 임시 환경에서 확인했습니다.

- `.gitignore` 62개 경로, Git 줄바꿈 속성 8건과 저장·체크아웃 변환
- 정책 15개에 대한 차단·허용·오류 입력 38건, OS별 설정 2개
- Codex 검사 도구와 함께 실제 C# 빌드·포맷 성공, 빌드 실패, 다중 프로젝트 모호성 및 콘텐츠 검사를 포함한 통합 15건
- Git Bash에서 설치·dry-run·기존 설정 보존·백업 복구·재설치 무변경·충돌 사전 차단
- 실제 설정의 훅 명령을 공백·한글·달러 기호가 있는 임시 홈에서 실행

저장소의 독립 훅 검사는 다음과 같습니다. 위험 명령은 문자열 입력으로만 전달하며 실행하지 않습니다.

```bash
node scripts/test-deny-hook.cjs
```

macOS 실기기, 실제 Claude 앱의 훅 호출, Unity Editor 빌드는 미검증입니다. Git Bash에서 실제 심볼릭 링크를 만들지 못해 해당 검사는 건너뛰었습니다.
C# 훅은 `dotnet build` 후 수정 파일의 `dotnet format --verify-no-changes --include`를 검사하며 자동 교정하지 않습니다. 수정 파일 포맷 통과를 프로젝트 전체 통과로 해석하지 않습니다.

## 업데이트와 복구

새 버전을 받은 뒤 dry-run 결과를 확인하고 같은 설치 명령을 다시 실행합니다. 내용이 같은 파일은 변경하지 않고 추가 백업도 만들지 않습니다.
변경되는 기존 파일만 `~/claude-dotfiles-backup.<식별자>/.claude/` 아래 원래 상대 경로로 백업합니다.
설치기에 없는 개인 파일은 유지하며, 소스에서 빠진 파일도 자동 삭제하지 않습니다.

복구할 때는 설치 출력의 실제 백업 경로를 확인하고 해당 파일만 되돌립니다. 복구 대상의 현재 내용도 필요하면 먼저 별도 보관합니다.

```bash
# 실제 백업 식별자로 바꾼 뒤 실행합니다.
backup_dir="$HOME/claude-dotfiles-backup.실제식별자"
cp -p "$backup_dir/.claude/CLAUDE.md" "$HOME/.claude/CLAUDE.md"
```

백업은 전체 홈 복제본이 아닙니다. 신규 설치로 추가된 파일까지 일괄 되돌리는 자동 제거 기능은 제공하지 않습니다.

## 두 공개 저장소의 관계

각각의 설치기와 기본 검사는 단독으로 사용할 수 있습니다. 공통 안전 정책의 원본·생성 도구와 양쪽 정합성 검사는 Codex 공개본에서 관리합니다.
Claude만 설치하는 사용자는 생성된 정책을 사용하며, 패턴을 변경하려면 Codex 공개본의 원본과 생성 도구를 함께 준비합니다.
`test-harness-parity.ps1`은 양쪽 설치의 정합성을 검사하는 도구이므로 두 하네스가 모두 있는 환경에서 사용합니다.
GitHub 저장소 이름과 상대 저장소 링크는 최종 게시 단계에서 확정합니다.

## 개인 설정 관리

실제 인증 정보와 개인 경로는 이 저장소 밖의 사용자 설정에 보관합니다.
환경 파일 예시를 추가할 때는 `.env.example`, `.env.sample`, `.env.template` 중 하나를 사용하고 실제 값을 넣지 않습니다.

`.gitignore`는 Git에 아직 추가하지 않은 파일의 기본 제외 규칙입니다. 이미 추적한 파일이나 과거 커밋의 정보를 제거하지 않으며,
허용된 파일 안에 들어간 민감정보를 탐지하지도 않습니다. 배포 전에 파일 내용과 Git 이력을 별도로 확인합니다.

## 라이선스와 외부 구성요소

라이선스는 최종 검토 때 결정하기로 했으며 아직 LICENSE 파일을 두지 않았습니다. 라이선스 확정 전에는 공개 릴리스를 게시하지 않습니다.
포함·제외한 외부 구성은 [외부 구성요소 안내](THIRD_PARTY_NOTICES.md), 보호 범위와 제보 채널 준비 상태는 [보안 안내](SECURITY.md)를 참고합니다.
