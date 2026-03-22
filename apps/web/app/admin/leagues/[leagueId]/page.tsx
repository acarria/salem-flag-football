'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import BaseLayout from '@/components/layout/BaseLayout';
import { League, LeagueMember, Field, Team, LeagueSchedule } from '@/services';
import { useAuthenticatedApi } from '@/hooks/useAuthenticatedApi';

import OverviewSection from './components/OverviewSection';
import MembersSection from './components/MembersSection';
import LeagueFieldsSection from './components/LeagueFieldsSection';
import TeamsSection from './components/TeamsSection';
import ScheduleSection from './components/ScheduleSection';

export default function LeagueAdminPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { request: authenticatedRequest } = useAuthenticatedApi();

  const [activeSection, setActiveSection] = useState('overview');
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [allFields, setAllFields] = useState<Field[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [schedule, setSchedule] = useState<LeagueSchedule | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  useEffect(() => {
    if (!isSignedIn || !leagueId) { router.replace('/admin'); return; }
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, leagueId]);

  const loadAll = async () => {
    if (!leagueId) return;
    setIsLoading(true);
    try {
      const [leagueData, membersData, fieldsData, allFieldsData, teamsData, scheduleData] = await Promise.all([
        authenticatedRequest<League>(`/admin/leagues/${leagueId}`),
        authenticatedRequest<LeagueMember[]>(`/admin/leagues/${leagueId}/members`),
        authenticatedRequest<Field[]>(`/admin/leagues/${leagueId}/fields`),
        authenticatedRequest<Field[]>('/admin/fields'),
        authenticatedRequest<Team[]>(`/admin/leagues/${leagueId}/teams`),
        authenticatedRequest<LeagueSchedule>(`/admin/leagues/${leagueId}/schedule`).catch(() => null),
      ]);
      setLeague(leagueData);
      setMembers(membersData);
      setFields(fieldsData);
      setAllFields(allFieldsData);
      setTeams(teamsData);
      setSchedule(scheduleData);
    } catch {
      setError('Failed to load league data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );

    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [league]);

  if (!isSignedIn || (!league && !isLoading)) return null;
  if (isLoading && !league) {
    return (
      <BaseLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-sm text-[#6B6B6B]">Loading&#8230;</div>
        </div>
      </BaseLayout>
    );
  }
  if (!league) return null;

  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'members', label: 'Members' },
    { id: 'fields', label: 'Fields' },
    { id: 'teams', label: 'Teams' },
    { id: 'schedule', label: 'Schedule' },
  ];

  return (
    <BaseLayout>
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <aside className="hidden lg:flex flex-col sticky top-14 h-[calc(100vh-3.5rem)] w-56 bg-[#0D0D0D] border-r border-white/5 p-6 flex-shrink-0">
          <Link
            href="/admin"
            className="text-xs text-[#6B6B6B] hover:text-white transition-colors flex items-center gap-1.5 mb-6"
          >
            &#8592; Dashboard
          </Link>

          <div className="mb-1">
            <div className="text-sm font-semibold text-white truncate">{league.name}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`status-dot ${league.is_active ? 'bg-accent' : 'bg-[#6B6B6B]'}`} />
              <span className="text-xs text-[#6B6B6B]">{league.is_active ? 'Active' : 'Inactive'}</span>
            </div>
          </div>

          <hr className="border-white/5 my-4" />

          <nav className="space-y-0.5">
            {sections.map((sec) => (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                  activeSection === sec.id
                    ? 'text-white bg-white/5'
                    : 'text-[#6B6B6B] hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                {sec.label}
              </a>
            ))}
          </nav>
        </aside>

        <main className="flex-1 px-6 lg:px-10 py-8 space-y-16 max-w-4xl">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex justify-between">
              {error}
              <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400 ml-4">&#x2715;</button>
            </div>
          )}
          {success && (
            <div className="p-3 bg-accent/10 border border-accent/20 rounded-lg text-accent text-sm flex justify-between">
              {success}
              <button onClick={() => setSuccess(null)} className="text-accent/60 hover:text-accent ml-4">&#x2715;</button>
            </div>
          )}

          {/* Overview */}
          <section
            id="overview"
            className="scroll-mt-20"
            ref={(el) => { sectionRefs.current.overview = el; }}
          >
            <OverviewSection
              league={league}
              onUpdate={(updated) => setLeague(updated)}
              authenticatedRequest={authenticatedRequest}
              setError={setError}
              setSuccess={setSuccess}
            />
          </section>

          {/* Members */}
          <section
            id="members"
            className="scroll-mt-20"
            ref={(el) => { sectionRefs.current.members = el; }}
          >
            <MembersSection
              members={members}
              leagueId={leagueId}
              authenticatedRequest={authenticatedRequest}
              onRefresh={(data) => setMembers(data)}
            />
          </section>

          {/* Fields */}
          <section
            id="fields"
            className="scroll-mt-20"
            ref={(el) => { sectionRefs.current.fields = el; }}
          >
            <LeagueFieldsSection
              fields={fields}
              allFields={allFields}
              leagueId={leagueId}
              authenticatedRequest={authenticatedRequest}
              onRefresh={(f, af) => { setFields(f); setAllFields(af); }}
              setError={setError}
              setSuccess={setSuccess}
            />
          </section>

          {/* Teams */}
          <section
            id="teams"
            className="scroll-mt-20"
            ref={(el) => { sectionRefs.current.teams = el; }}
          >
            <TeamsSection
              teams={teams}
              leagueId={leagueId}
              authenticatedRequest={authenticatedRequest}
              onRefresh={(data) => setTeams(data)}
              setError={setError}
              setSuccess={setSuccess}
            />
          </section>

          {/* Schedule */}
          <section
            id="schedule"
            className="scroll-mt-20"
            ref={(el) => { sectionRefs.current.schedule = el; }}
          >
            <ScheduleSection
              schedule={schedule}
              leagueId={leagueId}
              authenticatedRequest={authenticatedRequest}
              onRefresh={(data) => setSchedule(data)}
              setError={setError}
              setSuccess={setSuccess}
            />
          </section>
        </main>
      </div>
    </BaseLayout>
  );
}
