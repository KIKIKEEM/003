/**
 * 자원봉사 실적 집계 · 보고서 자동화 (Google Apps Script)
 * ------------------------------------------------------------
 * 대상 스프레드시트: "2026년 자원봉사활동관리"
 *   - 활동일지   : 봉사자 1명의 1회 활동 = 1행 (활동일, 시작, 종료, 프로그램 ...)
 *   - 봉사자 명단 : C열 '표시이름' = 활동일지 D열 '봉사자명'과 동일 키
 *   - 봉사활동처 : A열 TypeID = 활동일지 E열 '활동프로그램'과 동일 키
 *
 * 이 스크립트가 만드는 것
 *   1) 실시간 집계 시트 7개 (수식 기반 → 활동일지가 바뀌면 즉시 재계산)
 *        실적대시보드 / 월별실적 / 주별실적 / 프로그램별실적 / 봉사자별실적 / 데이터점검 / _calc(숨김)
 *   2) 메뉴 [📊 실적보고] → 월간·연간·임의기간 보고서 시트 생성 (+ PDF 저장)
 *   3) getSummary(start, end) : 다른 스크립트/웹앱에서 JSON으로 실적을 받아갈 수 있는 함수
 *
 * 설치: 스프레드시트 → 확장 프로그램 → Apps Script → 파일 추가 → 이 내용 붙여넣기 → 저장
 *       → 시트 새로고침 → 메뉴 [📊 실적보고] → [집계 시트 설치/재생성]
 */

// ───────────────────────── 설정 ─────────────────────────
const CFG = {
  LOG: '활동일지',
  ROSTER: '봉사자 명단',
  PLACES: '봉사활동처',
  CALC: '_calc',
  DASH: '실적대시보드',
  MONTHLY: '월별실적',
  WEEKLY: '주별실적',
  BY_PROGRAM: '프로그램별실적',
  BY_VOLUNTEER: '봉사자별실적',
  CHECK: '데이터점검',
  // 보고서 PDF를 저장할 드라이브 폴더 ID. 비우면 PDF는 만들지 않고 시트만 생성합니다.
  // (자원봉사 폴더: 1BVYJGTlDUrNj2APCp_EWvF_hMZqqBXhO 안에 '실적보고서' 하위 폴더를 자동 생성)
  REPORT_FOLDER_ID: '1BVYJGTlDUrNj2APCp_EWvF_hMZqqBXhO',
  REPORT_SUBFOLDER: '실적보고서',
  ORG_NAME: '',   // 보고서 머리글에 들어갈 기관명 (예: '○○종합사회복지관'). 비우면 생략
  // 활동일지 열 위치 (1부터). 열 순서를 바꾸면 여기만 수정
  COL: { ID: 1, NAME: 4, PROGRAM: 5, KIND: 6, DATE: 7, START: 8, END: 9, CONTENT: 10, VMS: 16 },

  // ── 자동 보고서 (매월 1일) ──
  AUTO_REPORT_HOUR: 8,          // 매월 1일 몇 시에 실행할지 (0~23, 스크립트 시간대 기준)
  NOTIFY_EMAILS: '',            // 보고서 PDF를 받을 메일. 쉼표로 여러 명 (예: 'a@x.or.kr, b@x.or.kr'). 비우면 메일 생략

  // ── 웹 대시보드(WebApp.gs) ──
  // 이 스크립트를 스프레드시트에 붙이지 않고 '독립 프로젝트'로 배포할 때 사용하는 스프레드시트 ID.
  // 시트에 붙인(컨테이너 바운드) 프로젝트에서는 비워 두어도 됩니다.
  SPREADSHEET_ID: '100D9egQ6TY03aJEgR0Ikw9yPG69QfmR-AYKY3GdkGqE',
  DASHBOARD_TITLE: '자원봉사 실적 현황',
};

/** 컨테이너 바운드면 활성 스프레드시트, 아니면 CFG.SPREADSHEET_ID로 연다 */
function getSS() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  if (!CFG.SPREADSHEET_ID) throw new Error('CFG.SPREADSHEET_ID를 설정하세요.');
  return SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
}

const STYLE = {
  HEAD_BG: '#e3eee6',
  SUM_BG: '#f2f2f2',
  INPUT_BG: '#fff7cc',
  WARN_BG: '#fbe5dd',
  WEEK_BG: '#fff2bf',
  NUM: '#,##0.0',   // 시간(h)
  INT: '#,##0',     // 건수·인원
  DATE: 'yyyy-mm-dd',
};

// ───────────────────────── 메뉴 ─────────────────────────
/**
 * 같은 Apps Script 프로젝트에 이미 onOpen()이 있으면, 이 함수 이름을 바꾸고
 * 기존 onOpen() 안에서 addReportMenu()를 호출하세요.
 */
function onOpen() {
  addReportMenu();
  try { ensureCalcRows(); } catch (e) { /* 집계 시트 미설치 상태면 무시 */ }
}

function addReportMenu() {
  SpreadsheetApp.getUi()
    .createMenu('📊 실적보고')
    .addItem('이번 달 보고서 만들기', 'reportThisMonth')
    .addItem('지난 달 보고서 만들기', 'reportLastMonth')
    .addItem('월간 보고서 만들기 (연·월 입력)', 'reportMonthPrompt')
    .addItem('연간 보고서 만들기 (연도 입력)', 'reportYearPrompt')
    .addItem('기간 보고서 만들기 (시작~종료 입력)', 'reportPeriodPrompt')
    .addSeparator()
    .addItem('매월 1일 자동 보고서 켜기', 'installMonthlyTrigger')
    .addItem('자동 보고서 끄기', 'removeMonthlyTrigger')
    .addItem('자동 보고서 지금 시험 실행', 'monthlyAutoReport')
    .addSeparator()
    .addItem('집계 시트 설치 / 재생성', 'setupReportSheets')
    .addItem('집계 범위 새로고침 (_calc 행 맞추기)', 'ensureCalcRows')
    .addSeparator()
    .addItem('도움말', 'showHelp')
    .addToUi();
}

// ───────────────────────── 매월 1일 자동 보고서 ─────────────────────────
const AUTO_FN = 'monthlyAutoReport';

/** 매월 1일 CFG.AUTO_REPORT_HOUR시에 지난달 보고서를 자동 생성하는 트리거 설치 (중복 방지) */
function installMonthlyTrigger() {
  removeMonthlyTrigger(true);
  ScriptApp.newTrigger(AUTO_FN).timeBased().onMonthDay(1).atHour(CFG.AUTO_REPORT_HOUR).create();
  const mail = CFG.NOTIFY_EMAILS ? `\n메일 발송: ${CFG.NOTIFY_EMAILS}` : '\n(메일 발송 없음 — CFG.NOTIFY_EMAILS에 주소를 넣으면 PDF를 메일로 보냅니다)';
  safeAlert('자동 보고서 켜짐', `매월 1일 ${CFG.AUTO_REPORT_HOUR}시경 지난달 실적보고서를 만들어 드라이브에 PDF로 저장합니다.${mail}`);
}

