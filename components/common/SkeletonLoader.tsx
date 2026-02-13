import React from 'react';

interface SkeletonLoaderProps {
  type: 'assessment' | 'ideas' | 'paragraph' | 'rubric' | 'page';
}

const SkeletonLine: React.FC<{ width?: string; className?: string }> = ({ width = '100%', className = '' }) => (
  <div className={`bg-gray-200 rounded-md animate-pulse ${className}`} style={{ width }}></div>
);

const PageSkeleton: React.FC = () => (
  <div className="p-8 space-y-10">
    <div className="space-y-4">
      <SkeletonLine width="40%" className="h-12 rounded-xl" />
      <SkeletonLine width="20%" className="h-6 rounded-lg" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
      <div className="lg:col-span-2 space-y-10">
        <div className="h-64 bg-gray-100 rounded-[2.5rem]"></div>
        <div className="h-96 bg-gray-50 rounded-[2.5rem]"></div>
      </div>
      <div className="space-y-8">
        <div className="h-80 bg-gray-100 rounded-[2.5rem]"></div>
      </div>
    </div>
  </div>
);

const AssessmentSkeleton: React.FC = () => (
  <div className="space-y-4">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="space-y-2 pb-2 border-b last:border-b-0">
        <SkeletonLine width="80%" className="h-4" />
        <div className="pl-4 space-y-1">
          <SkeletonLine width="50%" className="h-3" />
          <SkeletonLine width="40%" className="h-3" />
        </div>
        <SkeletonLine width="30%" className="h-2 mt-1" />
      </div>
    ))}
  </div>
);

const IdeasSkeleton: React.FC = () => (
     <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2">
            <SkeletonLine width="40%" className="h-4" />
            <SkeletonLine width="90%" className="h-3" />
            <SkeletonLine width="80%" className="h-3" />
          </div>
        ))}
    </div>
);

const ParagraphSkeleton: React.FC = () => (
    <div className="space-y-2">
        <SkeletonLine width="60%" className="h-4" />
        <SkeletonLine width="100%" className="h-3" />
        <SkeletonLine width="100%" className="h-3" />
        <SkeletonLine width="85%" className="h-3" />
    </div>
);

const RubricSkeleton: React.FC = () => (
    <div className="space-y-4">
        <SkeletonLine width="60%" className="h-6 mb-4" />
        {[...Array(2)].map((_, i) => (
            <div key={i} className="border rounded-md p-2">
                <SkeletonLine width="30%" className="h-4 mb-3" />
                <div className="grid grid-cols-3 gap-2">
                    {[...Array(3)].map((_, j) => (
                        <div key={j} className="space-y-1">
                            <SkeletonLine width="50%" className="h-3" />
                            <SkeletonLine width="90%" className="h-2" />
                            <SkeletonLine width="80%" className="h-2" />
                        </div>
                    ))}
                </div>
            </div>
        ))}
    </div>
);

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ type }) => {
  let content;
  switch(type) {
    case 'assessment':
      content = <AssessmentSkeleton />;
      break;
    case 'ideas':
      content = <IdeasSkeleton />;
      break;
    case 'paragraph':
      content = <ParagraphSkeleton />;
      break;
    case 'rubric':
        content = <RubricSkeleton />;
        break;
    case 'page':
        return <PageSkeleton />;
    default:
      content = <ParagraphSkeleton />;
  }
  return <div className="p-4 rounded-lg bg-white border border-gray-200">{content}</div>;
};