'use client';
import { useState } from 'react';
import { TEMPLATES, fillTemplate, holderVocabulary, meter, BALANCE } from '../lib/game';
import { fogText } from '../lib/useRoom';

// ── 보유자 ── 카드를 혼자 봅니다.
export function HolderView({ st, send, smog }) {
  const [text, setText] = useState('');
  const last = st.questions.filter((q) => !q.voided).slice(-1)[0];
  const answered = st.answers.length >= st.questions.filter((q) => !q.voided).length;

  return (
    <>
      <div className="panel accent">
        <p className="eyebrow">은유 카드 #{st.card.id} — 당신만 보입니다</p>
        <h2>{st.card.situation}</h2>
        <div className="log"><span className="tag">본체</span>{st.card.body}</div>
        <div className="log"><span className="tag">공간</span>{st.card.space}</div>
        <div className="log"><span className="tag">조건</span>{st.card.condition}</div>
      </div>

      <div className="panel">
        <p className="eyebrow">들어온 질문</p>
        <h2>{last ? fogText(last.text, smog) : '아직 없습니다'}</h2>
        <label htmlFor="ans">답변 · 2문장 이내</label>
        <textarea id="ans" rows={3} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="카드에 없는 말을 지어내도 됩니다. 은유는 살아있는 것이니까요." />
        <div style={{ height: 8 }} />
        <button disabled={!last || answered || !text.trim()}
          onClick={() => { send('action', { kind: 'answer', text: text.trim() }); setText(''); }}>
          답변 보내기
        </button>
      </div>
    </>
  );
}

