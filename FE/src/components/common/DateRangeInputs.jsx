import { useEffect, useRef } from 'react';
import { nextDateRangeState, normalizeDateRange } from '../../utils/dateRange';

/**
 * Hai ô type="date". Nếu từ ngày > đến ngày thì tự đổi chỗ trên UI.
 */
export default function DateRangeInputs({
  startDate = '',
  endDate = '',
  onChange,
  startTitle = 'Từ ngày',
  endTitle = 'Đến ngày',
  className = '',
  inputClassName = '',
  sepClassName = '',
  sep = '—',
}) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Bảo hiểm: state lệch (start > end) → ép swap lại trên UI
  useEffect(() => {
    const normalized = normalizeDateRange(startDate, endDate);
    if (!normalized.swapped) return;
    onChangeRef.current?.({
      startDate: normalized.startDate,
      endDate: normalized.endDate,
    });
  }, [startDate, endDate]);

  function handleStart(e) {
    const next = nextDateRangeState('start', e.target.value, { startDate, endDate });
    onChangeRef.current?.({ startDate: next.startDate, endDate: next.endDate });
  }

  function handleEnd(e) {
    const next = nextDateRangeState('end', e.target.value, { startDate, endDate });
    onChangeRef.current?.({ startDate: next.startDate, endDate: next.endDate });
  }

  return (
    <div className={className}>
      <input
        type="date"
        className={inputClassName}
        value={startDate || ''}
        onChange={handleStart}
        title={startTitle}
        aria-label={startTitle}
      />
      <span className={sepClassName}>{sep}</span>
      <input
        type="date"
        className={inputClassName}
        value={endDate || ''}
        onChange={handleEnd}
        title={endTitle}
        aria-label={endTitle}
      />
    </div>
  );
}
