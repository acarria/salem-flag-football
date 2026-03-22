'use client';

import React from 'react';

export interface InlineTableColumn {
  key: string;
  label: string;
  width?: string;
  renderView?: (row: any) => React.ReactNode;
  renderEdit?: (row: any, draft: any, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void) => React.ReactNode;
  renderNewRow?: (draft: any, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void) => React.ReactNode;
}

interface InlineTableProps {
  columns: InlineTableColumn[];
  rows: any[];
  rowKey: string;
  editingRowId: string | null;
  onStartEdit: (row: any) => void;
  onSaveEdit: (rowId: string) => void;
  onCancelEdit: () => void;
  onDelete: (rowId: string) => void;
  onAddRow?: () => void;
  isAddingRow?: boolean;
  newRowContent?: any;
  onNewRowChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onSaveNewRow?: () => void;
  onCancelNewRow?: () => void;
  isSaving?: boolean;
  addLabel?: string;
  emptyState?: React.ReactNode;
}

export default function InlineTable({
  columns,
  rows,
  rowKey,
  editingRowId,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onAddRow,
  isAddingRow = false,
  newRowContent,
  onNewRowChange,
  onSaveNewRow,
  onCancelNewRow,
  isSaving = false,
  addLabel = 'Add row',
  emptyState,
}: InlineTableProps) {
  const actionCellClass = 'text-xs text-[#A0A0A0] hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors';

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/5">
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left py-2.5 px-3 text-xs uppercase tracking-wider text-[#6B6B6B] font-medium"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
            <th className="w-28" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && !isAddingRow && (
            <tr>
              <td colSpan={columns.length + 1} className="py-8 text-center">
                {emptyState ?? (
                  <span className="text-sm text-[#6B6B6B]">No items yet.</span>
                )}
              </td>
            </tr>
          )}

          {rows.map((row) => {
            const id = row[rowKey];
            const isEditing = editingRowId === id;

            return (
              <tr
                key={id}
                className={`admin-row ${isEditing ? 'bg-white/[0.04]' : ''}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="py-2.5 px-3 text-sm">
                    {isEditing && col.renderEdit
                      ? col.renderEdit(row, row, (e) => {})
                      : col.renderView
                      ? col.renderView(row)
                      : row[col.key]}
                  </td>
                ))}
                <td className="py-2 px-3">
                  <div className="flex items-center gap-1 justify-end">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => onSaveEdit(id)}
                          disabled={isSaving}
                          className={actionCellClass + ' text-accent hover:text-accent'}
                        >
                          {isSaving ? 'Saving…' : 'Save'}
                        </button>
                        <button onClick={onCancelEdit} className={actionCellClass}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => onStartEdit(row)}
                          disabled={!!editingRowId || isAddingRow}
                          className={actionCellClass + ' disabled:opacity-30'}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(id)}
                          disabled={!!editingRowId || isAddingRow}
                          className={actionCellClass + ' hover:text-red-400 disabled:opacity-30'}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}

          {/* New-row input row */}
          {isAddingRow && (
            <tr className="bg-white/[0.04] border-b border-white/5">
              {columns.map((col) => (
                <td key={col.key} className="py-2.5 px-3 text-sm">
                  {col.renderNewRow && onNewRowChange
                    ? col.renderNewRow(newRowContent, onNewRowChange)
                    : null}
                </td>
              ))}
              <td className="py-2 px-3">
                <div className="flex items-center gap-1 justify-end">
                  <button
                    onClick={onSaveNewRow}
                    disabled={isSaving}
                    className={actionCellClass + ' text-accent hover:text-accent'}
                  >
                    {isSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={onCancelNewRow} className={actionCellClass}>
                    Cancel
                  </button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {onAddRow && !isAddingRow && (
        <button
          onClick={onAddRow}
          disabled={!!editingRowId}
          className="mt-3 text-xs text-[#6B6B6B] hover:text-white transition-colors disabled:opacity-30 flex items-center gap-1.5"
        >
          <span className="text-base leading-none">+</span>
          <span>{addLabel}</span>
        </button>
      )}
    </div>
  );
}