// ── 탐문자 ── 템플릿 12개 + 보유자가 쓴 단어만.
export function ProberView({ st, send, smog }) {
  const [tpl, setTpl] = useState(TEMPLATES[0]);
  const [x, setX] = useState('');
  const [y, setY] = useState('');
  const [busy, setBusy] = useState(false);
  const vocab = holderVocabulary(st.answers.map((a) => a.text));
  const scores = st.questions.filter((q) => !q.voided).map((q) => q.clean);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100;
  const last = st.questions.slice(-1)[0];
  const waiting = st.questions.filter((q) => !q.voided).length > st.answers.length;

  async function ask() {
    const text = fillTemplate(tpl, x, y);
    setBusy(true);
    let judged = { clean: 70, note: '' };
    try {
      const r = await fetch('/api/judge', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: text, holderWords: vocab, answers: st.answers.map((a) => a.text) }),
      });
      judged = await r.json();
    } catch (e) { /* 심판이 죽어도 게임은 계속됩니다 */ }
    send('action', { kind: 'question', text, ...judged });
    setBusy(false); setX(''); setY('');
  }

  return (
    <>
      <div className="panel">
        <div className="between">
          <span className="eyebrow">누적 청정도</span>
          <span className="num" style={{ color: avg < 60 ? 'var(--taint)' : 'var(--clean)' }}>{avg}</span>
        </div>
        <div className={`meter ${avg < 60 ? 'taint' : 'clean'}`}>{meter(avg)}</div>
      </div>

      <div className="panel accent">
        <p className="eyebrow">클린 랭귀지 12</p>
        <div className="tpl-grid">
          {TEMPLATES.map((t) => (
            <button key={t.id} className={`tpl ${tpl.id === t.id ? 'on' : ''}`} onClick={() => setTpl(t)}>
              {t.text.replace('{X}', 'X').replace('{Y}', 'Y')}
            </button>
          ))}
        </div>

        <label>X — 보유자가 쓴 단어만</label>
        <select value={x} onChange={(e) => setX(e.target.value)}>
          <option value="">{vocab.length ? '선택하세요' : '첫 질문은 자유롭게 입력'}</option>
          {vocab.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
        {!vocab.length && (
          <input style={{ marginTop: 6 }} value={x} onChange={(e) => setX(e.target.value)} placeholder="예: 그것" />
        )}
        {tpl.slots === 2 && (
          <>
            <label>Y</label>
            <select value={y} onChange={(e) => setY(e.target.value)}>
              <option value="">선택하세요</option>
              {vocab.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </>
        )}

        <div className="panel" style={{ margin: '12px 0 0', background: 'var(--paper)' }}>
          {fillTemplate(tpl, x, y)}
        </div>
        <div style={{ height: 8 }} />
        <button onClick={ask} disabled={busy || waiting || !x}>
          {busy ? '심판 채점 중…' : waiting ? '답변 기다리는 중' : '질문 보내기'}
        </button>
      </div>

      {last && (
        <div className={`panel ${last.clean < 60 ? 'warn' : ''}`}>
          <div className="between">
            <span className="eyebrow">직전 질문</span>
            <span className="num" style={{ color: last.clean < 60 ? 'var(--taint)' : 'var(--clean)' }}>{last.clean}</span>
          </div>
          <p style={{ color: 'var(--ink)' }}>{last.note}</p>
        </div>
      )}

      <div className="panel">
        <p className="eyebrow">답변 로그</p>
        {st.answers.map((a, i) => <div key={i} className="log"><span className="tag">A{i + 1}</span>{fogText(a.text, smog)}</div>)}
        {!st.answers.length && <p>아직 없습니다.</p>}
      </div>
    </>
  );
}

// ── 감시자 ── 오염을 잡습니다. 라운드 3에는 옆 팟을 감시합니다.
export function WatcherView({ st, send, pollution, crossWatch }) {
  return (
    <>
      <div className="panel warn">
        <div className="between">
          <span className="eyebrow">전체 오염 · 10팟 공용</span>
          <span className="num" style={{ color: 'var(--taint)' }}>{Math.round(pollution)}%</span>
        </div>
        <div className="meter taint">{meter(pollution)}</div>
        <p style={{ fontSize: 13 }}>{BALANCE.smogThreshold}% 돌파 시 모든 팟에 스모그가 낍니다.</p>
      </div>

      {crossWatch && (
        <div className="panel accent">
          <p className="eyebrow">라운드 3 — 교차 감시</p>
          <p style={{ color: 'var(--ink)' }}>지금 당신은 옆 팟을 감시합니다. 성공 시 우리 팟 +20, 상대 팟 −10.</p>
        </div>
      )}

      <div className="panel">
        <div className="between">
          <span className="eyebrow">질문 로그</span>
          <span className="num">챌린지 {'●'.repeat(st.challengesLeft)}{'○'.repeat(BALANCE.challengesPerRound - st.challengesLeft)}</span>
        </div>
        {[...st.questions].reverse().map((q) => (
          <div key={q.id} className={`log ${q.voided ? 'voided' : ''}`}>
            <span className="tag">청정 {q.clean}</span>{q.text}
            {!q.voided && st.challengesLeft > 0 && (
              <div style={{ marginTop: 6 }}>
                <button className="small danger" onClick={() => send('action', { kind: 'challenge', qid: q.id })}>
                  챌린지
                </button>
              </div>
            )}
          </div>
        ))}
        {!st.questions.length && <p>아직 질문이 없습니다.</p>}
      </div>
      <p style={{ fontSize: 13 }}>성공 +15점, 오염 게이지 −3%. 실패하면 탐문 시간 15초를 잃습니다.</p>
    </>
  );
}

// ── 복원자 ── 답변만 보입니다. 질문은 보이지 않습니다.
export function RestorerView({ st, send, smog }) {
  const [g, setG] = useState({ body: '', space: '', condition: '' });
  const [busy, setBusy] = useState(false);
  const done = !!st.restore;

  async function submit() {
    setBusy(true);
    let scores = { body: 50, space: 50, condition: 50, note: '' };
    try {
      const r = await fetch('/api/restore', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ truth: st.card, guess: g }),
      });
      scores = await r.json();
    } catch (e) { /* 중립 처리 */ }
    send('action', { kind: 'restore', guess: g, scores });
    setBusy(false);
  }

  return (
    <>
      <div className="panel accent">
        <p className="eyebrow">답변만 보입니다 · 질문은 가려져 있습니다</p>
        {st.answers.map((a, i) => <div key={i} className="log"><span className="tag">A{i + 1}</span>{fogText(a.text, smog)}</div>)}
        {!st.answers.length && <p>보유자의 답변을 기다리는 중.</p>}
      </div>

      <div className="panel">
        <label>본체 — 무엇에 비유되었나</label>
        <input value={g.body} onChange={(e) => setG({ ...g, body: e.target.value })} disabled={done} />
        <label>공간 — 어디에 있나</label>
        <input value={g.space} onChange={(e) => setG({ ...g, space: e.target.value })} disabled={done} />
        <label>조건 — 무엇이 있어야 달라지나</label>
        <input value={g.condition} onChange={(e) => setG({ ...g, condition: e.target.value })} disabled={done} />
        <div style={{ height: 12 }} />
        <button onClick={submit} disabled={busy || done || st.phase !== 'restore'}>
          {done ? '제출 완료' : busy ? '채점 중…' : st.phase === 'restore' ? '복원 제출' : '복원 단계에서 열립니다'}
        </button>
      </div>
    </>
  );
}
