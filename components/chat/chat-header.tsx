import { DatabaseIcon, MenuIcon, MoreIcon } from "./icons";
import styles from "./chat.module.css";

interface ChatHeaderProps {
  title: string;
  onOpenMenu: () => void;
}

export function ChatHeader({ title, onOpenMenu }: ChatHeaderProps) {
  return (
    <header className={styles.topbar}>
      <button
        className={`${styles.iconButton} ${styles.mobileMenu}`}
        type="button"
        aria-label="Open navigation"
        onClick={onOpenMenu}
      >
        <MenuIcon />
      </button>
      <div className={styles.conversationTitle}>
        <strong>{title}</strong>
        <span>SQL Agent · Gemini 3.5 Flash Lite</span>
      </div>
      <div className={styles.topbarActions}>
        <a className={styles.connectionPill} href="/database" title="View database records">
          <span className={styles.statusDot} />
          Production DB
        </a>
        <a
          className={styles.iconButton}
          href="/database"
          aria-label="View database records"
          title="View database records"
        >
          <DatabaseIcon size={16} />
        </a>
        <span className={styles.headerMore} aria-hidden="true">
          <MoreIcon size={16} />
        </span>
      </div>
    </header>
  );
}
