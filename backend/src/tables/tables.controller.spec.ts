import { REQUIRED_CAPABILITIES } from '../auth/require-capabilities.decorator.js';
import { TablesController } from './tables.controller.js';

describe('TablesController authorization metadata', () => {
  it.each([
    ['list', 'table.read'],
    ['create', 'table.manage'],
    ['update', 'table.manage'],
    ['setActive', 'table.manage'],
    ['issueQr', 'qr.manage'],
    ['regenerateQr', 'qr.manage'],
    ['revokeQr', 'qr.manage'],
    ['qrHistory', 'table.read'],
  ] as const)('%s requires %s', (method, capability) => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES,
        TablesController.prototype[method],
      ),
    ).toEqual([capability]);
  });
});
