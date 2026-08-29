'use client';

/**
 * Supabase 키가 없을 때 쓰는 로컬 실시간 레이어.
 * 같은 브라우저의 탭끼리 BroadcastChannel + localStorage presence로 동기화합니다.
 * 채널 API는 @supabase/supabase-js 의 channel/broadcast/presence 와 맞춰 둡니다.
 */

function presenceStoreKey(name) {
  return `clean-room-presence:${name}`;
}

function readPresence(name) {
  try {
    return JSON.parse(localStorage.getItem(presenceStoreKey(name)) || '{}');
  } catch {
    return {};
  }
}

function writePresence(name, map) {
  localStorage.setItem(presenceStoreKey(name), JSON.stringify(map));
}

function prunePresence(name) {
  const now = Date.now();
  const raw = readPresence(name);
  const fresh = {};
  for (const [k, v] of Object.entries(raw)) {
    if (now - (v._ts || 0) < 8000) fresh[k] = v;
  }
  writePresence(name, fresh);
  return fresh;
}

function toPresenceState(map) {
  const state = {};
  for (const [k, v] of Object.entries(map)) {
    const { _ts, ...data } = v;
    state[k] = [data];
  }
  return state;
}

export function isRealtimeConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return url.startsWith('https://') && !url.includes('xxxxxxxx') && key.length > 40;
}

export function createLocalClient() {
  return {
    channel(name) {
      const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`clean-room:${name}`) : null;
      const handlers = { presenceSync: [], broadcast: {} };
      let tracked = null;
      let heartbeat = null;
      let onStorage = null;
      let alive = true;
      let presenceState = {};

      const emitPresence = () => {
        presenceState = toPresenceState(prunePresence(name));
        handlers.presenceSync.forEach((fn) => fn());
      };

      const ch = {
        presenceState() {
          return presenceState;
        },
        on(type, filter, cb) {
          if (type === 'presence' && filter?.event === 'sync') handlers.presenceSync.push(cb);
          if (type === 'broadcast' && filter?.event) {
            handlers.broadcast[filter.event] = handlers.broadcast[filter.event] || [];
            handlers.broadcast[filter.event].push(cb);
          }
          return ch;
        },
        async subscribe(cb) {
          if (bc) {
            bc.onmessage = (e) => {
              const { kind, event, payload } = e.data || {};
              if (kind === 'broadcast') {
                (handlers.broadcast[event] || []).forEach((fn) => fn({ payload }));
              }
              if (kind === 'presence') emitPresence();
            };
          }
          onStorage = (e) => {
            if (e.key === presenceStoreKey(name)) emitPresence();
          };
          window.addEventListener('storage', onStorage);
          emitPresence();
          if (cb) await cb('SUBSCRIBED');
          return 'SUBSCRIBED';
        },
        async track(data) {
          tracked = { ...data, _ts: Date.now() };
          const map = prunePresence(name);
          map[data.id] = tracked;
          writePresence(name, map);
          bc?.postMessage({ kind: 'presence' });
          emitPresence();
          heartbeat = setInterval(() => {
            if (!alive || !tracked) return;
            tracked = { ...tracked, _ts: Date.now() };
            const m = prunePresence(name);
            m[tracked.id] = tracked;
            writePresence(name, m);
          }, 2000);
        },
        async send({ event, payload }) {
          const msg = { kind: 'broadcast', event, payload };
          bc?.postMessage(msg);
          // BroadcastChannel는 보낸 탭에 메아리치지 않음. 엔진이 자기 액션을 받도록 로컬 전달.
          (handlers.broadcast[event] || []).forEach((fn) => fn({ payload }));
        },
        unsubscribe() {
          alive = false;
          if (heartbeat) clearInterval(heartbeat);
          if (onStorage) window.removeEventListener('storage', onStorage);
          if (tracked) {
            const m = prunePresence(name);
            delete m[tracked.id];
            writePresence(name, m);
            bc?.postMessage({ kind: 'presence' });
          }
          bc?.close();
        },
      };
      return ch;
    },
    removeChannel(ch) {
      ch?.unsubscribe?.();
    },
  };
}