function removeMonthlyTrigger(silent) {
  let n = 0;
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === AUTO_FN) { ScriptApp.deleteTrigger(t); n++; } });
  if (!silent) safeAlert('자동 보고서 꺼짐', n ? `트리거 ${n}개를 삭제했습니다.` : '설치된 자동 보고서 트리거가 없습니다.');
}

/** 트리거가 호출하는 함수. UI 없이 동작하며, 결과를 드라이브 PDF(+메일)로 남긴다 */
function monthlyAutoReport() {
  const t = new Date();
  const s = new Date(t.getFullYear(), t.getMonth() - 1, 1);
  const e = new Date(t.getFullYear(), t.getMonth(), 0);
  const titleText = `${s.getFullYear()}년 ${s.getMonth() + 1}월 자원봉사 실적보고`;
  const out = createReport(s, e, titleText, { silent: true });

  if (CFG.NOTIFY_EMAILS) {
    const sum = out.summary;
    const top = sum.byProgram.slice(0, 5).map(p => ` · ${p.program}: ${p.count}건 / ${p.people}명 / ${p.hours}h`).join('\n');
    const body = [
      `${titleText}`,
      `기간 ${sum.start} ~ ${sum.end}`,
      '',
      `활동 ${sum.count}건 · 실인원 ${sum.people}명 · 총 ${sum.hours}시간 · 1인 평균 ${sum.avgHours}시간`,
      '',
      '프로그램별 상위:', top,
      '',
      sum.invalid.length ? `※ 확인 필요 행 ${sum.invalid.length}건 (활동일지에서 시간/날짜 수정 필요)` : '데이터 점검: 이상 없음',
      '',
      `스프레드시트: ${getSS().getUrl()}`,
      out.pdf ? `PDF: ${out.pdf.getUrl()}` : '',
    ].join('\n');
    MailApp.sendEmail({
      to: CFG.NOTIFY_EMAILS, subject: `[자동] ${titleText}`, body,
      attachments: out.pdf ? [out.pdf.getBlob()] : [],
    });
  }
  Logger.log(`${titleText} 생성 완료: ${out.sheetName}${out.pdf ? ' / PDF ' + out.pdf.getUrl() : ''}`);
  safeAlert('시험 실행 완료', `${titleText}\n시트 "${out.sheetName}"${out.pdf ? '\nPDF ' + out.pdf.getUrl() : ''}`);
}

