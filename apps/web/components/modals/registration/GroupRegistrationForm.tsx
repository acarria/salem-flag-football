'use client';

import React from 'react';

type EmailErrorType = string | { message: string; suggestion: string };

type GroupPlayer = { firstName: string; lastName: string; email: string };

interface GroupRegistrationFormProps {
  groupName: string;
  group: GroupPlayer[];
  maxInvitees: number;
  fieldErrors: { [key: string]: string | EmailErrorType };
  touched: { [key: string]: boolean };
  submitAttempted: boolean;
  onGroupNameChange: (value: string) => void;
  onInput: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>, idx?: number) => void;
  onBlur: (field: string) => void;
  onAddPlayer: () => void;
  onRemovePlayer: (idx: number) => void;
  onGroupChange: (updater: (prev: GroupPlayer[]) => GroupPlayer[]) => void;
}

const MIN_GROUP_SIZE = 1;

export default function GroupRegistrationForm({
  groupName,
  group,
  maxInvitees,
  fieldErrors,
  touched,
  submitAttempted,
  onGroupNameChange,
  onInput,
  onBlur,
  onAddPlayer,
  onRemovePlayer,
  onGroupChange,
}: GroupRegistrationFormProps) {
  const inputCls = 'w-full px-3 py-2 bg-[#1E1E1E] border border-white/10 focus:border-accent/40 text-white text-sm rounded-md outline-none transition-colors placeholder:text-[#6B6B6B]';
  const inputErrCls = 'w-full px-3 py-2 bg-[#1E1E1E] border border-red-500/60 focus:border-red-500/80 text-white text-sm rounded-md outline-none transition-colors placeholder:text-[#6B6B6B]';
  const labelCls = 'block text-xs font-medium text-[#A0A0A0] mb-1';

  const getVisibleError = (field: string): string | EmailErrorType | undefined => {
    if (!submitAttempted && !touched[field]) return undefined;
    return fieldErrors[field];
  };

  return (
    <>
      <div>
        <label className={labelCls}>Group Name</label>
        <input
          className={getVisibleError('groupName') ? inputErrCls : inputCls}
          name="groupName"
          placeholder="e.g. The Friends, Work Buddies"
          value={groupName}
          onChange={e => onGroupNameChange(e.target.value)}
          onBlur={() => onBlur('groupName')}
          autoComplete="off"
        />
        {getVisibleError('groupName') && (
          <p className="text-red-400 text-xs mt-1">{getVisibleError('groupName') as string}</p>
        )}
      </div>

      {group.map((player, idx) => (
        <div key={idx} className="border-t border-white/5 pt-4 space-y-3">
          <div className="section-label">Invitee {idx + 1}</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>First Name</label>
              <input
                className={getVisibleError(`player${idx}_firstName`) ? inputErrCls : inputCls}
                name="firstName"
                placeholder="First"
                value={player.firstName}
                onChange={e => onInput(e, idx)}
                onBlur={() => onBlur(`player${idx}_firstName`)}
                autoComplete="off"
              />
              {getVisibleError(`player${idx}_firstName`) && (
                <p className="text-red-400 text-xs mt-1">{getVisibleError(`player${idx}_firstName`) as string}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Last Name</label>
              <input
                className={getVisibleError(`player${idx}_lastName`) ? inputErrCls : inputCls}
                name="lastName"
                placeholder="Last"
                value={player.lastName}
                onChange={e => onInput(e, idx)}
                onBlur={() => onBlur(`player${idx}_lastName`)}
                autoComplete="off"
              />
              {getVisibleError(`player${idx}_lastName`) && (
                <p className="text-red-400 text-xs mt-1">{getVisibleError(`player${idx}_lastName`) as string}</p>
              )}
            </div>
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input
              className={getVisibleError(`player${idx}_email`) ? inputErrCls : inputCls}
              name="email"
              placeholder="invitee@example.com"
              value={player.email}
              onChange={e => onInput(e, idx)}
              onBlur={() => onBlur(`player${idx}_email`)}
              autoComplete="off"
              type="email"
            />
            {(() => {
              const err = getVisibleError(`player${idx}_email`);
              if (!err) return null;
              if (typeof err === 'object' && 'suggestion' in err) {
                return (
                  <p className="text-red-400 text-xs mt-1">
                    {err.message}{' '}
                    <button
                      type="button"
                      className="underline text-[#A0A0A0] hover:text-white"
                      onClick={() => {
                        onGroupChange(prev => {
                          const updated = [...prev];
                          updated[idx] = { ...updated[idx], email: err.suggestion };
                          return updated;
                        });
                      }}
                    >
                      Use suggestion
                    </button>
                  </p>
                );
              }
              return <p className="text-red-400 text-xs mt-1">{err as string}</p>;
            })()}
          </div>
        </div>
      ))}

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onAddPlayer}
          className="text-sm text-[#A0A0A0] hover:text-white transition-colors disabled:opacity-40"
          disabled={group.length >= maxInvitees}
        >
          + Add invitee ({group.length}/{maxInvitees})
        </button>
        {group.length > MIN_GROUP_SIZE && (
          <button
            type="button"
            onClick={() => onRemovePlayer(group.length - 1)}
            className="text-sm text-[#6B6B6B] hover:text-red-400 transition-colors"
          >
            Remove last
          </button>
        )}
      </div>
    </>
  );
}
