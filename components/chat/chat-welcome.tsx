import { ChartIcon, DatabaseIcon, SalesIcon, SearchIcon, SparkIcon } from "./icons";
import type { ChatPromptOption } from "./types";
import styles from "./chat.module.css";

interface ChatWelcomeProps {
  suggestions: ChatPromptOption[];
  onPromptSelect: (prompt: string) => void;
}

const suggestionIcons = {
  chart: ChartIcon,
  search: SearchIcon,
  sales: SalesIcon,
};

export function ChatWelcome({ suggestions, onPromptSelect }: ChatWelcomeProps) {
  return (
    <section className={styles.emptyState} aria-labelledby="welcome-title">
      <div className={styles.hero}>
        <div className={styles.heroVisual} aria-hidden="true">
          <div className={styles.heroGlow} />
          <div className={styles.orbit} />
          <div className={styles.databaseVisual}>
            <DatabaseIcon size={40} />
            <SparkIcon className={styles.spark} />
          </div>
        </div>
        <span className={styles.eyebrow}>AI-powered database assistant</span>
        <h1 id="welcome-title">
          Turn questions into <span className={styles.gradientText}>clear answers.</span>
        </h1>
        <p className={styles.heroDescription}>
          Ask about your categories, products, inventory, and sales in plain English.
          SQL Agent securely queries your data and explains the result.
        </p>

        <div className={styles.suggestions} aria-label="Example questions">
          {suggestions.map((suggestion) => {
            const Icon = suggestionIcons[suggestion.icon];

            return (
              <button
                className={styles.suggestion}
                key={suggestion.prompt}
                type="button"
                onClick={() => onPromptSelect(suggestion.prompt)}
              >
                <span className={styles.suggestionIcon}>
                  <Icon />
                </span>
                <strong>{suggestion.title}</strong>
                <span>{suggestion.description}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
