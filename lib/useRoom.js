'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BALANCE } from './game';
import { createLocalClient, isRealtimeConfigured } from './localRealtime';

// 빌드 시점에는 환경변수가 없어도 통과해야 합니다.
// 키가 없으면 같은 브라우저의 탭끼리 도는 로컬 실시간 레이어로 자동 폴백합니다.
export const supabaseConfigured = isRealtimeConfigured();

let realtime = null;
function getRealtime() {
  if (realtime) return realtime;
  if (typeof window === 'undefined') return null;
  realtime = isRealtimeConfigured()
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        realtime: { params: { eventsPerSecond: 20 } },
      })
    : createLocalClient();
  return realtime;
}

export function isLocalMode() {
  return typeof window !== 'undefined' && !isRealtimeConfigured();
}

const GLOBAL = 'clean-room-global';

/**
 * 팟 하나의 실시간 연결.
 * 스키마도 인증도 필요 없습니다. Realtime broadcast + presence만 씁니다.
 *
 * 엔진 선출: presence에 먼저 들어온 사람이 엔진이 되어 상태를 소유하고
 * 매 변경마다 전체 상태를 broadcast 합니다. 나머지는 action만 보냅니다.
 */
export function useRoom({ code, name, onAction }) {
  const [members, setMembers] = useState([]);
  const [state, setState] = useState(null);
  const [isEngine, setIsEngine] = useState(false);
  const channelRef = useRef(null);
  const meRef = useRef({ id: Math.random().toString(36).slice(2), joinedAt: Date.now() });

  useEffect(() => {
    if (!code || !name) return;
    const me = meRef.current;
    const rt = getRealtime();
    if (!rt) return;
    const ch = rt.channel(`pod-${code}`, {
      config: { presence: { key: me.id }, broadcast: { self: true } },
    });
    channelRef.current = ch;

    ch.on('presence', { event: 'sync' }, () => {
      const raw = ch.presenceState();
      const list = Object.values(raw)
        .map((v) => v[0])
        .filter(Boolean)
        .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
      setMembers(list);
      setIsEngine(list.length > 0 && list[0].id === me.id);
    });

    ch.on('broadcast', { event: 'state' }, ({ payload }) => setState(payload));
    ch.on('broadcast', { event: 'action' }, ({ payload }) => {
      if (onAction) onAction(payload);
    });

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ id: me.id, name, joinedAt: me.joinedAt });
      }
    });

    return () => { rt.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, name]);

  const send = useCallback((event, payload) => {
    channelRef.current?.send({ type: 'broadcast', event, payload });
  }, []);

  const seatIndex = members.findIndex((m) => m.id === meRef.current.id);

  return { members, seatIndex, me: meRef.current, state, setState, isEngine, send };
}

/**
 * 10팟이 공유하는 오염 게이지. 어떤 팟이든 오염 이벤트를 쏘면
 * 모든 화면이 같은 값으로 올라갑니다. 호스트 서버 없이 동작합니다.
 */
export function useGlobalPollution({ podCode, score = 0, clean = 100 }) {
  const [pollution, setPollution] = useState(0);
  const [board, setBoard] = useState({});
  const chRef = useRef(null);

  useEffect(() => {
    const rt = getRealtime();
    if (!rt) return;
    const ch = rt.channel(GLOBAL, { config: { broadcast: { self: false } } });
    chRef.current = ch;
    ch.on('broadcast', { event: 'pollute' }, ({ payload }) => {
      setPollution((p) => Math.max(0, Math.min(100, p + payload.amount)));
    });
    ch.on('broadcast', { event: 'board' }, ({ payload }) => {
      setBoard((b) => ({ ...b, [payload.pod]: payload }));
    });
    ch.on('broadcast', { event: 'ping' }, () => {
      if (podCode) ch.send({ type: 'broadcast', event: 'board', payload: { pod: podCode, score, clean } });
    });
    ch.subscribe();
    const decay = setInterval(
      () => setPollution((p) => Math.max(0, p - BALANCE.pollutionDecayPer15s)),
      15000
    );
    return () => { clearInterval(decay); rt.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podCode]);

  // 점수가 바뀌면 리더보드에 알립니다.
  useEffect(() => {
    if (!podCode) return;
    chRef.current?.send({ type: 'broadcast', event: 'board', payload: { pod: podCode, score, clean } });
  }, [podCode, score, clean]);

  const pollute = useCallback((amount) => {
    chRef.current?.send({ type: 'broadcast', event: 'pollute', payload: { amount } });
    setPollution((p) => Math.max(0, Math.min(100, p + amount)));
  }, []);

  const requestBoard = useCallback(() => {
    chRef.current?.send({ type: 'broadcast', event: 'ping', payload: {} });
  }, []);

  const smog = pollution >= BALANCE.smogThreshold;
  return { pollution, smog, pollute, board, requestBoard };
}

// 스모그가 낀 동안 답변의 명사 일부를 가립니다.
export function fogText(text, on) {
  if (!on) return text;
  return text
    .split(' ')
    .map((w, i) => (w.length > 1 && i % 3 === 1 ? '█'.repeat(w.length) : w))
    .join(' ');
}
