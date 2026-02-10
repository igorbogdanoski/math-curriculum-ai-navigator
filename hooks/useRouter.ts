
import React from 'react';
import { useState, useEffect, useCallback } from 'react';

const getCurrentPath = () => window.location.hash.slice(1) || '/';

export function useRouter(routes: { path: string; component: React.FC<any> }[]) {
  const [rawPath, setRawPath] = useState(getCurrentPath());

  useEffect(() => {
    const onHashChange = () => {
      setRawPath(getCurrentPath());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((to: string) => {
    window.location.hash = to;
  }, []);

  const { component: Component, params } = React.useMemo(() => routes.reduce<{ component: React.FC<any> | null; params: Record<string, string | undefined> }>(
    (acc, route) => {
      const routeParts = route.path.split('/');
      const pathParts = rawPath.split('?')[0].split('/');

      if (routeParts.length !== pathParts.length) {
        return acc;
      }

      const newParams: Record<string, string> = {};
      const isMatch = routeParts.every((part, i) => {
        if (part.startsWith(':')) {
          const paramName = part.slice(1);
          newParams[paramName] = pathParts[i];
          return true;
        }
        return part === pathParts[i];
      });

      if (isMatch) {
        // Handle query params
        const queryString = rawPath.split('?')[1];
        if (queryString) {
            new URLSearchParams(queryString).forEach((value, key) => {
                newParams[key] = value;
            });
        }
        return { component: route.component, params: newParams };
      }

      return acc;
    },
    { component: null, params: {} as Record<string, string | undefined> }
  ), [routes, rawPath]);

  return { path: rawPath, navigate, Component, params };
}