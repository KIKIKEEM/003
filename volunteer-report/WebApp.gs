/**
 * 웹 대시보드 (Apps Script 웹앱) — Code.gs와 같은 프로젝트에 넣습니다.
 * ------------------------------------------------------------
 * 배포 후 URL 하나로 "지금 실적"을 누구에게나(배포 설정 범위 내) HTML로 보여줍니다.
 *
 *   …/exec                       이번 달
 *   …/exec?period=last_month     지난 달
 *   …/exec?period=this_year      올해 누계
 *   …/exec?period=last_year      작년
 *   …/exec?period=all            전체 누계
 *   …/exec?from=2026-07-01&to=2026-09-30   임의 기간
 *   …/exec?format=json           위 조건 그대로 JSON
 *
 * 배포 방법 A (권장: 서명 입력 폼과 분리된 별도 URL)
 *   script.google.com → 새 프로젝트 → Code.gs + WebApp.gs 붙여넣기 → CFG.SPREADSHEET_ID 확인
 *   → 배포 → 새 배포 → 웹 앱 → "다음 사용자로 실행: 나", "액세스 권한: 조직 내 모든 사용자(또는 링크가 있는 모든 사용자)"
 *   → 생성된 URL을 공유
 *
 * 배포 방법 B (기존 서명 폼 프로젝트에 합치기)
 *   이 파일의 doGet 이름을 dashboardGet 으로 바꾸고, 기존 doGet(e) 맨 위에
 *     if (e.parameter.view === 'dashboard') return dashboardGet(e);
 *   를 추가 → …/exec?view=dashboard 로 접근
 *
 * 개인정보: 기본값은 집계(건수·실인원·시간)만 보여주고 봉사자 이름은 내보내지 않습니다.
 *           내부용으로 봉사자별 표가 필요하면 CFG_WEB.SHOW_NAMES = true.
 */

