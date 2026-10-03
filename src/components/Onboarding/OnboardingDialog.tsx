import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';

import ui from '@/components/ui.module.css';
import { ONBOARDING, type Role, ROLES } from '@/content/vi';
import { useAppPrefs } from '@/contexts/AppPrefsContext';

import s from './OnboardingDialog.module.css';

const ROLE_KEYS = Object.keys(ROLES) as Role[];

export function OnboardingDialog() {
  const { isGuideOpen, closeGuide, role, setRole } = useAppPrefs();
  const [step, setStep] = useState(0);
  const current = ONBOARDING[step]!;
  const isLast = step === ONBOARDING.length - 1;

  function handleOpenChange(open: boolean) {
    if (open) return;
    closeGuide();
    setStep(0);
  }

  function handleNext() {
    if (isLast) {
      handleOpenChange(false);
      return;
    }
    setStep((prev) => prev + 1);
  }

  function handlePickRole(next: Role) {
    setRole(next);
    setStep(1);
  }

  return (
    <Dialog.Root open={isGuideOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={s.overlay} />
        <Dialog.Content className={s.content}>
          <p className={s.step}>
            Bước {step + 1} / {ONBOARDING.length}
          </p>
          <Dialog.Title className={s.title}>{current.title}</Dialog.Title>
          <Dialog.Description className={s.body}>{current.body}</Dialog.Description>

          {step === 0 && (
            <div className={s.roles} role="group" aria-label="Chọn vai trò">
              {ROLE_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`${ui.btn} ${ui.secondary} ${s.roleBtn}`}
                  aria-pressed={role === key}
                  onClick={() => handlePickRole(key)}
                >
                  {ROLES[key]}
                </button>
              ))}
            </div>
          )}

          <div className={s.footer}>
            <div className={s.dots} aria-hidden="true">
              {ONBOARDING.map((item, i) => (
                <span key={item.title} className={i === step ? `${s.dot} ${s.dotOn}` : s.dot} />
              ))}
            </div>
            <div className={ui.actions}>
              <Dialog.Close className={`${ui.btn} ${ui.ghost}`}>Bỏ qua</Dialog.Close>
              {step > 0 && (
                <button
                  type="button"
                  className={`${ui.btn} ${ui.secondary}`}
                  onClick={() => setStep((p) => p - 1)}
                >
                  Quay lại
                </button>
              )}
              <button type="button" className={`${ui.btn} ${ui.primary}`} onClick={handleNext}>
                {isLast ? 'Bắt đầu' : 'Tiếp'}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
