
import { useMemo } from 'react';
import { useCurriculum } from './useCurriculum';
import { usePlanner } from '../contexts/PlannerContext';

export interface Breadcrumb {
  label: string;
  path: string;
}

export function useBreadcrumbs(path: string): Breadcrumb[] {
  const { getTopic, getConceptDetails } = useCurriculum();
  const { getLessonPlan } = usePlanner();

  const breadcrumbs = useMemo((): Breadcrumb[] => {
    const crumbs: Breadcrumb[] = [{ label: 'Почетна', path: '/' }];
    const cleanPath = path.split('?')[0];
    
    if (cleanPath === '/') {
        return crumbs;
    }

    const staticRoutes: { [key: string]: string } = {
        '/explore': 'Истражи програма',
        '/planner': 'Планер',
        '/assistant': 'AI Асистент',
        '/generator': 'Генератор',
        '/my-lessons': 'Мои подготовки',
        '/gallery': 'Галерија на Заедницата',
        '/settings': 'Поставки',
        '/progression': 'Вертикална проодност',
        '/favorites': 'Омилени',
        '/reports/coverage': 'Анализа на Покриеност',
        '/graph': 'Интерактивен Граф',
    };
    
    if (staticRoutes[cleanPath]) {
        crumbs.push({ label: staticRoutes[cleanPath], path: cleanPath });
        return crumbs;
    }
    
    const pathParts = cleanPath.split('/').filter(Boolean);

    // Safer handling for Topic Paths
    if (pathParts[0] === 'topic' && pathParts[1]) {
        try {
            const result = getTopic(pathParts[1]);
            const topic = result?.topic;
            
            crumbs.push({ label: 'Истражи програма', path: '/explore' });
            if (topic) {
                crumbs.push({ label: topic.title, path: cleanPath });
            } else {
                crumbs.push({ label: 'Вчитувам...', path: cleanPath });
            }
        } catch (e) {
            crumbs.push({ label: 'Грешка во патека', path: '/explore' });
        }
        return crumbs;
    }
    
    // Safer handling for Mindmap Paths
    if (pathParts[0] === 'mindmap' && pathParts[1]) {
        try {
            const result = getTopic(pathParts[1]);
            const topic = result?.topic;

            crumbs.push({ label: 'Истражи програма', path: '/explore' });
            if (topic) {
                crumbs.push({ label: topic.title, path: `/topic/${topic.id}` });
                crumbs.push({ label: 'Мисловна Мапа', path: cleanPath });
            } else {
                crumbs.push({ label: 'Вчитувам...', path: cleanPath });
            }
        } catch (e) {
             crumbs.push({ label: 'Мисловна Мапа', path: cleanPath });
        }
        return crumbs;
    }

    // Safer handling for Concept Paths
    if (pathParts[0] === 'concept' && pathParts[1]) {
        try {
            const result = getConceptDetails(pathParts[1]);
            const topic = result?.topic;
            const concept = result?.concept;

            crumbs.push({ label: 'Истражи програма', path: '/explore' });
            if (topic) crumbs.push({ label: topic.title, path: `/topic/${topic.id}` });
            if (concept) {
                crumbs.push({ label: concept.title, path: cleanPath });
            } else {
                crumbs.push({ label: 'Вчитувам поим...', path: cleanPath });
            }
        } catch (e) {
            crumbs.push({ label: 'Детали за поим', path: cleanPath });
        }
        return crumbs;
    }

    // Safer handling for Planner/Lesson Paths
    if (pathParts[0] === 'planner' && pathParts[1] === 'lesson') {
        crumbs.push({ label: 'Мои подготовки', path: '/my-lessons' });
        if (pathParts[2] === 'new') {
            crumbs.push({ label: 'Нова подготовка', path: cleanPath });
        } else if (pathParts[2] === 'view' && pathParts[3]) {
            const plan = getLessonPlan(pathParts[3]);
            crumbs.push({ label: plan ? plan.title : 'Вчитувам...', path: cleanPath });
        } else if (pathParts[2]) {
             const plan = getLessonPlan(pathParts[2]);
             crumbs.push({ label: plan ? `Уреди: ${plan.title}` : 'Вчитувам...', path: cleanPath });
        }
        return crumbs;
    }
    
    if (pathParts[0] === 'share') {
      if (pathParts[1] === 'annual' && pathParts[2]) {
          crumbs.push({ label: 'Споделен годишен план', path: cleanPath });
      } else if (pathParts[1]) {
          crumbs.push({ label: 'Споделена подготовка', path: cleanPath });
      }
      return crumbs;
    }
    
    return crumbs;

  }, [path, getTopic, getConceptDetails, getLessonPlan]);

  return breadcrumbs;
}