const CFG_WEB = {
  SHOW_NAMES: false,     // true면 봉사자별 표(이름 노출)도 표시 — 조직 내부 배포일 때만 켜세요
  TOP_PROGRAMS: 30,      // 프로그램 표 최대 행
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  const range = resolvePeriod(p);
  if (p.format === 'json') {
    const sum = getSummary(range.start, range.end);
    if (!CFG_WEB.SHOW_NAMES) stripNames(sum);
    return ContentService.createTextOutput(JSON.stringify(sum)).setMimeType(ContentService.MimeType.JSON);
  }
  const sum = getSummary(range.start, range.end);
  // 월별 추이는 항상 '해당 연도 1~12월'을 함께 보여준다
  const yearSum = getSummary(new Date(range.start.getFullYear(), 0, 1), new Date(range.start.getFullYear(), 11, 31));
  const html = buildDashboardHtml({
    title: CFG.DASHBOARD_TITLE,
    orgName: CFG.ORG_NAME,
    period: range.key,
    periodLabel: range.label,
    sum,
    yearMonths: yearSum.byMonth,
    year: range.start.getFullYear(),
    showNames: CFG_WEB.SHOW_NAMES,
    topPrograms: CFG_WEB.TOP_PROGRAMS,
    generatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'),
    baseUrl: ScriptApp.getService().getUrl() || '',
  });
  return HtmlService.createHtmlOutput(html)
    .setTitle(CFG.DASHBOARD_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function resolvePeriod(p) {
  const t = new Date();
  const y = t.getFullYear(), m = t.getMonth();
  if (p.from && p.to) {
    const s = parseYmd(p.from), e = parseYmd(p.to);
    return { key: 'custom', start: s, end: e, label: `${p.from} ~ ${p.to}` };
  }
  switch (p.period) {
    case 'last_month': return { key: 'last_month', start: new Date(y, m - 1, 1), end: new Date(y, m, 0), label: `${new Date(y, m - 1, 1).getFullYear()}년 ${((m + 11) % 12) + 1}월` };
    case 'this_year': return { key: 'this_year', start: new Date(y, 0, 1), end: new Date(y, 11, 31), label: `${y}년 누계` };
    case 'last_year': return { key: 'last_year', start: new Date(y - 1, 0, 1), end: new Date(y - 1, 11, 31), label: `${y - 1}년` };
    case 'all': return { key: 'all', start: new Date(2000, 0, 1), end: new Date(2999, 11, 31), label: '전체 누계' };
    default: return { key: 'this_month', start: new Date(y, m, 1), end: new Date(y, m + 1, 0), label: `${y}년 ${m + 1}월` };
  }
}

function stripNames(sum) {
  delete sum.byVolunteer;
  (sum.byProgram || []).forEach(x => delete x.programs);
  (sum.byMonth || []).forEach(x => delete x.programs);
  (sum.invalid || []).forEach(x => delete x.name);
}

// ───────────────────────── HTML (순수 함수: Apps Script API 사용 안 함) ─────────────────────────
function buildDashboardHtml(ctx) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n0 = v => Number(v || 0).toLocaleString('ko-KR');
  const n1 = v => Number(v || 0).toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  const sum = ctx.sum;
  const tabs = [
    ['this_month', '이번 달'], ['last_month', '지난 달'], ['this_year', '올해 누계'], ['last_year', '작년'], ['all', '전체'],
  ];
  const link = key => `${ctx.baseUrl}?period=${key}`;
  const tabHtml = tabs.map(([k, l]) =>
    `<a class="tab${ctx.period === k ? ' on' : ''}" href="${esc(link(k))}">${esc(l)}</a>`).join('');

  const kinds = Object.keys(sum.byKind || {}).sort();
  const kindHtml = kinds.length ? kinds.map(k => {
    const v = sum.byKind[k];
    return `<div class="kind"><div class="kind-name">${esc(k)}</div><div class="kind-vals">${n0(v.count)}건 · ${n0(v.people)}명 · <b>${n1(v.hours)}h</b></div></div>`;
  }).join('') : '<div class="muted">데이터 없음</div>';

  // 월별 막대 (해당 연도 1~12월, 총 시간 기준)
  const months = Array.from({ length: 12 }, (_, i) => {
    const key = `${ctx.year}-${String(i + 1).padStart(2, '0')}`;
    const row = (ctx.yearMonths || []).find(r => r.month === key) || { count: 0, people: 0, hours: 0 };
    return { label: `${i + 1}월`, key, ...row };
  });
  const maxH = Math.max(1, ...months.map(x => x.hours));
  const inPeriod = key => {
    const s = `${sum.start}`.slice(0, 7), e = `${sum.end}`.slice(0, 7);
    return key >= s && key <= e;
  };
  const barsHtml = months.map(x =>
    `<div class="bar-col${inPeriod(x.key) ? ' in' : ''}" title="${esc(x.label)} ${n1(x.hours)}h · ${n0(x.people)}명 · ${n0(x.count)}건">
       <div class="bar-val">${x.hours ? n1(x.hours) : ''}</div>
       <div class="bar-track"><div class="bar" style="height:${Math.round((x.hours / maxH) * 100)}%"></div></div>
       <div class="bar-label">${esc(x.label)}</div>
       <div class="bar-sub">${x.people ? n0(x.people) + '명' : ''}</div>
     </div>`).join('');

  const progs = (sum.byProgram || []).slice(0, ctx.topPrograms);
  const maxPH = Math.max(1, ...progs.map(p => p.hours));
  const progHtml = progs.length ? progs.map(p =>
    `<tr>
       <td class="name">${esc(p.program)}<span class="pill ${p.kind === '정기' ? 'reg' : 'tmp'}">${esc(p.kind || '-')}</span></td>
       <td class="muted hide-sm">${esc(p.team || '')}</td>
       <td class="num">${n0(p.count)}</td>
       <td class="num">${n0(p.people)}</td>
       <td class="num"><b>${n1(p.hours)}</b></td>
       <td class="spark hide-sm"><div class="spark-bar" style="width:${Math.round((p.hours / maxPH) * 100)}%"></div></td>
     </tr>`).join('') : '<tr><td colspan="6" class="muted">해당 기간 활동 없음</td></tr>';

  let namesHtml = '';
  if (ctx.showNames && sum.byVolunteer && sum.byVolunteer.length) {
    namesHtml = `
    <section class="card">
      <h2>봉사자별 <span class="muted">(총 시간 순 · 내부용)</span></h2>
      <div class="tbl-wrap"><table>
        <thead><tr><th>봉사자</th><th class="num">건수</th><th class="num">시간(h)</th><th>참여 프로그램</th></tr></thead>
        <tbody>${sum.byVolunteer.map(v => `<tr><td>${esc(v.name)}</td><td class="num">${n0(v.count)}</td><td class="num"><b>${n1(v.hours)}</b></td><td class="muted">${esc((v.programs || []).join(', '))}</td></tr>`).join('')}</tbody>
      </table></div>
    </section>`;
  }

  const invalidHtml = (sum.invalid && sum.invalid.length)
    ? `<div class="notice warn">⚠ 확인 필요 ${n0(sum.invalid.length)}건 — 종료≤시작 또는 날짜/시간 누락으로 <b>0시간</b> 처리되었습니다. 스프레드시트 <b>데이터점검</b> 시트에서 해당 행을 수정하세요.</div>`
    : `<div class="notice ok">✓ 데이터 점검 이상 없음</div>`;

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(ctx.title)}</title>
<style>
:root{--bg:#f4f6f3;--card:#ffffff;--fg:#1d2a22;--muted:#6b776f;--line:#dfe6e0;--accent:#1f7a5c;--accent-soft:#d9efe4;--reg:#e3eee6;--tmp:#fdebd3;--warn-bg:#fff3e8;--warn-fg:#8a4b12;--ok-bg:#e9f5ee;--ok-fg:#1f6b47}
@media (prefers-color-scheme:dark){:root{--bg:#121714;--card:#1b231e;--fg:#e8eee9;--muted:#9aa89f;--line:#2b352f;--accent:#5fc49a;--accent-soft:#1f3a2e;--reg:#243b30;--tmp:#4a3a22;--warn-bg:#3a2a18;--warn-fg:#f3c08a;--ok-bg:#1d3328;--ok-fg:#9ad8b7}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:1040px;margin:0 auto;padding:20px max(16px,env(safe-area-inset-right,0px)) 48px max(16px,env(safe-area-inset-left,0px))}
header{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:16px}
h1{margin:0;font-size:22px;letter-spacing:-.01em}h1 small{display:block;font-size:13px;color:var(--muted);font-weight:500;margin-top:2px}
h2{font-size:15px;margin:0 0 12px;letter-spacing:.01em}
.tabs{display:flex;flex-wrap:wrap;gap:6px}
.tab{padding:6px 12px;border:1px solid var(--line);border-radius:999px;color:var(--fg);text-decoration:none;font-size:13px;background:var(--card)}
.tab.on{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}
.period{font-size:13px;color:var(--muted);margin:0 0 14px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.kpi .l{font-size:12px;color:var(--muted);letter-spacing:.02em}.kpi .v{font-size:28px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.2;margin-top:2px}.kpi .v small{font-size:14px;font-weight:500;color:var(--muted);margin-left:2px}
.kpi.main{background:var(--accent);border-color:var(--accent);color:#fff}.kpi.main .l,.kpi.main .v small{color:rgba(255,255,255,.8)}
.grid{display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px}@media(max-width:720px){.grid{grid-template-columns:1fr}}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;min-width:0;margin-bottom:14px}
.bars{display:grid;grid-template-columns:repeat(12,1fr);gap:4px;align-items:end;height:190px}
.bar-col{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;min-width:0}
.bar-track{width:100%;flex:1;display:flex;align-items:flex-end}.bar{width:100%;background:var(--line);border-radius:4px 4px 0 0;min-height:2px}
.bar-col.in .bar{background:var(--accent)}.bar-val{font-size:10px;color:var(--muted);font-variant-numeric:tabular-nums;height:14px}
.bar-label{font-size:11px;color:var(--muted);margin-top:4px}.bar-sub{font-size:10px;color:var(--muted);height:13px}
.kind{display:flex;justify-content:space-between;gap:8px;padding:10px 0;border-top:1px solid var(--line)}.kind:first-of-type{border-top:0;padding-top:0}
.kind-name{font-weight:600}.kind-vals{color:var(--muted);font-variant-numeric:tabular-nums;text-align:right}.kind-vals b{color:var(--fg)}
.tbl-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:14px}
th,td{padding:8px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle}th{font-size:12px;color:var(--muted);font-weight:600;letter-spacing:.02em}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}td.name{font-weight:600}
.pill{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:600;vertical-align:middle}.pill.reg{background:var(--reg)}.pill.tmp{background:var(--tmp)}
.spark{width:22%}.spark-bar{height:8px;background:var(--accent-soft);border-radius:4px;position:relative}.spark-bar::after{content:"";position:absolute;inset:0;background:var(--accent);border-radius:4px;opacity:.85}
.muted{color:var(--muted)}.notice{border-radius:10px;padding:10px 14px;font-size:14px;margin-bottom:14px}.notice.warn{background:var(--warn-bg);color:var(--warn-fg)}.notice.ok{background:var(--ok-bg);color:var(--ok-fg)}
footer{font-size:12px;color:var(--muted);display:flex;flex-wrap:wrap;gap:6px 14px}footer a{color:var(--accent)}
@media(max-width:560px){.hide-sm{display:none}.kpi .v{font-size:24px}}
</style></head>
<body><div class="wrap">
<header>
  <h1>${esc(ctx.orgName ? ctx.orgName + ' ' : '')}${esc(ctx.title)}<small>기준 ${esc(ctx.generatedAt)} · 활동일지 실시간 집계</small></h1>
  <nav class="tabs">${tabHtml}</nav>
</header>
<p class="period">조회 기간 <b>${esc(ctx.periodLabel)}</b> (${esc(sum.start)} ~ ${esc(sum.end)})</p>

<section class="kpis">
  <div class="kpi main"><div class="l">총 활동시간</div><div class="v">${n1(sum.hours)}<small>h</small></div></div>
  <div class="kpi"><div class="l">실인원</div><div class="v">${n0(sum.people)}<small>명</small></div></div>
  <div class="kpi"><div class="l">활동 건수</div><div class="v">${n0(sum.count)}<small>건</small></div></div>
  <div class="kpi"><div class="l">1인 평균</div><div class="v">${n1(sum.avgHours)}<small>h</small></div></div>
  <div class="kpi"><div class="l">활동 프로그램</div><div class="v">${n0((sum.byProgram || []).length)}<small>개</small></div></div>
</section>

${invalidHtml}

<div class="grid">
  <section class="card">
    <h2>${esc(String(ctx.year))}년 월별 총 활동시간 <span class="muted">(h · 아래 숫자는 실인원)</span></h2>
    <div class="bars">${barsHtml}</div>
  </section>
  <section class="card">
    <h2>구분별</h2>
    ${kindHtml}
  </section>
</div>

<section class="card">
  <h2>프로그램별 <span class="muted">(총 시간 순)</span></h2>
  <div class="tbl-wrap"><table>
    <thead><tr><th>프로그램</th><th class="hide-sm">소속</th><th class="num">건수</th><th class="num">실인원</th><th class="num">시간(h)</th><th class="hide-sm"></th></tr></thead>
    <tbody>${progHtml}</tbody>
    <tfoot><tr><th>합계</th><th class="hide-sm"></th><th class="num">${n0(sum.count)}</th><th class="num">${n0(sum.people)}</th><th class="num">${n1(sum.hours)}</th><th class="hide-sm"></th></tr></tfoot>
  </table></div>
</section>

${namesHtml}

<footer>
  <span>실인원 = 기간 내 중복 제거 인원 · 활동시간 = 종료−시작 · 주 = 월~일</span>
  <a href="${esc(ctx.baseUrl)}?period=${esc(ctx.period)}&format=json">JSON</a>
</footer>
</div></body></html>`;
}
