import { getLang, t } from '../app/i18n';
import { RULES } from '../app/rules';
import { Sheet } from './common';

export function RulesSheet({ onClose }: { onClose(): void }) {
  return (
    <Sheet onClose={onClose} title={t('rules')}>
      <div class="rules">
        {RULES[getLang()].map(r => (
          <section key={r.title}>
            <h3>{r.title}</h3>
            <p>{r.body}</p>
          </section>
        ))}
      </div>
      <button class="btn primary wide" onClick={onClose}>{t('close')}</button>
    </Sheet>
  );
}
