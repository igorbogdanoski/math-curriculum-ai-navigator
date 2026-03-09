const fs = require('fs');

let code = fs.readFileSync('views/ParentPortalView.tsx', 'utf8');

const hookCode = \
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  const handleEnablePush = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      setNotificationsEnabled(true);
      sendLocalPushNotification('????????????? ?? ???????!', '?? ???????? ??????????? ?? ?????????? ?? ?????? ????.');
    }
  };
\;

code = code.replace(
  'const [isGeneratingNextSteps, setIsGeneratingNextSteps] = useState(false);',
  'const [isGeneratingNextSteps, setIsGeneratingNextSteps] = useState(false);\\n' + hookCode
);

const buttonUI = \
      {/* PWA PUSH NOTIFICATIONS */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4 mb-8 relative space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <BellRing className="w-6 h-6 text-brand-primary" />
            ??????????? (Push Notifications)
          </h2>
          <p className="text-gray-500">????????? ????????? ??????????? ?? ?????? ???? (???????/?????????) ???? ??????????? ?????? ???? ?????? ??? ???????.</p>
        </div>
        <button 
          onClick={handleEnablePush}
          disabled={notificationsEnabled}
          className={\\\px-6 py-3 rounded-2xl font-bold flex flex-shrink-0 items-center gap-2 transition-colors \\\\\\}
        >
          {notificationsEnabled ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              ???????
            </>
          ) : (
            <>
              <Bell className="w-5 h-5" />
              ?????? ???????????
            </>
          )}
        </button>
      </div>
\;

code = code.replace(
  '{summary ? (\\n        <div className="animate-fade-in-up">',
  '{summary ? (\\n        <div className="animate-fade-in-up">\\n' + buttonUI
);

fs.writeFileSync('views/ParentPortalView.tsx', code);
console.log('patched ParentPortalView');
