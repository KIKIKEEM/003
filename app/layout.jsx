import './globals.css';

export const metadata = {
  title: 'CLEAN ROOM — 오염 탐지기',
  description: '다른 사람의 은유를 복원하라. 당신의 언어를 섞지 않고.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
