import './TableSkeleton.css';

const ROWS = 6;

export default function TableSkeleton({ rows = ROWS }) {
  return (
    <tbody className="table-skeleton">
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {/* User */}
          <td>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="skeleton table-skeleton__avatar" />
              <div style={{ flex: 1 }}>
                <div className="skeleton table-skeleton__text table-skeleton__text--md" />
                <div className="skeleton table-skeleton__text table-skeleton__text--sm" style={{ marginTop: 4 }} />
              </div>
            </div>
          </td>
          {/* Email */}
          <td>
            <div className="skeleton table-skeleton__text table-skeleton__text--sm" />
          </td>
          {/* Branch */}
          <td>
            <div className="skeleton table-skeleton__text table-skeleton__text--sm" style={{ width: '70%' }} />
          </td>
          {/* Role */}
          <td>
            <div style={{ display: 'flex', gap: 4 }}>
              <div className="skeleton table-skeleton__badge" />
            </div>
          </td>
          {/* Status */}
          <td>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="skeleton table-skeleton__badge" />
              <div className="skeleton table-skeleton__btn" />
            </div>
          </td>
          {/* Date */}
          <td>
            <div className="skeleton table-skeleton__text table-skeleton__text--sm" style={{ width: '80%' }} />
          </td>
          {/* Actions */}
          <td>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <div className="skeleton table-skeleton__btn" />
              <div className="skeleton table-skeleton__btn" />
              <div className="skeleton table-skeleton__btn" />
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  );
}
