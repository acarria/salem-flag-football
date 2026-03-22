import React from 'react';
import BaseLayout from '@/components/layout/BaseLayout';

export default function InfoPage() {
  return (
    <BaseLayout>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="section-label mb-2">ABOUT THE LEAGUE</div>
        <h1 className="text-3xl font-semibold text-white mb-12">League Info</h1>

        <section className="mb-16">
          <h2 className="text-lg font-semibold text-white mb-5 border-t border-white/10 pt-5">
            About Salem Flag Football
          </h2>
          <div className="space-y-4 text-sm text-[#A0A0A0] leading-relaxed">
            <p>
              Salem Flag Football was founded by Alex Carria, a Salem resident of over eleven years who noticed a gap in the city's adult sports scene. With plenty of passion for the game and no shortage of open-field space at Salem Common, Alex set out to build something the community had been missing: a competitive but welcoming flag football league for adults of all skill levels.
            </p>
            <p>
              What started as a single spring season has grown into a multi-season operation, with plans to run several leagues per year across different skill brackets and formats. The goal is simple — give people in Salem a reason to get outside, compete, and connect with their neighbors.
            </p>
            <p>
              Whether you're a former high school quarterback looking to relive some glory or someone who has never played a down of organized football, there is a place for you here.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-5 border-t border-white/10 pt-5">
            Funding & Transparency
          </h2>
          <p className="text-sm text-[#A0A0A0] leading-relaxed mb-6">
            Registration fees are the league's only source of income. Every dollar collected goes directly back into running the season. Here's where it goes:
          </p>
          <ul className="space-y-3">
            {[
              'Liability insurance required to use public park facilities',
              'City permitting fees for scheduled field use at Salem Common',
              'Equipment — flags, footballs, cones, and first-aid supplies',
              'Player jerseys and team kits included with registration',
              'Website hosting and platform costs to keep this site running',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-[#A0A0A0]">
                <span className="status-dot bg-accent mt-1.5 shrink-0"></span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </BaseLayout>
  );
}
