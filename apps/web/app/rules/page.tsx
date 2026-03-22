import React from 'react';
import BaseLayout from '@/components/layout/BaseLayout';

export default function RulesPage() {
  return (
    <BaseLayout>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="section-label mb-2">LEAGUE RULES</div>
        <h1 className="text-3xl font-semibold text-white mb-12">How We Play</h1>

        <section className="mb-16">
          <h2 className="text-lg font-semibold text-white mb-8 border-t border-white/10 pt-5">
            How is Flag Different from Tackle?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            <div className="border-t border-white/10 pt-5 space-y-2 md:pr-8 mb-8">
              <div className="text-xs font-mono text-[#6B6B6B] mb-3">01</div>
              <h3 className="text-base font-semibold text-white">No Contact</h3>
              <p className="text-sm text-[#A0A0A0] leading-relaxed">
                There is no tackling, blocking, or physical contact of any kind. Defenders stop the ball carrier by pulling one of two flags from a belt worn around the waist.
              </p>
            </div>
            <div className="border-t border-white/10 pt-5 space-y-2 md:pl-8 mb-8">
              <div className="text-xs font-mono text-[#6B6B6B] mb-3">02</div>
              <h3 className="text-base font-semibold text-white">Rush Rules</h3>
              <p className="text-sm text-[#A0A0A0] leading-relaxed">
                Defensive players must be at least seven yards from the line of scrimmage when the ball is snapped. Only one player may rush the quarterback per play unless a blitz is called.
              </p>
            </div>
            <div className="border-t border-white/10 pt-5 space-y-2 md:pr-8 mb-8">
              <div className="text-xs font-mono text-[#6B6B6B] mb-3">03</div>
              <h3 className="text-base font-semibold text-white">Scoring</h3>
              <p className="text-sm text-[#A0A0A0] leading-relaxed">
                Touchdowns are worth six points. Teams may attempt a one-point conversion from the five-yard line or a two-point conversion from the ten-yard line after each score.
              </p>
            </div>
            <div className="border-t border-white/10 pt-5 space-y-2 md:pl-8 mb-8">
              <div className="text-xs font-mono text-[#6B6B6B] mb-3">04</div>
              <h3 className="text-base font-semibold text-white">Game Format</h3>
              <p className="text-sm text-[#A0A0A0] leading-relaxed">
                Games consist of two 20-minute halves with a running clock. Each team has four downs to cross midfield and then four downs to score. No punting — turnovers on downs begin at the offense's own five-yard line.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-6 border-t border-white/10 pt-5">
            Official Rulebooks
          </h2>
          <p className="text-sm text-[#A0A0A0] mb-6 leading-relaxed">
            The Salem Flag Football League follows USA Football's official flag football rules. Download the relevant rulebook below for the complete rule set.
          </p>
          <div className="space-y-3">
            <div className="border-t border-white/5 pt-3">
              <a
                href="https://usafootball.com/wp-content/uploads/2022/01/USA-Football-Flag-Rules-Adult.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent hover:text-white transition-colors flex items-center gap-1.5"
              >
                USA Football Adult Flag Rules (PDF) <span>&#8594;</span>
              </a>
            </div>
            <div className="border-t border-white/5 pt-3">
              <a
                href="https://usafootball.com/wp-content/uploads/2022/01/USA-Football-Flag-Rules-Youth.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent hover:text-white transition-colors flex items-center gap-1.5"
              >
                USA Football Youth Flag Rules (PDF) <span>&#8594;</span>
              </a>
            </div>
          </div>
        </section>
      </div>
    </BaseLayout>
  );
}
