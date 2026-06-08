'use client';

import { LastMeetingSnapshot, DiscussionTopic } from '@/types';
import styles from './ContinuationAssistant.module.css';

interface Props {
  snapshot: LastMeetingSnapshot;
  isOpen: boolean;
  onClose: () => void;
  onSelectTopic: (topic: DiscussionTopic) => void;
}

export function ContinuationAssistant({
  snapshot,
  isOpen,
  onClose,
  onSelectTopic,
}: Props) {
  if (!isOpen) return null;

  const handleTopicClick = (topic: DiscussionTopic) => {
    onSelectTopic(topic);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>Last Meeting Summary</h2>
            <p className={styles.subtitle}>{snapshot.clientName} • {snapshot.date}</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            [Close]
          </button>
        </header>

        <div className={styles.content}>
          {/* Overall Summary */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Overall Summary</h3>
            <p className={styles.summary}>{snapshot.overallSummary}</p>
          </section>

          {/* Key Takeaways */}
          {snapshot.keyTakeaways.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Key Takeaways</h3>
              <ul className={styles.list}>
                {snapshot.keyTakeaways.map((takeaway, idx) => (
                  <li key={idx} className={styles.listItem}>
                    {takeaway}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Pending Tasks */}
          {snapshot.pendingTasks.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Pending Tasks</h3>
              <div className={styles.itemGrid}>
                {snapshot.pendingTasks.map((task, idx) => (
                  <div key={idx} className={styles.taskCard}>
                    <div className={styles.taskText}>{task.task}</div>
                    <div className={styles.taskMeta}>
                      <span className={styles.owner}>Owner: {task.owner}</span>
                      {task.deadline && <span className={styles.deadline}>Due: {task.deadline}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Unresolved Decisions */}
          {snapshot.unresolvedDecisions.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Unresolved Decisions</h3>
              <div className={styles.itemGrid}>
                {snapshot.unresolvedDecisions.map((decision, idx) => (
                  <div key={idx} className={styles.decisionCard}>
                    <div className={styles.decisionText}>{decision.decision}</div>
                    <div className={styles.context}>{decision.context}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Risks */}
          {snapshot.risks.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Identified Risks</h3>
              <ul className={styles.list}>
                {snapshot.risks.map((risk, idx) => (
                  <li key={idx} className={styles.listItem + ' ' + styles.riskItem}>
                    {risk}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Discussion Topics */}
          {snapshot.discussionTopics.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>💬 Discussion Topics</h3>
              <div className={styles.topicsGrid}>
                {snapshot.discussionTopics.map((topic, idx) => (
                  <button
                    key={idx}
                    className={styles.topicCard}
                    onClick={() => handleTopicClick(topic)}
                  >
                    <div className={styles.topicTitle}>{topic.topic}</div>
                    <div className={styles.topicSummary}>{topic.summary}</div>
                    {topic.suggestedNextSteps && topic.suggestedNextSteps.length > 0 && (
                      <div className={styles.nextSteps}>
                        <div className={styles.stepsLabel}>Next Steps:</div>
                        <ul className={styles.stepsList}>
                          {topic.suggestedNextSteps.map((step, stepIdx) => (
                            <li key={stepIdx}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        <footer className={styles.footer}>
          <button className={styles.actionBtn} onClick={onClose}>
            Ready to continue
          </button>
        </footer>
      </div>
    </div>
  );
}
