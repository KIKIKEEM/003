'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { makeRoomCode } from '../lib/game';
import { isLocalMode } from '../lib/useRoom';

export default function Home() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [local, setLocal] = useState(false);
  const router = useRouter();

  useEffect(() => { setLocal(isLocalMode()); }, []);

  const go = (c) => {
    if (!name.trim()) return;
    sessionStorage.setItem('cr-name', name.trim());
    router.push(`/room/${c.toUpperCase()}`);
  };

  return (
    <div className="wrap">
      <div className="bar">
        <span>C L E A N &nbsp; R O O M</span>
        <span className="spacer" />
        <span>4인 협동 · 10팟 경쟁</span>
      </div>

      <p className="eyebrow">Metaphor &amp; Clean Language</p>
      <h1>오염 탐지기</h1>
      <p>다른 사람의 은유를 복원하세요. 당신의 언어를 단 한 글자도 섞지 않고.</p>

      <div className="panel accent">
        <label htmlFor="nm">이름</label>
        <input id="nm" value={name} onChange={(e) => setName(e.target.value)} placeholder="화면에 표시될 이름" />

        <label htmlFor="cd">팟 코드</label>
        <div className="row">
          <input id="cd" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD" maxLength={4} />
          <button className="small" onClick={() => go(code)} disabled={!name.trim() || code.length < 4}>
            들어가기
          </button>
        </div>
      </div>

      <button className="ghost" onClick={() => go(makeRoomCode())} disabled={!name.trim()}>
        새 팟 열기
      </button>
      {local && (
        <div className="panel">
          <p className="eyebrow">로컬 모드</p>
          <p style={{ color: 'var(--ink)' }}>
            Supabase 키가 없어 이 브라우저의 탭끼리만 연결됩니다. 탭을 여러 개 열고 같은 팟 코드로 들어오면 바로 플레이할 수 있습니다.
          </p>
        </div>
      )}
      <p style={{ fontSize: 13 }}>먼저 들어온 사람의 기기가 진행을 맡습니다. 혼자 시작해도 되고, 4명이 모이면 역할이 나뉩니다.</p>
      <p style={{ fontSize: 13 }}><a href="/host">호스트 화면</a></p>
    </div>
  );
}
