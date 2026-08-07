import { useEffect, useRef, useState } from 'react';
import { nextDateRangeState, normalizeDateRange } from '../../utils/dateRange';

/**
 * Hai ô type="date". Nếu từ ngày > đến ngày thì tự đổi chỗ ngay trên UI.
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

  // key tăng khi swap → buộc browser vẽ lại value đúng (tránh kẹt UI date native)
  const [paintKey, setPaintKey] = useState(0);

  function emit(nextStart, nextEnd, swapped) {
    onChangeRef.current?.({ startDate: nextStart, endDate: nextEnd });
    if (swapped) setPaintKey((k) => k + 1);
  }

  // Bảo hiểm: props lệch → ép parent swap
  useEffect(() => {
    const normalized = normalizeDateRange(startDate, endDate);
    if (!normalized.swapped) return;
    emit(normalized.startDate, normalized.endDate, true);
  }, [startDate, endDate]);

  function handleStart(e) {
    const value = e.target.value;
    const next = nextDateRangeState('start', value, { startDate, endDate });
    emit(next.startDate, next.endDate, next.swapped);
  }

  function handleEnd(e) {
    const value = e.target.value;
    const next = nextDateRangeState('end', value, { startDate, endDate });
    emit(next.startDate, next.endDate, next.swapped);
  }

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        key={`start-${paintKey}-${startDate}`}
        type="date"
        className={inputClassName}
        value={startDate || ''}
        onChange={handleStart}
        onBlur={handleStart}
        title={startTitle}
        aria-label={startTitle}
      />
      <span className={sepClassName}>{sep}</span>
      <input
        key={`end-${paintKey}-${endDate}`}
        type="date"
        className={inputClassName}
        value={endDate || ''}
        onChange={handleEnd}
        onBlur={handleEnd}
        title={endTitle}
        aria-label={endTitle}
      />
    </div>
  );
}
