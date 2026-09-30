import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/platform/os-free-space.js', async () => {
  const actual = await vi.importActual<typeof import('../src/platform/os-free-space.js')>(
    '../src/platform/os-free-space.js'
  );
  return {
    ...actual,
    readOsDriveFreeBytes: vi.fn(),
  };
});

import {
  PHOTOSHOP_MIN_FREE_BYTES,
  applyScratchDiskDiagnosis,
  classifyError,
  diagnoseScratchDiskTimeout,
  envelopeToToolResult,
  refineTimeoutEnvelope,
} from '../src/errors/envelope.js';
import { osDrivePath, readOsDriveFreeBytes } from '../src/platform/os-free-space.js';

const readFree = vi.mocked(readOsDriveFreeBytes);

describe('scratch disk full', () => {
  beforeEach(() => {
    readFree.mockReset();
  });

  it('classifies Adobe dialog text without sending the agent back to ping', () => {
    for (const message of [
      'Could not initialize Photoshop because the scratch disks are full',
      'Could not complete your request because the scratch disks are full',
      'Could not complete the command because the scratch disks are full',
      'Scratch Disk Low',
      'There is not enough space on the scratch disk.',
      'localized message (number: -25010)',
    ]) {
      const envelope = classifyError(message);
      expect(envelope.code).toBe('scratch_disk_full');
      expect(envelope.suggested_next_tool).toBeUndefined();
      expect(envelope.message).toMatch(/100 GB/);
      expect(envelope.message).toMatch(/Restart Photoshop/);
    }
  });

  it('leaves a timeout alone when the OS drive has the minimum free space', () => {
    expect(diagnoseScratchDiskTimeout(PHOTOSHOP_MIN_FREE_BYTES)).toBeNull();
    expect(diagnoseScratchDiskTimeout(null)).toBeNull();
  });

  it('turns a startup timeout into scratch_disk_full when the OS drive is under 10 GB', () => {
    const envelope = diagnoseScratchDiskTimeout(2 * 1024 * 1024 * 1024);
    expect(envelope?.code).toBe('scratch_disk_full');
    expect(envelope?.message).toMatch(/2\.0 GB free/);
    expect(envelope?.message).toMatch(/10 GB minimum/);
    expect(envelope?.suggested_next_tool).toBeUndefined();
  });

  it('replaces a ping timeout when the OS drive is below the minimum', async () => {
    readFree.mockResolvedValue(512 * 1024 * 1024);
    const result = await applyScratchDiskDiagnosis(
      envelopeToToolResult(classifyError('Script execution timeout'))
    );
    const body = JSON.parse((result.content[0] as { text: string }).text) as {
      code: string;
      message: string;
      suggested_next_tool?: string;
    };
    expect(body.code).toBe('scratch_disk_full');
    expect(body.suggested_next_tool).toBeUndefined();
    expect(body.message).toMatch(/0\.5 GB free/);
  });

  it('keeps the busy-script hint when the OS drive has room', async () => {
    readFree.mockResolvedValue(PHOTOSHOP_MIN_FREE_BYTES);
    const result = await applyScratchDiskDiagnosis(
      envelopeToToolResult(classifyError('Script execution timeout'))
    );
    const body = JSON.parse((result.content[0] as { text: string }).text) as {
      code: string;
      message: string;
    };
    const refined = refineTimeoutEnvelope('photoshop_ping', {
      ok: false,
      code: body.code as 'extendscript_timeout',
      message: body.message,
    });
    expect(refined.code).toBe('extendscript_timeout');
    expect(refined.message).toMatch(/Retry photoshop_ping/);
  });

  it('points the OS-drive check at the startup volume', () => {
    if (process.platform === 'win32') {
      expect(osDrivePath().endsWith('\\')).toBe(true);
    } else {
      expect(osDrivePath()).toBe('/');
    }
  });
});