/** 트리거/웹앱처럼 UI가 없는 컨텍스트에서는 alert를 건너뛴다 */
function safeAlert(title, msg) {
  try { SpreadsheetApp.getUi().alert(title, msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { Logger.log(`${title}: ${msg}`); }
}

function showHelp() {
  const msg = [
    '■ 실시간 집계 시트',
    ' · 실적대시보드 : B5·B6에 날짜를 넣으면 그 기간의 건수/실인원/시간이 바로 나옵니다. 오른쪽은 이번 주·이번 달·올해 누계 자동 표시.',
    ' · 월별실적 / 주별실적 : B2의 연도를 바꾸면 해당 연도로 전환.',
    ' · 프로그램별실적 / 봉사자별실적 : B2 연도 (0 = 전체 기간).',
    ' · 데이터점검 : 종료≤시작, 활동일 누락, 명단에 없는 이름 등 집계에서 빠지는 행. 활동일지에서 고치면 자동으로 사라집니다.',
    '',
    '■ 보고서',
    ' · 메뉴에서 월간/연간/기간을 선택하면 "보고서_기간" 시트가 생성되고(값 고정), 설정된 폴더에 PDF가 저장됩니다.',
    '',
    '■ 집계 규칙',
    ' · 활동시간 = 종료 − 시작 (시간 단위, 소수 둘째 자리). 종료≤시작이거나 비어 있으면 0으로 계산하고 데이터점검에 표시.',
    ' · 실인원 = 기간 안에서 봉사자명(이름+생년월일) 중복을 제거한 수.',
    ' · 주 = 월요일~일요일.',
  ].join('\n');
  SpreadsheetApp.getUi().alert('📊 실적보고 도움말', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

// ───────────────────────── 설치 ─────────────────────────
function setupReportSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const names = [CFG.DASH, CFG.MONTHLY, CFG.WEEKLY, CFG.BY_PROGRAM, CFG.BY_VOLUNTEER, CFG.CHECK, CFG.CALC];
  const existing = names.filter(n => ss.getSheetByName(n));
  if (existing.length) {
    const r = ui.alert('집계 시트 재생성',
      '다음 시트를 삭제하고 다시 만듭니다 (활동일지·명단은 건드리지 않습니다):\n\n' + existing.join(', ') + '\n\n계속할까요?',
      ui.ButtonSet.OK_CANCEL);
    if (r !== ui.Button.OK) return;
    existing.forEach(n => ss.deleteSheet(ss.getSheetByName(n)));
  }
  for (const n of [CFG.LOG, CFG.ROSTER, CFG.PLACES]) {
    if (!ss.getSheetByName(n)) throw new Error(`필수 시트 "${n}"이(가) 없습니다. CFG의 시트 이름을 확인하세요.`);
  }

  buildCalc(ss);
  buildDashboard(ss);
  buildMonthly(ss);
  buildWeekly(ss);
  buildByProgram(ss);
  buildByVolunteer(ss);
  buildCheck(ss);

  // 탭 순서: 기존 시트 뒤에 대시보드부터
  const base = ss.getSheets().filter(s => !names.includes(s.getName())).length;
  [CFG.DASH, CFG.MONTHLY, CFG.WEEKLY, CFG.BY_PROGRAM, CFG.BY_VOLUNTEER, CFG.CHECK, CFG.CALC].forEach((n, i) => {
    ss.setActiveSheet(ss.getSheetByName(n));
    ss.moveActiveSheet(base + i + 1);
  });
  ss.getSheetByName(CFG.CALC).hideSheet();
  ss.setActiveSheet(ss.getSheetByName(CFG.DASH));
  SpreadsheetApp.flush();
  ui.alert('완료', '집계 시트 7개를 만들었습니다. 활동일지가 바뀌면 자동으로 다시 계산됩니다.', ui.ButtonSet.OK);
}

/** 활동일지 행 수가 늘어나도 _calc의 ARRAYFORMULA가 넘치지 않도록 행 수를 맞춥니다. */
function ensureCalcRows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const calc = ss.getSheetByName(CFG.CALC);
  const log = ss.getSheetByName(CFG.LOG);
  if (!calc || !log) return;
  const need = log.getMaxRows() + 50;
  const have = calc.getMaxRows();
  if (have < need) calc.insertRowsAfter(have, need - have);
}

// ───────────────────────── 공통 서식 ─────────────────────────
function title(sheet, a1, text, size) {
  sheet.getRange(a1).setValue(text).setFontWeight('bold').setFontSize(size || 16);
}
function header(sheet, a1, values, bg) {
  const r = sheet.getRange(a1);
  if (values) r.setValues([values]);
  r.setFontWeight('bold').setBackground(bg || STYLE.HEAD_BG).setWrap(true);
}
function inputCell(sheet, a1) {
  sheet.getRange(a1).setBackground(STYLE.INPUT_BG).setFontWeight('bold');
}
function fmt(sheet, a1, pattern) { sheet.getRange(a1).setNumberFormat(pattern); }
function note(sheet, a1, text) { sheet.getRange(a1).setValue(text).setFontColor('#666666').setFontStyle('italic'); }

// ───────────────────────── _calc ─────────────────────────
function buildCalc(ss) {
  const log = ss.getSheetByName(CFG.LOG);
  const s = ss.insertSheet(CFG.CALC);
  const rows = Math.max(log.getMaxRows() + 50, 1000);
  if (s.getMaxRows() < rows) s.insertRowsAfter(s.getMaxRows(), rows - s.getMaxRows());
  if (s.getMaxColumns() < 13) s.insertColumnsAfter(s.getMaxColumns(), 13 - s.getMaxColumns());

  const L = CFG.LOG, R = `'${CFG.ROSTER}'`, P = CFG.PLACES;
  const c = CFG.COL;
  const col = n => String.fromCharCode(64 + n); // 1→A
  const A = `${L}!${col(c.ID)}2:${col(c.ID)}`;
  const NAME = `${L}!${col(c.NAME)}2:${col(c.NAME)}`;
  const PROG = `${L}!${col(c.PROGRAM)}2:${col(c.PROGRAM)}`;
  const KIND = `${L}!${col(c.KIND)}2:${col(c.KIND)}`;
  const DATE = `${L}!${col(c.DATE)}2:${col(c.DATE)}`;
  const ST = `${L}!${col(c.START)}2:${col(c.START)}`;
  const EN = `${L}!${col(c.END)}2:${col(c.END)}`;
  const VMS = `${L}!${col(c.VMS)}2:${col(c.VMS)}`;
  const VALID_TIME = `ISNUMBER(${ST})*ISNUMBER(${EN})*(${EN}>${ST})`;

  s.getRange('A1:M1').setValues([[
    'LogID', '봉사자명', '프로그램', '구분', '활동일', '시간(h)', '연', '연월', '주시작(월)', '상태', '명단등록', 'VMS', '프로그램등록',
  ]]).setFontWeight('bold');

  s.getRange('A2:M2').setFormulas([[
    `=ARRAYFORMULA(IF(${A}="",,${A}))`,
    `=ARRAYFORMULA(IF(${A}="",,TRIM(${NAME})))`,
    `=ARRAYFORMULA(IF(${A}="",,TRIM(${PROG})))`,
    `=ARRAYFORMULA(IF(${A}="",,${KIND}))`,
    `=ARRAYFORMULA(IF((${A}<>"")*ISNUMBER(${DATE}),${DATE},))`,
    `=ARRAYFORMULA(IF(${A}="",,IF(${VALID_TIME},ROUND((${EN}-${ST})*24,2),0)))`,
    `=ARRAYFORMULA(IF(E2:E="",,YEAR(E2:E)))`,
    `=ARRAYFORMULA(IF(E2:E="",,TEXT(E2:E,"yyyy-mm")))`,
    `=ARRAYFORMULA(IF(E2:E="",,E2:E-WEEKDAY(E2:E,2)+1))`,
    `=ARRAYFORMULA(IF(A2:A="",,IF(E2:E="","활동일 누락",IF(${VALID_TIME},"정상","시간 오류(종료≤시작 또는 누락)"))))`,
    `=ARRAYFORMULA(IF(A2:A="",,IF(COUNTIF(${R}!C:C,B2:B)>0,"등록","명단 없음")))`,
    `=ARRAYFORMULA(IF(A2:A="",,IF((${VMS}=TRUE)+(${VMS}="TRUE"),"등록","미등록")))`,
    `=ARRAYFORMULA(IF(A2:A="",,IF(COUNTIF(${P}!A:A,C2:C)>0,"등록","미등록")))`,
  ]]);
  // QUERY가 날짜 비교를 하려면 E·I열이 날짜 서식이어야 합니다 (중요)
  s.getRange('E2:E').setNumberFormat(STYLE.DATE);
  s.getRange('I2:I').setNumberFormat(STYLE.DATE);
  s.setFrozenRows(1);
}

// ───────────────────────── 실적대시보드 ─────────────────────────
function buildDashboard(ss) {
  const s = ss.insertSheet(CFG.DASH);
  const C = CFG.CALC;
  title(s, 'A1', '자원봉사 실적 대시보드');
  s.getRange('A2').setFormula(`="기준일 "&TEXT(TODAY(),"yyyy-mm-dd")&" · 활동일지 전체 "&COUNTA(${C}!A2:A)&"건 · 활동일지가 바뀌면 자동 재계산"`).setFontColor('#666666');

  // ① 기간 직접 조회
  title(s, 'A4', '① 기간 직접 조회 (B5·B6에 날짜 입력)', 12);
  s.getRange('A5:A6').setValues([['시작일'], ['종료일']]).setFontWeight('bold');
  s.getRange('B5').setFormula('=DATE(YEAR(TODAY()),MONTH(TODAY()),1)');
  s.getRange('B6').setFormula('=TODAY()');
  inputCell(s, 'B5:B6'); fmt(s, 'B5:B6', STYLE.DATE);
  s.getRange('D5:D9').setValues([['활동 건수'], ['실인원(명)'], ['총 활동시간(h)'], ['1인 평균시간(h)'], ['활동 프로그램 수']]).setFontWeight('bold');
  s.getRange('E5:E9').setFormulas([
    [`=COUNTIFS(${C}!E:E,">="&$B$5,${C}!E:E,"<="&$B$6)`],
    [`=IFERROR(COUNTUNIQUEIFS(${C}!B:B,${C}!E:E,">="&$B$5,${C}!E:E,"<="&$B$6),0)`],
    [`=SUMIFS(${C}!F:F,${C}!E:E,">="&$B$5,${C}!E:E,"<="&$B$6)`],
    ['=IF(E6=0,0,ROUND(E7/E6,1))'],
    [`=IFERROR(ROWS(UNIQUE(FILTER(${C}!C:C,${C}!E:E>=$B$5,${C}!E:E<=$B$6))),0)`],
  ]);
  s.getRange('E5:E9').setFontWeight('bold').setFontSize(14).setHorizontalAlignment('right');

  title(s, 'A11', '기간 내 프로그램별 실적', 12);
  header(s, 'A12:F12', ['프로그램', '구분', '활동 건수', '총 시간(h)', '실인원', '담당자']);
  const NO = '해당 기간 데이터 없음';
  s.getRange('A13').setFormula(
    `=IFERROR(QUERY(${C}!A2:M,"select C, D, count(A), sum(F) where E >= date '"&TEXT($B$5,"yyyy-mm-dd")&"' and E <= date '"&TEXT($B$6,"yyyy-mm-dd")&"' group by C, D order by sum(F) desc label C '', D '', count(A) '', sum(F) ''",0),"${NO}")`);
  s.getRange('E13').setFormula(
    `=MAP(A13:A60,LAMBDA(p,IF(OR(p="",p="${NO}"),,COUNTUNIQUEIFS(${C}!B:B,${C}!C:C,p,${C}!E:E,">="&$B$5,${C}!E:E,"<="&$B$6))))`);
  s.getRange('F13').setFormula(
    `=MAP(A13:A60,LAMBDA(p,IF(OR(p="",p="${NO}"),,IFERROR(VLOOKUP(p,${CFG.PLACES}!A:E,5,FALSE),"(활동처 미등록)"))))`);
  fmt(s, 'C13:C60', STYLE.INT); fmt(s, 'D13:D60', STYLE.NUM); fmt(s, 'E13:E60', STYLE.INT);

  // ② 바로 보기
  title(s, 'H4', '② 바로 보기 (자동 계산)', 12);
  header(s, 'H5:N5', ['기간', '시작', '종료', '활동 건수', '실인원', '총 시간(h)', '1인 평균(h)']);
  const quick = [
    ['이번 주', '=TODAY()-WEEKDAY(TODAY(),2)+1', '=I6+6'],
    ['지난 주', '=I6-7', '=J6-7'],
    ['이번 달', '=DATE(YEAR(TODAY()),MONTH(TODAY()),1)', '=EOMONTH(TODAY(),0)'],
    ['지난 달', '=EOMONTH(TODAY(),-2)+1', '=EOMONTH(TODAY(),-1)'],
    ['올해 누계', '=DATE(YEAR(TODAY()),1,1)', '=DATE(YEAR(TODAY()),12,31)'],
    ['작년', '=DATE(YEAR(TODAY())-1,1,1)', '=DATE(YEAR(TODAY())-1,12,31)'],
    ['전체 누계', `=MIN(${C}!E:E)`, `=MAX(${C}!E:E)`],
  ];
  quick.forEach((q, i) => {
    const r = 6 + i;
    s.getRange(r, 8).setValue(q[0]).setFontWeight('bold');
    s.getRange(r, 9).setFormula(q[1]);
    s.getRange(r, 10).setFormula(q[2]);
    s.getRange(r, 11, 1, 4).setFormulas([[
      `=COUNTIFS(${C}!E:E,">="&$I${r},${C}!E:E,"<="&$J${r})`,
      `=IFERROR(COUNTUNIQUEIFS(${C}!B:B,${C}!E:E,">="&$I${r},${C}!E:E,"<="&$J${r}),0)`,
      `=SUMIFS(${C}!F:F,${C}!E:E,">="&$I${r},${C}!E:E,"<="&$J${r})`,
      `=IF(L${r}=0,0,ROUND(M${r}/L${r},1))`,
    ]]);
  });
  fmt(s, 'I6:J12', STYLE.DATE); fmt(s, 'K6:L12', STYLE.INT); fmt(s, 'M6:N12', STYLE.NUM);
  s.getRange('H10:N10').setFontWeight('bold').setBackground(STYLE.SUM_BG);

  s.setColumnWidth(1, 190); s.setColumnWidth(4, 130); s.setColumnWidth(7, 30);
  s.setColumnWidths(9, 2, 100);
  s.setHiddenGridlines(true);
}

// ───────────────────────── 월별실적 ─────────────────────────
function buildMonthly(ss) {
  const s = ss.insertSheet(CFG.MONTHLY);
  const C = CFG.CALC;
  title(s, 'A1', '월별 실적');
  s.getRange('A2').setValue('연도').setFontWeight('bold');
  s.getRange('B2').setFormula('=YEAR(TODAY())'); inputCell(s, 'B2');
  note(s, 'C2', '← 다른 연도를 보려면 숫자 입력 (예: 2025)');
  header(s, 'A4:K4', ['월', '시작', '종료', '활동 건수', '실인원', '총 시간(h)', '정기 건수', '정기 시간(h)', '단기 건수', '단기 시간(h)', '1인 평균(h)']);
  s.getRange('A5:K5').setFormulas([[
    '=ARRAYFORMULA(TEXT(B5:B16,"yyyy년 m월"))',
    '=ARRAYFORMULA(DATE($B$2,SEQUENCE(12),1))',
    '=ARRAYFORMULA(EOMONTH(B5:B16,0))',
    `=ARRAYFORMULA(COUNTIFS(${C}!E:E,">="&B5:B16,${C}!E:E,"<="&C5:C16))`,
    `=MAP(B5:B16,C5:C16,LAMBDA(s,e,IFERROR(COUNTUNIQUEIFS(${C}!B:B,${C}!E:E,">="&s,${C}!E:E,"<="&e),0)))`,
    `=MAP(B5:B16,C5:C16,LAMBDA(s,e,SUMIFS(${C}!F:F,${C}!E:E,">="&s,${C}!E:E,"<="&e)))`,
    `=ARRAYFORMULA(COUNTIFS(${C}!E:E,">="&B5:B16,${C}!E:E,"<="&C5:C16,${C}!D:D,"정기"))`,
    `=MAP(B5:B16,C5:C16,LAMBDA(s,e,SUMIFS(${C}!F:F,${C}!E:E,">="&s,${C}!E:E,"<="&e,${C}!D:D,"정기")))`,
    `=ARRAYFORMULA(COUNTIFS(${C}!E:E,">="&B5:B16,${C}!E:E,"<="&C5:C16,${C}!D:D,"단기"))`,
    `=MAP(B5:B16,C5:C16,LAMBDA(s,e,SUMIFS(${C}!F:F,${C}!E:E,">="&s,${C}!E:E,"<="&e,${C}!D:D,"단기")))`,
    '=ARRAYFORMULA(IF(E5:E16=0,0,ROUND(F5:F16/E5:E16,1)))',
  ]]);
  s.getRange('A17').setValue('연간 합계');
  s.getRange('B17:K17').setFormulas([[
    '=DATE($B$2,1,1)', '=DATE($B$2,12,31)', '=SUM(D5:D16)',
    `=IFERROR(COUNTUNIQUEIFS(${C}!B:B,${C}!E:E,">="&B17,${C}!E:E,"<="&C17),0)`,
    '=SUM(F5:F16)', '=SUM(G5:G16)', '=SUM(H5:H16)', '=SUM(I5:I16)', '=SUM(J5:J16)',
    '=IF(E17=0,0,ROUND(F17/E17,1))',
  ]]);
  s.getRange('A17:K17').setFontWeight('bold').setBackground(STYLE.SUM_BG);
  note(s, 'A18', '※ 실인원은 해당 기간 안에서 중복을 제거한 인원입니다. 월별 실인원을 더한 값과 연간 실인원은 다릅니다.');
  fmt(s, 'B5:C17', STYLE.DATE); fmt(s, 'D5:E17', STYLE.INT); fmt(s, 'F5:F17', STYLE.NUM); fmt(s, 'G5:G17', STYLE.INT);
  fmt(s, 'H5:H17', STYLE.NUM); fmt(s, 'I5:I17', STYLE.INT); fmt(s, 'J5:K17', STYLE.NUM);

  title(s, 'A20', '프로그램 × 월 — 총 시간(h)', 12);
  s.getRange('A21').setFormula(`=IFERROR(QUERY(${C}!A2:M,"select C, sum(F) where G = "&$B$2&" group by C pivot H order by C label C '프로그램'",1),"데이터 없음")`);
  title(s, 'O20', '프로그램 × 월 — 활동 건수', 12);
  s.getRange('O21').setFormula(`=IFERROR(QUERY(${C}!A2:M,"select C, count(A) where G = "&$B$2&" group by C pivot H order by C label C '프로그램'",1),"데이터 없음")`);
  fmt(s, 'B21:M40', STYLE.NUM); fmt(s, 'P21:AA40', STYLE.INT);
  s.getRange('A21:M21').setFontWeight('bold'); s.getRange('O21:AA21').setFontWeight('bold');
  s.setColumnWidth(1, 170); s.setColumnWidth(15, 170);
  s.setFrozenRows(4);

  // 차트: 월별 총 시간 / 실인원
  const chart1 = s.newChart().setChartType(Charts.ChartType.COLUMN)
    .addRange(s.getRange('A4:A16')).addRange(s.getRange('F4:F16'))
    .setOption('title', '월별 총 활동시간(h)').setOption('legend', { position: 'none' })
    .setPosition(42, 1, 0, 0).setOption('width', 560).setOption('height', 300).build();
  const chart2 = s.newChart().setChartType(Charts.ChartType.COLUMN)
    .addRange(s.getRange('A4:A16')).addRange(s.getRange('E4:E16'))
    .setOption('title', '월별 실인원(명)').setOption('legend', { position: 'none' })
    .setPosition(42, 8, 0, 0).setOption('width', 560).setOption('height', 300).build();
  s.insertChart(chart1); s.insertChart(chart2);
}

// ───────────────────────── 주별실적 ─────────────────────────
function buildWeekly(ss) {
  const s = ss.insertSheet(CFG.WEEKLY);
  const C = CFG.CALC;
  title(s, 'A1', '주별 실적 (월요일~일요일)');
  s.getRange('A2').setValue('연도').setFontWeight('bold');
  s.getRange('B2').setFormula('=YEAR(TODAY())'); inputCell(s, 'B2');
  note(s, 'C2', '← 다른 연도를 보려면 숫자 입력');
  header(s, 'A4:H4', ['주차(ISO)', '주 시작(월)', '주 종료(일)', '기간', '활동 건수', '실인원', '총 시간(h)', '1인 평균(h)']);
  s.getRange('A5:H5').setFormulas([[
    '=ARRAYFORMULA("W"&TEXT(WEEKNUM(B5:B57,21),"00"))',
    '=ARRAYFORMULA(DATE($B$2,1,1)-WEEKDAY(DATE($B$2,1,1),2)+1+7*SEQUENCE(53,1,0))',
    '=ARRAYFORMULA(B5:B57+6)',
    '=ARRAYFORMULA(TEXT(B5:B57,"m/d")&"~"&TEXT(C5:C57,"m/d"))',
    `=ARRAYFORMULA(COUNTIFS(${C}!E:E,">="&B5:B57,${C}!E:E,"<="&C5:C57))`,
    `=MAP(B5:B57,C5:C57,LAMBDA(s,e,IFERROR(COUNTUNIQUEIFS(${C}!B:B,${C}!E:E,">="&s,${C}!E:E,"<="&e),0)))`,
    `=MAP(B5:B57,C5:C57,LAMBDA(s,e,SUMIFS(${C}!F:F,${C}!E:E,">="&s,${C}!E:E,"<="&e)))`,
    '=ARRAYFORMULA(IF(F5:F57=0,0,ROUND(G5:G57/F5:F57,1)))',
  ]]);
  s.getRange('A58').setValue('연간 합계');
  s.getRange('B58:H58').setFormulas([[
    '=DATE($B$2,1,1)', '=DATE($B$2,12,31)', '',
    `=COUNTIFS(${C}!E:E,">="&B58,${C}!E:E,"<="&C58)`,
    `=IFERROR(COUNTUNIQUEIFS(${C}!B:B,${C}!E:E,">="&B58,${C}!E:E,"<="&C58),0)`,
    `=SUMIFS(${C}!F:F,${C}!E:E,">="&B58,${C}!E:E,"<="&C58)`,
    '=IF(F58=0,0,ROUND(G58/F58,1))',
  ]]);
  s.getRange('A58:H58').setFontWeight('bold').setBackground(STYLE.SUM_BG);
  note(s, 'A59', '※ 연초·연말 주는 인접 연도 날짜를 포함할 수 있어 주별 합과 연간 합계가 약간 다를 수 있습니다.');
  fmt(s, 'B5:C58', STYLE.DATE); fmt(s, 'E5:F58', STYLE.INT); fmt(s, 'G5:H58', STYLE.NUM);
  // 이번 주 강조
  const rule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($B5<=TODAY(),$C5>=TODAY())')
    .setBackground(STYLE.WEEK_BG).setBold(true)
    .setRanges([s.getRange('A5:H57')]).build();
  s.setConditionalFormatRules([rule]);
  s.setFrozenRows(4);
}

// ───────────────────────── 프로그램별실적 ─────────────────────────
function buildByProgram(ss) {
  const s = ss.insertSheet(CFG.BY_PROGRAM);
  const C = CFG.CALC, P = CFG.PLACES;
  title(s, 'A1', '프로그램별 실적');
  s.getRange('A2').setValue('연도').setFontWeight('bold');
  s.getRange('B2').setFormula('=YEAR(TODAY())'); inputCell(s, 'B2');
  note(s, 'C2', '← 0을 입력하면 전체 기간');
  s.getRange('A3').setValue('조회 기간').setFontWeight('bold');
  s.getRange('B3:C3').setFormulas([['=IF($B$2=0,DATE(1900,1,1),DATE($B$2,1,1))', '=IF($B$2=0,DATE(2999,12,31),DATE($B$2,12,31))']]);
  fmt(s, 'B3:C3', STYLE.DATE);
  header(s, 'A5:J5', ['프로그램', '구분', '소속', '담당자', '활동 건수', '실인원', '총 시간(h)', '1인 평균(h)', '첫 활동', '최근 활동']);
  const PER = `${C}!E:E,">="&$B$3,${C}!E:E,"<="&$C$3`;
  s.getRange('A6:J6').setFormulas([[
    `=ARRAYFORMULA(IF(${P}!A2:A60="",,${P}!A2:A60))`,
    `=ARRAYFORMULA(IF(${P}!A2:A60="",,${P}!B2:B60))`,
    `=ARRAYFORMULA(IF(${P}!A2:A60="",,${P}!C2:C60))`,
    `=ARRAYFORMULA(IF(${P}!A2:A60="",,${P}!E2:E60))`,
    `=ARRAYFORMULA(IF(A6:A64="",,COUNTIFS(${C}!C:C,A6:A64,${PER})))`,
    `=MAP(A6:A64,LAMBDA(p,IF(p="",,IFERROR(COUNTUNIQUEIFS(${C}!B:B,${C}!C:C,p,${PER}),0))))`,
    `=MAP(A6:A64,LAMBDA(p,IF(p="",,SUMIFS(${C}!F:F,${C}!C:C,p,${PER}))))`,
    '=ARRAYFORMULA(IF(A6:A64="",,IF(F6:F64=0,0,ROUND(G6:G64/F6:F64,1))))',
    `=MAP(A6:A64,LAMBDA(p,IF(p="",,IFERROR(IF(MINIFS(${C}!E:E,${C}!C:C,p,${PER})=0,"",MINIFS(${C}!E:E,${C}!C:C,p,${PER})),""))))`,
    `=MAP(A6:A64,LAMBDA(p,IF(p="",,IFERROR(IF(MAXIFS(${C}!E:E,${C}!C:C,p,${PER})=0,"",MAXIFS(${C}!E:E,${C}!C:C,p,${PER})),""))))`,
  ]]);
  s.getRange('A66').setValue('합계');
  s.getRange('E66:H66').setFormulas([[
    '=SUM(E6:E64)', `=IFERROR(COUNTUNIQUEIFS(${C}!B:B,${PER}),0)`, '=SUM(G6:G64)', '=IF(F66=0,0,ROUND(G66/F66,1))',
  ]]);
  s.getRange('A66:J66').setFontWeight('bold').setBackground(STYLE.SUM_BG);
  note(s, 'A67', '※ 봉사활동처 시트에 없는 프로그램은 여기 집계되지 않습니다. 데이터점검 시트에서 확인하세요.');
  fmt(s, 'E6:F66', STYLE.INT); fmt(s, 'G6:H66', STYLE.NUM); fmt(s, 'I6:J64', STYLE.DATE);
  s.setColumnWidth(1, 180);
  s.setFrozenRows(5);
}

// ───────────────────────── 봉사자별실적 ─────────────────────────
function buildByVolunteer(ss) {
  const s = ss.insertSheet(CFG.BY_VOLUNTEER);
  const C = CFG.CALC, R = `'${CFG.ROSTER}'`;
  if (s.getMaxRows() < 320) s.insertRowsAfter(s.getMaxRows(), 320 - s.getMaxRows());
  title(s, 'A1', '봉사자별 실적 (총 시간 순)');
  s.getRange('A2').setValue('연도').setFontWeight('bold');
  s.getRange('B2').setFormula('=YEAR(TODAY())'); inputCell(s, 'B2');
  note(s, 'C2', '← 0을 입력하면 전체 기간');
  s.getRange('A3').setValue('조회 기간').setFontWeight('bold');
  s.getRange('B3:C3').setFormulas([['=IF($B$2=0,DATE(1900,1,1),DATE($B$2,1,1))', '=IF($B$2=0,DATE(2999,12,31),DATE($B$2,12,31))']]);
  fmt(s, 'B3:C3', STYLE.DATE);
  header(s, 'A5:G5', ['봉사자', '활동 건수', '총 시간(h)', '첫 활동', '최근 활동', '참여 프로그램', '명단 등록']);
  const NO = '데이터 없음';
  s.getRange('A6').setFormula(
    `=IFERROR(QUERY(${C}!A2:M,"select B, count(A), sum(F), min(E), max(E) where E >= date '"&TEXT($B$3,"yyyy-mm-dd")&"' and E <= date '"&TEXT($C$3,"yyyy-mm-dd")&"' group by B order by sum(F) desc label B '', count(A) '', sum(F) '', min(E) '', max(E) ''",0),"${NO}")`);
  s.getRange('F6').setFormula(
    `=MAP(A6:A305,LAMBDA(n,IF(OR(n="",n="${NO}"),,IFERROR(TEXTJOIN(", ",TRUE,UNIQUE(FILTER(${C}!C:C,${C}!B:B=n,${C}!E:E>=$B$3,${C}!E:E<=$C$3))),""))))`);
  s.getRange('G6').setFormula(
    `=MAP(A6:A305,LAMBDA(n,IF(OR(n="",n="${NO}"),,IF(COUNTIF(${R}!C:C,n)>0,"등록","명단 없음"))))`);
  fmt(s, 'B6:B305', STYLE.INT); fmt(s, 'C6:C305', STYLE.NUM); fmt(s, 'D6:E305', STYLE.DATE);
  s.setColumnWidth(1, 170); s.setColumnWidth(6, 320);
  s.setFrozenRows(5);
}

// ───────────────────────── 데이터점검 ─────────────────────────
function buildCheck(ss) {
  const s = ss.insertSheet(CFG.CHECK);
  const C = CFG.CALC;
  s.getRange('A1').setValue('데이터 점검 — 아래 항목은 집계에서 빠지거나 왜곡될 수 있으니 활동일지에서 수정하세요')
    .setFontWeight('bold').setFontSize(14).setFontColor('#b3331a');
  s.getRange('A3:A6').setValues([['시간 오류·활동일 누락 행'], ['명단에 없는 봉사자명 (건)'], ['봉사활동처에 없는 프로그램 (건)'], ['VMS 미등록 (건)']]).setFontWeight('bold');
  s.getRange('B3:B6').setFormulas([
    [`=COUNTIFS(${C}!A2:A,"<>",${C}!J2:J,"<>정상")`],
    [`=COUNTIF(${C}!K:K,"명단 없음")`],
    [`=COUNTIF(${C}!M:M,"미등록")`],
    [`=COUNTIF(${C}!L:L,"미등록")`],
  ]).setFontWeight('bold').setFontSize(13).setHorizontalAlignment('right');

  title(s, 'A8', '① 시간 오류 / 활동일 누락', 12);
  title(s, 'H8', '② 명단에 없는 봉사자명', 12);
  title(s, 'K8', '③ 활동처 미등록 프로그램', 12);
  title(s, 'N8', '④ VMS 미등록 활동', 12);
  header(s, 'A9:F9', ['LogID', '봉사자', '프로그램', '활동일', '상태', '활동일지 행'], STYLE.WARN_BG);
  header(s, 'H9:I9', ['봉사자명', '건수'], STYLE.WARN_BG);
  header(s, 'K9:L9', ['프로그램', '건수'], STYLE.WARN_BG);
  header(s, 'N9:Q9', ['LogID', '봉사자', '프로그램', '활동일'], STYLE.WARN_BG);
  s.getRange('A10').setFormula(
    `=IFERROR(QUERY({${C}!A2:J,ARRAYFORMULA(ROW(${C}!A2:A))},"select Col1, Col2, Col3, Col5, Col10, Col11 where Col1 is not null and Col10 <> '정상' order by Col11",0),"없음")`);
  s.getRange('H10').setFormula(
    `=IFERROR(QUERY(${C}!A2:M,"select B, count(A) where K = '명단 없음' group by B order by count(A) desc label B '', count(A) ''",0),"없음")`);
  s.getRange('K10').setFormula(
    `=IFERROR(QUERY(${C}!A2:M,"select C, count(A) where M = '미등록' group by C order by count(A) desc label C '', count(A) ''",0),"없음")`);
  s.getRange('N10').setFormula(
    `=IFERROR(QUERY(${C}!A2:M,"select A, B, C, E where L = '미등록' and A is not null order by E desc",0),"없음")`);
  fmt(s, 'D10:D200', STYLE.DATE); fmt(s, 'Q10:Q200', STYLE.DATE);
  s.setColumnWidth(1, 230); s.setColumnWidth(5, 230);
}

// ═══════════════════════ 보고서 (값 고정 스냅샷 + PDF) ═══════════════════════

function reportThisMonth() {
  const t = new Date();
  createReport(new Date(t.getFullYear(), t.getMonth(), 1), new Date(t.getFullYear(), t.getMonth() + 1, 0), `${t.getFullYear()}년 ${t.getMonth() + 1}월 자원봉사 실적보고`);
}
function reportLastMonth() {
  const t = new Date();
  const s = new Date(t.getFullYear(), t.getMonth() - 1, 1);
  createReport(s, new Date(t.getFullYear(), t.getMonth(), 0), `${s.getFullYear()}년 ${s.getMonth() + 1}월 자원봉사 실적보고`);
}
function reportMonthPrompt() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('월간 보고서', '연-월을 입력하세요 (예: 2026-10)', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const m = r.getResponseText().trim().match(/^(\d{4})-?(\d{1,2})$/);
  if (!m) return ui.alert('형식이 올바르지 않습니다. 예: 2026-10');
  const y = +m[1], mo = +m[2];
  createReport(new Date(y, mo - 1, 1), new Date(y, mo, 0), `${y}년 ${mo}월 자원봉사 실적보고`);
}
function reportYearPrompt() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('연간 보고서', '연도를 입력하세요 (예: 2026)', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const y = parseInt(r.getResponseText().trim(), 10);
  if (!y) return ui.alert('연도를 숫자로 입력하세요.');
  createReport(new Date(y, 0, 1), new Date(y, 11, 31), `${y}년 자원봉사 연간 실적보고`);
}
function reportPeriodPrompt() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('기간 보고서', '시작일~종료일을 입력하세요 (예: 2026-07-01~2026-09-30)', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const m = r.getResponseText().replace(/\s/g, '').match(/^(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})$/);
  if (!m) return ui.alert('형식이 올바르지 않습니다. 예: 2026-07-01~2026-09-30');
  const s = parseYmd(m[1]), e = parseYmd(m[2]);
  createReport(s, e, `${m[1]} ~ ${m[2]} 자원봉사 실적보고`);
}

/**
 * 활동일지를 직접 읽어 기간 실적을 계산합니다 (수식 시트와 독립적으로 동작).
 * @return {{count:number, people:number, hours:number, byProgram:Array, byKind:Object, byVolunteer:Array, byMonth:Array, invalid:Array}}
 */
function getSummary(start, end) {
  const ss = getSS();
  const log = ss.getSheetByName(CFG.LOG);
  const places = ss.getSheetByName(CFG.PLACES);
  const c = CFG.COL;
  const s0 = stripTime(start).getTime(), e0 = stripTime(end).getTime();
  const data = log.getRange(2, 1, Math.max(log.getLastRow() - 1, 1), log.getLastColumn()).getValues();
  const placeMap = {};
  if (places) {
    places.getRange(2, 1, Math.max(places.getLastRow() - 1, 1), 5).getValues().forEach(r => {
      if (r[0]) placeMap[String(r[0]).trim()] = { kind: r[1], team: r[2], manager: r[4] };
    });
  }

  const prog = {}, vol = {}, month = {}, kind = {}, people = {}, invalid = [];
  let count = 0, hours = 0;
  data.forEach((r, i) => {
    const id = r[c.ID - 1];
    if (!id) return;
    const d = r[c.DATE - 1], st = r[c.START - 1], en = r[c.END - 1];
    const name = String(r[c.NAME - 1] || '').trim();
    const p = String(r[c.PROGRAM - 1] || '').trim();
    const k = String(r[c.KIND - 1] || '').trim();
    if (!(d instanceof Date)) { invalid.push({ row: i + 2, id, name, program: p, reason: '활동일 누락' }); return; }
    const t = stripTime(d).getTime();
    if (t < s0 || t > e0) return;
    let h = 0;
    if (st instanceof Date && en instanceof Date && en > st) h = Math.round((en - st) / 36000) / 100;
    else invalid.push({ row: i + 2, id, name, program: p, date: ymd(d), reason: '시간 오류(종료≤시작 또는 누락)' });

    count++; hours += h; people[name] = true;
    const mk = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM');
    bump(prog, p, name, h); bump(vol, name, p, h); bump(month, mk, name, h); bump(kind, k || '미지정', name, h);
  });

  const toRows = (obj, keyName) => Object.keys(obj).map(k => ({
    [keyName]: k, count: obj[k].count, people: Object.keys(obj[k].people).length, hours: round1(obj[k].hours),
    programs: Object.keys(obj[k].people), // byVolunteer에서는 참여 프로그램, 그 외에는 참여자 목록
  }));
  const byProgram = toRows(prog, 'program').map(x => Object.assign(x, placeMap[x.program] || { kind: '', team: '', manager: '(활동처 미등록)' }))
    .sort((a, b) => b.hours - a.hours);
  const byVolunteer = toRows(vol, 'name').sort((a, b) => b.hours - a.hours);
  const byMonth = toRows(month, 'month').sort((a, b) => (a.month < b.month ? -1 : 1));
  const byKind = {};
  Object.keys(kind).forEach(k => { byKind[k] = { count: kind[k].count, people: Object.keys(kind[k].people).length, hours: round1(kind[k].hours) }; });

  return { start: ymd(start), end: ymd(end), count, people: Object.keys(people).length, hours: round1(hours),
    avgHours: Object.keys(people).length ? round1(hours / Object.keys(people).length) : 0,
    byProgram, byKind, byVolunteer, byMonth, invalid };
}

/**
 * 기간 보고서 시트(값 고정)를 만들고, 폴더가 설정되어 있으면 PDF도 저장한다.
 * @param {Object} [opts] { silent: true } 이면 UI 알림을 띄우지 않음 (트리거용)
 * @return {{sheetName:string, summary:Object, pdf:GoogleAppsScript.Drive.File|null}}
 */
function createReport(start, end, titleText, opts) {
  opts = opts || {};
  const ss = getSS();
  const sum = getSummary(start, end);
  const name = `보고서_${ymd(start).replace(/-/g, '')}-${ymd(end).replace(/-/g, '')}`;
  let s = ss.getSheetByName(name);
  if (s) ss.deleteSheet(s);
  s = ss.insertSheet(name, ss.getNumSheets());
  s.setHiddenGridlines(true);

  let r = 1;
  s.getRange(r, 1).setValue((CFG.ORG_NAME ? CFG.ORG_NAME + ' ' : '') + titleText).setFontWeight('bold').setFontSize(18); r++;
  s.getRange(r, 1).setValue(`기간: ${sum.start} ~ ${sum.end}   ·   작성일: ${ymd(new Date())}`).setFontColor('#666666'); r += 2;

  // 핵심 지표
  s.getRange(r, 1, 1, 5).setValues([['활동 건수', '실인원(명)', '총 활동시간(h)', '1인 평균(h)', '활동 프로그램 수']]).setFontWeight('bold').setBackground(STYLE.HEAD_BG); r++;
  s.getRange(r, 1, 1, 5).setValues([[sum.count, sum.people, sum.hours, sum.avgHours, sum.byProgram.length]]).setFontSize(16).setFontWeight('bold'); r += 2;

  // 정기/단기
  s.getRange(r, 1).setValue('구분별').setFontWeight('bold').setFontSize(12); r++;
  s.getRange(r, 1, 1, 4).setValues([['구분', '활동 건수', '실인원', '총 시간(h)']]).setFontWeight('bold').setBackground(STYLE.HEAD_BG); r++;
  const kinds = Object.keys(sum.byKind);
  if (kinds.length) {
    s.getRange(r, 1, kinds.length, 4).setValues(kinds.map(k => [k, sum.byKind[k].count, sum.byKind[k].people, sum.byKind[k].hours]));
    r += kinds.length;
  }
  r++;

  // 월별 (기간이 2개월 이상일 때)
  if (sum.byMonth.length > 1) {
    s.getRange(r, 1).setValue('월별').setFontWeight('bold').setFontSize(12); r++;
    s.getRange(r, 1, 1, 4).setValues([['월', '활동 건수', '실인원', '총 시간(h)']]).setFontWeight('bold').setBackground(STYLE.HEAD_BG); r++;
    s.getRange(r, 1, sum.byMonth.length, 4).setValues(sum.byMonth.map(m => [m.month, m.count, m.people, m.hours]));
    r += sum.byMonth.length + 1;
  }

  // 프로그램별
  s.getRange(r, 1).setValue('프로그램별').setFontWeight('bold').setFontSize(12); r++;
  s.getRange(r, 1, 1, 7).setValues([['프로그램', '구분', '소속', '담당자', '활동 건수', '실인원', '총 시간(h)']]).setFontWeight('bold').setBackground(STYLE.HEAD_BG); r++;
  if (sum.byProgram.length) {
    s.getRange(r, 1, sum.byProgram.length, 7).setValues(sum.byProgram.map(p => [p.program, p.kind, p.team, p.manager, p.count, p.people, p.hours]));
    r += sum.byProgram.length;
  }
  s.getRange(r, 1, 1, 7).setValues([['합계', '', '', '', sum.count, sum.people, sum.hours]]).setFontWeight('bold').setBackground(STYLE.SUM_BG); r += 2;

  // 봉사자별
  s.getRange(r, 1).setValue('봉사자별').setFontWeight('bold').setFontSize(12); r++;
  s.getRange(r, 1, 1, 4).setValues([['봉사자', '활동 건수', '총 시간(h)', '참여 프로그램']]).setFontWeight('bold').setBackground(STYLE.HEAD_BG); r++;
  if (sum.byVolunteer.length) {
    s.getRange(r, 1, sum.byVolunteer.length, 4).setValues(sum.byVolunteer.map(v => [v.name, v.count, v.hours, v.programs.join(', ')]));
    r += sum.byVolunteer.length;
  }
  r++;

  // 데이터 점검
  if (sum.invalid.length) {
    s.getRange(r, 1).setValue(`확인 필요 행 (${sum.invalid.length}건) — 시간은 0으로 계산됨`).setFontWeight('bold').setFontSize(12).setFontColor('#b3331a'); r++;
    s.getRange(r, 1, 1, 5).setValues([['활동일지 행', '봉사자', '프로그램', '활동일', '사유']]).setFontWeight('bold').setBackground(STYLE.WARN_BG); r++;
    s.getRange(r, 1, sum.invalid.length, 5).setValues(sum.invalid.map(x => [x.row, x.name, x.program, x.date || '', x.reason]));
    r += sum.invalid.length;
  }

  s.setColumnWidth(1, 200); s.setColumnWidths(2, 3, 110); s.setColumnWidth(4, 260); s.setColumnWidths(5, 3, 100);
  SpreadsheetApp.flush();

  let pdfMsg = '', pdf = null;
  if (CFG.REPORT_FOLDER_ID) {
    try {
      pdf = exportSheetPdf(ss, s, name);
      pdfMsg = `\n\nPDF 저장: ${pdf.getName()}\n${pdf.getUrl()}`;
    } catch (e) {
      pdfMsg = `\n\n(PDF 저장 실패: ${e.message})`;
    }
  }
  if (!opts.silent) {
    ss.setActiveSheet(s);
    safeAlert('보고서 생성 완료',
      `${titleText}\n\n활동 ${sum.count}건 · 실인원 ${sum.people}명 · 총 ${sum.hours}시간\n시트 "${name}"에 저장했습니다.${pdfMsg}`);
  }
  return { sheetName: name, summary: sum, pdf };
}

/** 특정 시트 1장을 PDF로 내보내 지정 폴더에 저장 */
function exportSheetPdf(ss, sheet, baseName) {
  const url = `https://docs.google.com/spreadsheets/d/${ss.getId()}/export?format=pdf&gid=${sheet.getSheetId()}` +
    '&size=A4&portrait=true&fitw=true&gridlines=false&printtitle=false&sheetnames=false&pagenum=CENTER&top_margin=0.5&bottom_margin=0.5&left_margin=0.5&right_margin=0.5';
  const res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
  const blob = res.getBlob().setName(`${baseName}_${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmm')}.pdf`);
  let folder = DriveApp.getFolderById(CFG.REPORT_FOLDER_ID);
  if (CFG.REPORT_SUBFOLDER) {
    const it = folder.getFoldersByName(CFG.REPORT_SUBFOLDER);
    folder = it.hasNext() ? it.next() : folder.createFolder(CFG.REPORT_SUBFOLDER);
  }
  return folder.createFile(blob);
}

/**
 * 기존 웹앱(doGet)에서 실적 JSON이 필요할 때 호출하세요.
 *   예) if (e.parameter.report) return reportApi(e);
 *   요청: ?report=1&from=2026-10-01&to=2026-10-31   (from/to 생략 시 이번 달)
 */
function reportApi(e) {
  const p = (e && e.parameter) || {};
  const t = new Date();
  const from = p.from ? parseYmd(p.from) : new Date(t.getFullYear(), t.getMonth(), 1);
  const to = p.to ? parseYmd(p.to) : new Date(t.getFullYear(), t.getMonth() + 1, 0);
  const sum = getSummary(from, to);
  // 개인정보 최소화: 외부 응답에는 봉사자 이름 목록을 넣지 않음
  delete sum.byVolunteer; sum.byProgram.forEach(x => delete x.programs); sum.byMonth.forEach(x => delete x.programs);
  return ContentService.createTextOutput(JSON.stringify(sum)).setMimeType(ContentService.MimeType.JSON);
}

// ───────────────────────── 유틸 ─────────────────────────
function bump(map, key, person, h) {
  if (!map[key]) map[key] = { count: 0, hours: 0, people: {} };
  map[key].count++; map[key].hours += h; map[key].people[person] = true;
}
function stripTime(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function ymd(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function parseYmd(s) { const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); return new Date(+m[1], +m[2] - 1, +m[3]); }
function round1(n) { return Math.round(n * 10) / 10; }
