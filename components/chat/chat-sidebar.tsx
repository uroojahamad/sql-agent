import { CloseIcon, DatabaseIcon, MoreIcon, PlusIcon } from "./icons";
import type { RecentQuery } from "./types";
import styles from "./chat.module.css";

interface ChatSidebarProps {
  isOpen: boolean;
  recentQueries: RecentQuery[];
  onClose: () => void;
  onNewConversation: () => void;
  onPromptSelect: (prompt: string) => void;
}

export function ChatSidebar({
  isOpen,
  recentQueries,
  onClose,
  onNewConversation,
  onPromptSelect,
}: ChatSidebarProps) {
  return (
    <>
      <button
        type="button"
        className={`${styles.sidebarBackdrop} ${isOpen ? styles.sidebarBackdropOpen : ""}`}
        aria-label="Close navigation"
        onClick={onClose}
      />
      <aside
        className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ""}`}
        aria-label="SQL Agent navigation"
      >
        <div className={styles.brand}>
          <span className={styles.brandMark}>
            <DatabaseIcon size={19} />
          </span>
          <span className={styles.brandName}>SQL Agent</span>
          <span className={styles.brandBadge}>BETA</span>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.sidebarClose}`}
            aria-label="Close navigation"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        <button type="button" className={styles.newChat} onClick={onNewConversation}>
          <PlusIcon />
          New conversation
        </button>

        <section className={styles.sidebarSection} aria-labelledby="connections-label">
          <p className={styles.sidebarLabel} id="connections-label">
            Connections
          </p>
          <a className={styles.sideItem} href="/database">
            <DatabaseIcon size={15} />
            Production DB
            <span className={styles.statusDot} aria-label="Connected" />
          </a>
        </section>

        <section className={styles.sidebarSection} aria-labelledby="recent-label">
          <p className={styles.sidebarLabel} id="recent-label">
            Try asking
          </p>
          <div className={styles.recentList}>
            {recentQueries.map((query) => (
              <button
                className={styles.sideItem}
                key={query.prompt}
                type="button"
                onClick={() => onPromptSelect(query.prompt)}
              >
                {query.label}
              </button>
            ))}
          </div>
        </section>

        <div className={styles.sidebarSpacer} />

        <div className={styles.profile}>
          <span className={styles.avatar}>UA</span>
          <span className={styles.profileCopy}>
            <strong>Urooj Ahamad</strong>
            <span>Workspace admin</span>
          </span>
          <MoreIcon size={14} />
        </div>
      </aside>
    </>
  );
}
