import React from 'react';
import BaseLayout from './layout/BaseLayout';

export default function TestPage() {
  return (
    <BaseLayout>
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-3xl font-bold text-pumpkin mb-6">Test Page</h1>
        <p className="text-white mb-4">
          This is a test page to verify that the BaseLayout component works correctly.
        </p>
        <div className="bg-gunmetal bg-opacity-95 border-2 border-pumpkin rounded-xl p-6">
          <h2 className="text-xl font-bold text-pumpkin mb-4">BaseLayout Features</h2>
          <ul className="text-white space-y-2">
            <li>✅ Consistent header with logo and navigation</li>
            <li>✅ Admin button (only visible to admin users)</li>
            <li>✅ User authentication controls</li>
            <li>✅ Background image and styling</li>
            <li>✅ Footer with links</li>
            <li>✅ Admin dashboard modal</li>
          </ul>
        </div>
      </div>
    </BaseLayout>
  );
} 