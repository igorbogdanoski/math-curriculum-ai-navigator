import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CloudImportMenu } from './CloudImportMenu';
import { pickFromGoogleDrive } from '../../services/cloudImport/googleDrivePicker';
import { pickFromOneDrive } from '../../services/cloudImport/oneDrivePicker';

vi.mock('../../services/cloudImport/googleDrivePicker', () => ({ pickFromGoogleDrive: vi.fn() }));
vi.mock('../../services/cloudImport/dropboxChooser', () => ({ pickFromDropbox: vi.fn() }));
vi.mock('../../services/cloudImport/oneDrivePicker', () => ({ pickFromOneDrive: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CloudImportMenu', () => {
  it('opens the dropdown and renders it via a portal on document.body (not clipped by a scrollable ancestor)', () => {
    const { container } = render(<CloudImportMenu onFileSelected={vi.fn()} />);
    fireEvent.click(screen.getByText('Увези од...'));

    const oneDriveOption = screen.getByText('OneDrive');
    expect(oneDriveOption).toBeTruthy();
    // The option must NOT be a descendant of the component's own render container —
    // proving it was portaled to document.body, not rendered inline.
    expect(container.contains(oneDriveOption)).toBe(false);
    expect(document.body.contains(oneDriveOption)).toBe(true);
  });

  it('picks a file via the selected provider and forwards it as a real File', async () => {
    vi.mocked(pickFromOneDrive).mockResolvedValue({
      name: 'plan.pdf',
      arrayBuffer: new ArrayBuffer(4),
      mimeType: 'application/pdf',
    });
    const onFileSelected = vi.fn();
    render(<CloudImportMenu onFileSelected={onFileSelected} />);

    fireEvent.click(screen.getByText('Увези од...'));
    fireEvent.click(screen.getByText('OneDrive'));

    await vi.waitFor(() => expect(onFileSelected).toHaveBeenCalledTimes(1));
    const file = onFileSelected.mock.calls[0][0] as File;
    expect(file.name).toBe('plan.pdf');
    expect(file.type).toBe('application/pdf');
  });

  it('closes the menu and does not treat a click inside the portaled menu as an outside click', () => {
    render(<CloudImportMenu onFileSelected={vi.fn()} />);
    fireEvent.click(screen.getByText('Увези од...'));
    expect(screen.getByText('OneDrive')).toBeTruthy();

    // A mousedown inside the (portaled) menu itself must not close it before the click fires.
    fireEvent.mouseDown(screen.getByText('OneDrive'));
    expect(screen.getByText('OneDrive')).toBeTruthy();
  });

  it('closes the menu on an outside click', () => {
    render(<CloudImportMenu onFileSelected={vi.fn()} />);
    fireEvent.click(screen.getByText('Увези од...'));
    expect(screen.getByText('OneDrive')).toBeTruthy();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('OneDrive')).toBeNull();
  });

  it('surfaces a CloudImportError message via onError', async () => {
    const { CloudImportError } = await import('../../services/cloudImport/types');
    vi.mocked(pickFromGoogleDrive).mockRejectedValue(new CloudImportError('Google Drive не е конфигуриран.', 'google-drive'));
    const onError = vi.fn();
    render(<CloudImportMenu onFileSelected={vi.fn()} onError={onError} />);

    fireEvent.click(screen.getByText('Увези од...'));
    fireEvent.click(screen.getByText('Google Drive'));

    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith('Google Drive не е конфигуриран.'));
  });
});
