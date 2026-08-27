# 003

논문 작성용 Claude Code 스킬 레지스트리.

이 저장소를 열고 Claude Code를 실행하면 `.claude/skills/`에 들어 있는
`paper-writing`, `claude-latex-paper-skill`, `latex` 세 스킬이 바로 잡힌다.
문헌조사·모의 피어리뷰 같은 나머지 스킬은 필요할 때 받는다.

```bash
./scripts/install-skills.sh --list   # 등록된 스킬 전부 보기
./scripts/install-skills.sh          # 외부 스킬 설치
```

각 스킬이 무엇을 하고 어떤 걸 언제 쓰는지는 [`registry/README.md`](registry/README.md),
기계가 읽는 목록은 [`registry/skills.json`](registry/skills.json)에 있다.

## 구성

| 경로 | 내용 |
|---|---|
| `.claude/skills/` | 포함된 스킬 (MIT). 각 디렉터리의 `UPSTREAM.md`에 출처와 고정 커밋 |
| `registry/` | 스킬 카탈로그와 매니페스트 |
| `scripts/install-skills.sh` | 외부 스킬 설치·갱신·제거 |
| `vendor/` | 외부 스킬 클론 위치 (gitignore) |

포함된 스킬은 원본 `LICENSE`를 그대로 두고 복사했다. 외부 스킬은 이 저장소가
재배포하지 않고 설치 시점에 업스트림에서 직접 받는다.
