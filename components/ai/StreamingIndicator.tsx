import React from 'react';

export const StreamingIndicator: React.FC = () => (
  <div className="inline-flex items-center gap-2 text-sm text-indigo-600 font-semibold">
    <span className="flex gap-0.5">
      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0ms]" />
      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:150ms]" />
      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:300ms]" />
    </span>
    AI генерира…
  </div>
);
