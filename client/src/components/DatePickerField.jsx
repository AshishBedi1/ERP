import { useRef } from 'react';

export function CalendarIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5"
      />
    </svg>
  );
}

const LEAVE_INPUT_CLASS =
  'w-full min-h-[44px] cursor-pointer rounded-xl border border-slate-600 bg-slate-950 py-2.5 pl-3 pr-12 text-sm text-slate-100 [color-scheme:dark] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer';

const MODAL_INPUT_CLASS =
  'erp-input-inline min-h-[44px] cursor-pointer pr-12 [color-scheme:light] dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer';

const LEAVE_LABEL_CLASS = 'block text-[11px] font-medium uppercase tracking-wide text-slate-500';

const MODAL_LABEL_CLASS =
  'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400';

const LEAVE_ICON_BTN =
  'absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-slate-200';

const MODAL_ICON_BTN =
  'absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-300/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200';

const WRAPPER = {
  leave: 'w-full min-w-0 sm:w-auto sm:min-w-[11rem]',
  modal: 'w-full',
};

/**
 * Native date input with a visible calendar button — same pattern as employee leave apply (showPicker + overlay icon).
 * @param {'leave'|'modal'} [variant='leave'] — "leave" matches EmployeeLeave dark panel; "modal" matches Holidays / erp-input-inline.
 */
export default function DatePickerField({
  id,
  label,
  value,
  onChange,
  min,
  required,
  variant = 'leave',
  className,
  inputClassName,
  labelClassName,
  iconButtonClassName,
}) {
  const inputRef = useRef(null);

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch {
        /* fallback */
      }
    }
    el.focus();
    el.click();
  };

  const v = variant === 'modal' ? 'modal' : 'leave';
  const inputClass = inputClassName ?? (v === 'modal' ? MODAL_INPUT_CLASS : LEAVE_INPUT_CLASS);
  const labelClass = labelClassName ?? (v === 'modal' ? MODAL_LABEL_CLASS : LEAVE_LABEL_CLASS);
  const iconBtnClass = iconButtonClassName ?? (v === 'modal' ? MODAL_ICON_BTN : LEAVE_ICON_BTN);
  const wrapClass = [WRAPPER[v], className].filter(Boolean).join(' ');

  return (
    <div className={wrapClass}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className={`relative ${v === 'leave' ? 'mt-1' : ''}`}>
        <input
          ref={inputRef}
          id={id}
          type="date"
          value={value}
          {...(min ? { min } : {})}
          {...(required ? { required: true } : {})}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
        <button
          type="button"
          onClick={openPicker}
          className={iconBtnClass}
          aria-label={`Open calendar for ${label}`}
        >
          <CalendarIcon />
        </button>
      </div>
    </div>
  );
}
