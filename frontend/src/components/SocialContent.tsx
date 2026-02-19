import { useState } from 'react';
import { FeedTab } from './FeedTab';
import { FriendsTab } from './FriendsTab';
import { LeaderboardTab } from './LeaderboardTab';
import styles from './SocialContent.module.css';

type Tab = 'feed' | 'friends' | 'leaderboard';

const TABS: { id: Tab; label: string }[] = [
  { id: 'feed', label: 'Feed' },
  { id: 'friends', label: 'Friends' },
  { id: 'leaderboard', label: 'Leaderboard' },
];

export function SocialContent() {
  const [activeTab, setActiveTab] = useState<Tab>('feed');

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Social</h1>
      <div role="tablist" className={styles.tabList} aria-label="Social sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tab-panel-${tab.id}`}
            className={activeTab === tab.id ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {TABS.map((tab) => (
        <div
          key={tab.id}
          id={`tab-panel-${tab.id}`}
          role="tabpanel"
          aria-label={tab.label}
          className={styles.tabPanel}
          hidden={activeTab !== tab.id}
        >
          {tab.id === 'feed' && <FeedTab />}
          {tab.id === 'friends' && <FriendsTab />}
          {tab.id === 'leaderboard' && <LeaderboardTab />}
        </div>
      ))}
    </div>
  );
}
