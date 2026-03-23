
import React, { createContext, useState, useCallback, useContext, useMemo, useRef } from 'react';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  id: number;
  message: string;
  type: NotificationType;
}

interface NotificationContextType {
  addNotification: (message: string, type: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

const NotificationContainer: React.FC<{ notifications: Notification[]; removeNotification: (id: number) => void }> = ({ notifications, removeNotification }) => {
  return (
    <div className="fixed top-5 right-5 z-50 space-y-3" aria-live="polite" aria-atomic="true" role="status">
      {notifications.map((notification: Notification) => (
        <div
          key={notification.id}
          onClick={() => removeNotification(notification.id)}
          className={`px-4 py-3 rounded-md shadow-lg flex items-center cursor-pointer transform transition-all duration-300 animate-fade-in-down ${
            notification.type === 'success' ? 'bg-green-500' :
            notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
          } text-white`}
        >
          {notification.message}
        </div>
      ))}
    </div>
  );
};


export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // Monotonic counter — avoids Date.now() collisions when two notifications arrive simultaneously
  const counterRef = useRef(0);

  const removeNotification = useCallback((id: number) => {
    setNotifications((prev: Notification[]) => prev.filter((n: Notification) => n.id !== id));
  }, []);

  // Break the removeNotification → addNotification dependency chain:
  // use a functional setNotifications update inside the timeout so addNotification
  // has NO dependencies and never changes identity — zero context re-renders.
  const addNotification = useCallback((message: string, type: NotificationType) => {
    const id = ++counterRef.current;
    setNotifications((prev: Notification[]) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev: Notification[]) => prev.filter((n: Notification) => n.id !== id));
    }, 5000);
  }, []); // stable — no deps

  const value = useMemo(() => ({ addNotification }), [addNotification]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer notifications={notifications} removeNotification={removeNotification} />
    </NotificationContext.Provider>
  );
};
