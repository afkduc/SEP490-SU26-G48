import './TableSkeleton.css';

const ROWS = 6;

export default function TableSkeleton({ rows = ROWS, columns }) {
  const cols =
    Array.isArray(columns) && columns.length > 0
      ? columns
      : ['Người dùng', 'Chi nhánh', 'Vai trò', 'Trạng thái', 'Hành động'];
  return (
    <div className="table-skeleton-wrap">
      <div className="table-scroll">
        <table className="table table--skeleton">
          <thead>
            <tr>
              {cols.map((c, i) => (
                <th key={i}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="table-skeleton">
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i}>
                {/* User */}
                <td data-label={cols[0] || 'Col 1'}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="skeleton table-skeleton__avatar" />
                    <div style={{ flex: 1 }}>
                      <div className="skeleton table-skeleton__text table-skeleton__text--md" />
                      <div
                        className="skeleton table-skeleton__text table-skeleton__text--sm"
                        style={{ marginTop: 4 }}
                      />
                    </div>
                  </div>
                </td>
                {/* Email */}
                <td data-label={cols[1] || 'Col 2'}>
                  <div className="skeleton table-skeleton__text table-skeleton__text--sm" />
                </td>
                {/* Branch */}
                <td data-label={cols[2] || 'Col 3'}>
                  <div
                    className="skeleton table-skeleton__text table-skeleton__text--sm"
                    style={{ width: '70%' }}
                  />
                </td>
                {/* Role */}
                <td data-label={cols[3] || 'Col 4'}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <div className="skeleton table-skeleton__badge" />
                  </div>
                </td>
                {/* Status */}
                <td data-label={cols[4] || 'Col 5'}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="skeleton table-skeleton__badge" />
                    <div className="skeleton table-skeleton__btn" />
                  </div>
                </td>
                {/* Date */}
                <td data-label={cols[5] || 'Col 6'}>
                  <div
                    className="skeleton table-skeleton__text table-skeleton__text--sm"
                    style={{ width: '80%' }}
                  />
                </td>
                {/* Actions */}
                <td data-label={cols[6] || 'Col 7'}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <div className="skeleton table-skeleton__btn" />
                    <div className="skeleton table-skeleton__btn" />
                    <div className="skeleton table-skeleton__btn" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
