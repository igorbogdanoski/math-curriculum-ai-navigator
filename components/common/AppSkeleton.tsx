import React from 'react';

const PulseBlock: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`bg-gray-200 rounded animate-pulse ${className}`}></div>
);

export const AppSkeleton: React.FC = () => {
    return (
        <div className="flex h-screen bg-brand-bg overflow-hidden">
            {/* Skeleton Sidebar */}
            <aside className="w-64 bg-white shadow-lg p-4 flex flex-col flex-shrink-0">
                <div className="px-2 py-4 border-b">
                     <PulseBlock className="h-6 w-3/4" />
                </div>
                <div className="flex-1 p-2 space-y-3 mt-4">
                    {[...Array(6)].map((_, i) => <PulseBlock key={i} className="h-9 w-full rounded-lg" />)}
                    <hr className="my-4 border-gray-200"/>
                    <PulseBlock className="h-4 w-1/3 mb-3 ml-2" />
                    {[...Array(4)].map((_, i) => <PulseBlock key={i} className="h-9 w-full rounded-lg" />)}
                </div>
                <div className="p-2 border-t mt-auto">
                    <div className="flex items-center gap-3">
                        <PulseBlock className="w-10 h-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <PulseBlock className="h-4 w-3/4" />
                            <PulseBlock className="h-3 w-1/2" />
                        </div>
                    </div>
                </div>
            </aside>
            {/* Skeleton Main Content */}
            <main className="flex-1 flex flex-col pl-64">
                <header className="px-8 pt-4 pb-2 border-b">
                    <PulseBlock className="h-10 w-full rounded-lg" />
                </header>
                <div className="px-8 pt-6 pb-2">
                    <PulseBlock className="h-5 w-1/3" />
                </div>
                <div className="flex-1 p-8">
                    <div className="bg-white rounded-lg shadow-md p-6 h-full">
                        <PulseBlock className="h-10 w-1/2 mb-6" />
                        <PulseBlock className="h-4 w-full" />
                        <PulseBlock className="h-4 w-full mt-3" />
                        <PulseBlock className="h-4 w-3/4 mt-3" />

                        <PulseBlock className="h-8 w-1/3 my-8" />
                        <div className="grid grid-cols-2 gap-4">
                            <PulseBlock className="h-24 w-full" />
                            <PulseBlock className="h-24 w-full" />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
