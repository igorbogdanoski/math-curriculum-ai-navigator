import React from 'react';
import { Card } from './Card';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  message: string;
  children?: React.ReactNode; // For CTA button
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message, children }) => {
  return (
    <Card className="text-center py-16 flex flex-col items-center">
      <div className="bg-gray-100 text-gray-400 rounded-full p-4 mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
      <p className="text-gray-500 mt-2 max-w-sm">{message}</p>
      {children && <div className="mt-6">{children}</div>}
    </Card>
  );
};
