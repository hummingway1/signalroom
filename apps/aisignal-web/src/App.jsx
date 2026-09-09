import { useState } from 'react';
import { HomeScreen } from './screens/HomeScreen.jsx';
import { TopicScreen } from './screens/TopicScreen.jsx';
import { ChildInfoScreen } from './screens/ChildInfoScreen.jsx';
import { ChatScreen } from './screens/ChatScreen.jsx';
import { BasicAnalysisScreen } from './screens/BasicAnalysisScreen.jsx';
import { DetailAnalysisScreen } from './screens/DetailAnalysisScreen.jsx';
import { ReturnScreen } from './screens/ReturnScreen.jsx';

// 화면 흐름:
//   home → topic → childInfo → chat → basic → detail
//   basic 진입 이후로는 home 헤더에 "이어보기"가 뜨고, 눌러서 return 화면으로.
//   return → chat(이어서) 또는 topic(새 고민).
export default function App() {
  const [screen, setScreen] = useState('home');
  const [topic, setTopic] = useState('');
  const [childInfo, setChildInfo] = useState(null);
  const [hasHistory, setHasHistory] = useState(false);

  return (
    <div
      className="min-h-screen flex items-start justify-center overflow-x-hidden"
      style={{ background: '#D6EDE7' }}
    >
      {screen === 'home' && (
        <HomeScreen
          onStart={() => setScreen('topic')}
          onReturn={() => setScreen('return')}
          hasHistory={hasHistory}
        />
      )}

      {screen === 'return' && childInfo && (
        <ReturnScreen
          info={childInfo}
          onContinue={() => setScreen('chat')}
          onNew={() => setScreen('topic')}
        />
      )}

      {screen === 'topic' && (
        <TopicScreen
          onSelect={(t) => {
            setTopic(t);
            setScreen('childInfo');
          }}
          onBack={() => setScreen(hasHistory ? 'return' : 'home')}
        />
      )}

      {screen === 'childInfo' && (
        <ChildInfoScreen
          topic={topic}
          onComplete={(info) => {
            setChildInfo(info);
            setScreen('chat');
          }}
          onBack={() => setScreen('topic')}
        />
      )}

      {screen === 'chat' && childInfo && (
        <ChatScreen
          key={`${childInfo.topic}-${childInfo.birthYear}-${childInfo.name}`}
          info={childInfo}
          onShowBasic={() => {
            setHasHistory(true);
            setScreen('basic');
          }}
          onBack={() => setScreen('home')}
        />
      )}

      {screen === 'basic' && childInfo && (
        <BasicAnalysisScreen
          info={childInfo}
          onDetail={() => setScreen('detail')}
          onBack={() => setScreen('chat')}
          onChat={() => setScreen('chat')}
        />
      )}

      {screen === 'detail' && childInfo && (
        <DetailAnalysisScreen info={childInfo} onBack={() => setScreen('basic')} />
      )}
    </div>
  );
}
