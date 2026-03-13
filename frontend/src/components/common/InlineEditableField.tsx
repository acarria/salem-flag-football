import React from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface InlineEditableFieldProps {
  label: string;
  value: string | number | undefined;
  displayValue?: string;
  isEditing: boolean;
  type?: 'text' | 'number' | 'date' | 'select' | 'textarea';
  name: string;
  options?: SelectOption[];
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  [key: string]: any;
}

export default function InlineEditableField({
  label,
  value,
  displayValue,
  isEditing,
  type = 'text',
  name,
  options,
  onChange,
  ...inputProps
}: InlineEditableFieldProps) {
  const inputClasses =
    'w-full px-2.5 py-1.5 bg-[#1E1E1E] border border-white/10 focus:border-accent/40 text-white text-sm rounded-md outline-none transition-colors';

  return (
    <div className="space-y-1">
      <div className="text-xs text-[#6B6B6B]">{label}</div>
      {isEditing ? (
        type === 'select' ? (
          <select
            name={name}
            value={value as string}
            onChange={onChange}
            className={inputClasses + ' bg-[#1E1E1E]'}
            {...inputProps}
          >
            {options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : type === 'textarea' ? (
          <textarea
            name={name}
            value={value as string}
            onChange={onChange}
            rows={3}
            className={inputClasses + ' resize-none'}
            {...inputProps}
          />
        ) : (
          <input
            type={type}
            name={name}
            value={value as string | number}
            onChange={onChange}
            className={inputClasses}
            {...inputProps}
          />
        )
      ) : (
        <div className="text-sm font-medium text-white">
          {displayValue ?? (value !== undefined && value !== '' ? String(value) : '—')}
        </div>
      )}
    </div>
  );
}
