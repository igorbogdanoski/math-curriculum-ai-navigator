import { describe, it } from 'vitest';
import { render } from '@testing-library/react'; import React from 'react'; import { MaterialsGeneratorView } from '../views/MaterialsGeneratorView'; describe('MaterialsGeneratorView', () => { it('renders without crashing', () => { render(<MaterialsGeneratorView />); }); });
