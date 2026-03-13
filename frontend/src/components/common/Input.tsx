import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export default function Input({
  label,
  error,
  helperText,
  className = '',
  ...props
}: InputProps) {
  const inputClasses = `w-full px-3 py-2 bg-[#1E1E1E] border rounded-md focus:outline-none focus:ring-0 focus:border-accent/40 text-white placeholder:text-[#6B6B6B] transition-colors ${
    error ? 'border-red-500/60' : 'border-white/10'
  } ${className}`;

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-xs font-medium text-[#A0A0A0]">
          {label}
        </label>
      )}
      <input className={inputClasses} {...props} />
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-xs text-[#6B6B6B]">{helperText}</p>
      )}
    </div>
  );
}
