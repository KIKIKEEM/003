'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useRoom, useGlobalPollution } from '../../../lib/useRoom';
import {
  BALANCE, ROLE_LABEL, ROLE_BRIEF, roleFor, roundScore, newRoundState, meter,
} from '../../../lib/game';
import cards from '../../../data/cards.json';
import { HolderView, ProberView, WatcherView, RestorerView } from '../../../components/Views';

const NEXT = { deal: 'probe', probe: 'restore', restore: 'settle' };

export default function Room() {
  const { code } = useParams();
  const [name, setName] = useState('');
  useEffect(() => { setName(sessionStorage.getItem('cr-name') || '익명'); }, []);

  const stateRef = useRef(null);
  const [total, setTotal] = useState(0);
  const [avgClean, setAvgClean] = useState(100);
  const engineRef = useRef(false);

  const { members, seatIndex, state, setState, isEngine, send } = useRoom({
    code, name, onAction: (a) => engineRef.current && applyAction(a),
  });
  engineRef.current = isEngine;
  stateRef.current = state;

  const { pollution, smog, pollute } = useGlobalPollution({ podCode: code, score: total, clean: avgClean });

  const push = useCallback((next) => {
    stateRef.current = next;
    setState(next);
    send('state', next);
  }, [send, setState]);

  // ── 엔진: 액션 처리 ─────────────────────────────
  function applyAction(a) {
    const st = stateRef.current;
    if (!st) return;
    if (a.kind === 'question') {
      const q = { id: Date.now(), text: a.text, clean: a.clean, note: a.note, voided: false };
      if (a.clean < 50) pollute(BALANCE.pollutionPerBadQuestion);
      push({ ...st, questions: [...st.questions, q] });
    }
    if (a.kind === 'answer') {
      push({ ...st, answers: [...st.answers, { text: a.text }] });
    }
    if (a.kind === 'challenge') {
      const q = st.questions.find((x) => x.id === a.qid);
      if (!q || st.challengesLeft <= 0) return;
      const win = q.clean < 60;
      if (win) pollute(-BALANCE.pollutionCleanse);
      push({
        ...st,
        challengesLeft: st.challengesLeft - 1,
        challengeWins: st.challengeWins + (win ? 1 : 0),
        questions: st.questions.map((x) => (x.id === a.qid ? { ...x, voided: win } : x)),
        phaseEndsAt: win ? st.phaseEndsAt : st.phaseEndsAt - BALANCE.challengePenaltySec * 1000,
      });
    }
    if (a.kind === 'restore') {
      push({ ...st, restore: { guess: a.guess, scores: a.scores } });
    }
  }

  // ── 엔진: 페이즈 타이머 ─────────────────────────
  useEffect(() => {
    if (!isEngine) return;
    const t = setInterval(() => {
      const st = stateRef.current;
      if (!st || !st.started || st.phase === 'end') return;
      if (Date.now() < st.phaseEndsAt) return;

      if (st.phase === 'settle') {
        if (st.round >= BALANCE.rounds) { push({ ...st, phase: 'end' }); return; }
        const nr = newRoundState(st.round + 1, cards[(st.round + Math.floor(Math.random() * 4)) % cards.length]);
        push({ ...st, ...nr, started: true, history: st.history });
        return;
      }

      const phase = NEXT[st.phase];
      let history = st.history || [];
      if (phase === 'settle') {
        const s = st.restore?.scores || {};
        const pts = roundScore({
          restoreScores: [s.body || 0, s.space || 0, s.condition || 0],
          cleanScores: st.questions.filter((q) => !q.voided).map((q) => q.clean),
          challengeWins: st.challengeWins,
          round: st.round,
        });
        history = [...history, { round: st.round, pts, note: st.restore?.scores?.note || '' }];
      }
      push({ ...st, phase, history, phaseEndsAt: Date.now() + BALANCE.phase[phase] * 1000 });
    }, 500);
    return () => clearInterval(t);
  }, [isEngine, push]);

  // 리더보드 송신용 집계
  useEffect(() => {
    if (!state) return;
    setTotal((state.history || []).reduce((a, h) => a + h.pts, 0));
    const cs = state.questions?.filter((q) => !q.voided).map((q) => q.clean) || [];
    setAvgClean(cs.length ? Math.round(cs.reduce((a, b) => a + b, 0) / cs.length) : 100);
  }, [state]);

  const [left, setLeft] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setLeft(state?.phaseEndsAt ? Math.max(0, Math.ceil((state.phaseEndsAt - Date.now()) / 1000)) : 0);
    }, 250);
    return () => clearInterval(t);
  }, [state]);

  const start = () => push({
    started: true, history: [],
    ...newRoundState(1, cards[Math.floor(Math.random() * cards.length)]),
  });

  const mmss = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
  const role = state?.started ? roleFor(seatIndex, state.round) : null;

  return (
    <div className="wrap">
      {smog && <><div className="smog" /><div className="smog-label">S M O G &nbsp; 전체 오염 임계 초과</div></>}

      <div className="bar">
        <span>팟 {code}</span>
        {state?.started && <span>R{state.round}/{BALANCE.rounds}</span>}
        <span className="spacer" />
        {state?.started && <span className={`timer ${left <= 10 ? 'low' : ''}`}>{mmss}</span>}
      </div>

      {!state?.started && (
        <>
          <p className="eyebrow">대기실</p>
          <h1>팟 {code}</h1>
          <p>이 코드를 팀원에게 알려주세요. 혼자 시작해도 됩니다.</p>
          <div className="panel">
            {members.map((m, i) => (
              <div key={m.id} className="log">
                <span className="tag">{String(i + 1).padStart(2, '0')}</span>{m.name}
                {i === 0 && <span className="tag" style={{ marginLeft: 8 }}>진행 기기</span>}
              </div>
            ))}
          </div>
          {isEngine
            ? <button onClick={start} disabled={members.length < 1}>게임 시작 ({members.length}/4)</button>
            : <p>진행 기기가 시작하기를 기다리는 중입니다.</p>}
        </>
      )}

      {state?.started && state.phase !== 'end' && (
        <>
          <div className="between">
            <span className="role-tag">{ROLE_LABEL[role]}</span>
            <span className="num">{total}점</span>
          </div>
          <p style={{ fontSize: 13 }}>{ROLE_BRIEF[role]}</p>

          {state.phase === 'deal' && (
            <div className="panel accent">
              <p className="eyebrow">배부</p>
              <h2>{ROLE_LABEL[role]} 자리입니다</h2>
              <p>{ROLE_BRIEF[role]}</p>
            </div>
          )}

          {(state.phase === 'probe' || state.phase === 'restore') && (
            <>
              {role === 'holder' && <HolderView st={state} send={send} smog={smog} />}
              {role === 'prober' && <ProberView st={state} send={send} smog={smog} />}
              {role === 'watcher' && (
                <WatcherView st={state} send={send} pollution={pollution}
                  crossWatch={state.round === BALANCE.crossWatchRound} />
              )}
              {role === 'restorer' && <RestorerView st={state} send={send} smog={smog} />}
            </>
          )}

          {state.phase === 'settle' && (
            <div className="panel accent">
              <p className="eyebrow">정산 · 라운드 {state.round}</p>
              <h2>{(state.history || []).slice(-1)[0]?.pts ?? 0}점</h2>
              <div className="log"><span className="tag">원본 본체</span>{state.card.body}</div>
              <div className="log"><span className="tag">복원</span>{state.restore?.guess?.body || '미제출'}</div>
              <p style={{ color: 'var(--ink)' }}>{state.restore?.scores?.note}</p>
              <div className="meter clean">{meter(avgClean)} 청정 {avgClean}</div>
            </div>
          )}
        </>
      )}

      {state?.phase === 'end' && (
        <>
          <p className="eyebrow">종료</p>
          <h1>{total}점</h1>
          {(state.history || []).map((h) => (
            <div key={h.round} className="log"><span className="tag">R{h.round}</span>{h.pts}점 — {h.note}</div>
          ))}
        </>
      )}
    </div>
  );
}
