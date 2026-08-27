# 논문 작성 스킬 레지스트리

Claude Code에서 논문을 쓸 때 쓰는 서드파티 스킬 모음. 세 개는 저장소에 포함되어
클론 즉시 동작하고, 나머지 셋은 라이선스나 저장소 구조 때문에 `scripts/install-skills.sh`로
필요할 때 내려받는다. 기계가 읽는 목록은 [`skills.json`](skills.json)에 있다.

## 포함된 스킬 (committed, 바로 사용 가능)

MIT 라이선스이고 디렉터리 하나로 자립하는 것들만 넣었다. 각 디렉터리의
`UPSTREAM.md`에 원본 저장소와 고정한 커밋이 적혀 있다.

| 스킬 | 출처 | 하는 일 |
|---|---|---|
| [`paper-writing`](../.claude/skills/paper-writing) | [SNL-UCSB/paper-writing-skill](https://github.com/SNL-UCSB/paper-writing-skill) `676f852` | Brainstorm → Draft 0 → Evaluate → Write → Compress 파이프라인. 기계적 게이트 18개 + 의미론적 게이트 31개로 매 편집을 검사하고, 저자와 분리된 red-team 검토를 돌린다. UCSB 시스템/네트워킹 연구실이 논문 6편·Overleaf 편집 7,600건·피어리뷰 5사이클을 역분석해 만든 규칙. |
| [`claude-latex-paper-skill`](../.claude/skills/claude-latex-paper-skill) | [witold-andelie/claude-latex-paper-skill](https://github.com/witold-andelie/claude-latex-paper-skill) `88e82d6` | 모든 주장을 근거 아티팩트에 묶는 claim ledger, 기억에 의존하지 않는 인용 검증, AI 티 나는 문장 제거, 편집 후 자동 검증 루프. |
| [`latex`](../.claude/skills/latex) | [hameefy/claude-latex-skill](https://github.com/hameefy/claude-latex-skill) `c594f5a` | 정리·증명·수렴해석·알고리즘·TikZ·Beamer용 컴파일 가능한 LaTeX. document / snippet / beamer 세 모드. |

`.claude/skills/` 아래에 있으므로 이 저장소에서 Claude Code를 열면 별도 설정 없이 잡힌다.

## 외부 스킬 (on-demand)

```bash
./scripts/install-skills.sh --list     # 목록 확인
./scripts/install-skills.sh            # 전부 설치
./scripts/install-skills.sh flonat     # id 부분 일치로 골라 설치
./scripts/install-skills.sh --sync     # 이미 받은 것 갱신
./scripts/install-skills.sh --remove   # 클론과 심볼릭 링크 제거
```

`vendor/`에 클론하고 `.claude/skills/`로 심볼릭 링크를 건다. 둘 다 gitignore 대상이라
이 저장소가 서드파티 코드를 재배포하지 않는다. 설치 후에는 Claude Code를 재시작해야
스킬을 다시 스캔한다.

### [imbad0202/academic-research-skills](https://github.com/imbad0202/academic-research-skills) — CC BY-NC 4.0

문헌조사부터 리뷰 대응까지 전 과정을 덮는 4종 스위트.

- **deep-research** — 13개 에이전트, PRISMA 체계적 문헌고찰·팩트체크 등 8개 모드
- **academic-paper** — 12개 에이전트 작성 파이프라인, Markdown/DOCX/LaTeX 출력, APA 7 인용
- **academic-paper-reviewer** — 7개 에이전트 모의 피어리뷰 (저널 적합성 + 리뷰어 3인 + 반박자)
- **academic-pipeline** — 연구 → 작성 → 검토 → 개정 → 완성 10단계 오케스트레이터

포함하지 않은 이유는 두 가지다. 스킬 디렉터리가 `../shared`, `../agents`, `../scripts`를
참조해서 저장소 전체 트리가 있어야 동작하고, 라이선스가 **비상업(NC)** 조건이다.
상업적 용도라면 쓰면 안 된다.

### [flonat/flonat-research](https://github.com/flonat/flonat-research) — MIT

PhD 연구자용 인프라 저장소. 논문 관련 스킬만 골라 링크한다 — `latex`(동봉된 `latex`와
이름이 겹쳐서 `latex-flonat`으로 링크), `camera-ready`, `bib-parse`, `math-proof`,
`replication-audit`, `experiment-design`. 저장소 자체가 23 MB에 자체 `CLAUDE.md`·hooks·rules를
들고 있어서 통째로 넣지 않았다.

### [ndpvt-web/latex-document-skill](https://github.com/ndpvt-web/latex-document-skill) — 라이선스 없음

템플릿 27개, 스크립트 27개, 레퍼런스 가이드 26개짜리 범용 LaTeX 문서 스킬. 논문 외에
보고서·레터·CV·포스터까지 덮는 폭이 장점이다.

`latex-document-skill`로 링크된다.

업스트림에 LICENSE 파일이 없다. 라이선스 없는 저장소는 기본적으로 저작권이 유보되므로
재배포할 수 없어서 포함하지 않았다. 설치 스크립트가 직접 클론해 주지만, 쓰기 전에
업스트림에 라이선스를 문의하는 편이 안전하다.

### 이름 충돌

Claude Code는 디렉터리가 아니라 `SKILL.md` frontmatter의 `name:`으로 스킬을 식별한다.
`flonat-research`의 `latex`는 동봉된 `latex`와 이름이 겹치므로, 설치 스크립트가 심볼릭
링크 대신 복사한 뒤 frontmatter의 `name:`을 `latex-flonat`으로 고쳐 넣는다. 새 스킬을
등록할 때 이름이 겹치면 같은 방식으로 dest 이름만 바꿔 주면 된다.

## 스킬 고르기

- 본문 문장과 구조를 다잡고 싶다 → `paper-writing`
- LaTeX 투고 원고 마무리, 인용 무결성 → `claude-latex-paper-skill`
- 수식·정리·증명이 많은 원고, 발표 슬라이드 → `latex`
- 문헌조사부터 리뷰 대응까지 한 번에 → `academic-research-skills` (비상업 한정)
- 연구실/학위논문 저장소에 상시 인프라를 깔고 싶다 → `flonat-research`

가장 흔한 조합은 `paper-writing`으로 쓰고 `claude-latex-paper-skill`로 마감하는 것이다.

## 레지스트리 갱신

새 스킬은 `skills.json`에 항목을 추가한다. 포함(vendored)은 MIT 같은 허용적 라이선스이고
디렉터리 하나로 자립할 때만 하고, 그 외에는 외부(external)로 등록한 뒤
`scripts/install-skills.sh`의 `EXTERNAL` 배열에 `id|repo|ref|license|dest:srcpath ...`
형식으로 한 줄 넣는다. 포함할 때는 업스트림 `LICENSE`를 반드시 같이 복사하고
`UPSTREAM.md`에 출처와 커밋을 남긴다.
