'use client';

import React from 'react';
import { inputCls, inputErrCls, labelCls } from '@/utils/formStyles';

type EmailErrorType = string | { message: string; suggestion: string };

type GroupPlayer = { first_name: string; last_name: string; email: string };

interface GroupRegistrationFormProps {
  group_name: string;
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
  group_name,
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
  const getVisibleError = (field: string): string | EmailErrorType | undefined => {
    if (!submitAttempted && !touched[field]) return undefined;
    return fieldErrors[field];
  };

  return (
    <>
      <div>
        <label htmlFor="group_name" className={labelCls}>Group Name</label>
        <input
          id="group_name"
          className={getVisibleError('group_name') ? inputErrCls : inputCls}
          name="group_name"
          placeholder="e.g. The Friends, Work Buddies"
          value={group_name}
          onChange={e => onGroupNameChange(e.target.value)}
          onBlur={() => onBlur('group_name')}
          autoComplete="off"
        />
        {getVisibleError('group_name') && (
          <p className="text-red-400 text-xs mt-1">{getVisibleError('group_name') as string}</p>
        )}
      </div>

      {group.map((player, idx) => (
        <div key={`invitee-${idx}-${player.email || idx}`} className="border-t border-white/5 pt-4 space-y-3">
          <div className="section-label">Invitee {idx + 1}</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`invitee-${idx}-first_name`} className={labelCls}>First Name</label>
              <input
                id={`invitee-${idx}-first_name`}
                className={getVisibleError(`player${idx}_first_name`) ? inputErrCls : inputCls}
                name="first_name"
                placeholder="First"
                value={player.first_name}
                onChange={e => onInput(e, idx)}
                onBlur={() => onBlur(`player${idx}_first_name`)}
                autoComplete="off"
              />
              {getVisibleError(`player${idx}_first_name`) && (
                <p className="text-red-400 text-xs mt-1">{getVisibleError(`player${idx}_first_name`) as string}</p>
              )}
            </div>
            <div>
              <label htmlFor={`invitee-${idx}-last_name`} className={labelCls}>Last Name</label>
              <input
                id={`invitee-${idx}-last_name`}
                className={getVisibleError(`player${idx}_last_name`) ? inputErrCls : inputCls}
                name="last_name"
                placeholder="Last"
                value={player.last_name}
                onChange={e => onInput(e, idx)}
                onBlur={() => onBlur(`player${idx}_last_name`)}
                autoComplete="off"
              />
              {getVisibleError(`player${idx}_last_name`) && (
                <p className="text-red-400 text-xs mt-1">{getVisibleError(`player${idx}_last_name`) as string}</p>
              )}
            </div>
          </div>
          <div>
            <label htmlFor={`invitee-${idx}-email`} className={labelCls}>Email</label>
            <input
              id={`invitee-${idx}-email`}
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
