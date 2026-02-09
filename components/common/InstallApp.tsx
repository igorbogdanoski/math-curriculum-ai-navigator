
import React, { useEffect, useState } from 'react';
import { ICONS } from '../../constants';
import { Card } from './Card';

export const InstallApp: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
        setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);

    setDeferredPrompt(null);
  };

  if (!deferredPrompt && !isInstalled) return null;

  if (isInstalled) {
      return (
        <Card className="bg-green-50 border border-green-200 shadow-sm mb-6">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-full text-green-600">
                    <ICONS.check className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="font-semibold text-green-800">Апликацијата е инсталирана</h3>
                    <p className="text-sm text-green-700">Веќе ја користите најдобрата верзија за вашиот уред.</p>
                </div>
            </div>
        </Card>
      );
  }

  return (
    <Card className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white border-none shadow-lg mb-6 transform transition-all hover:scale-[1.01]">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-full backdrop-blur-sm">
                    <ICONS.download className="w-8 h-8 text-white" />
                </div>
                <div>
                    <h3 className="font-bold text-lg">Инсталирај ја апликацијата</h3>
                    <p className="text-blue-100 text-sm">За побрз пристап, работа офлајн и подобро искуство на цел екран.</p>
                </div>
            </div>
            <button 
                onClick={handleInstallClick}
                className="px-6 py-2.5 bg-white text-brand-primary font-bold rounded-lg shadow-md hover:bg-gray-50 transition-colors whitespace-nowrap w-full sm:w-auto"
            >
                Инсталирај сега
            </button>
        </div>
    </Card>
  );
};
