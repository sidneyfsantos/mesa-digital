import { REQUIRED_CAPABILITIES } from '../auth/require-capabilities.decorator.js';
import { ServicePointsController } from './service-points.controller.js';
describe('ServicePointsController authorization metadata', () => {
  it.each([
    ['modesGet', 'service_point.read'], ['modesReplace', 'service_point.manage'], ['list', 'service_point.read'], ['create', 'service_point.manage'], ['update', 'service_point.manage'], ['setActive', 'service_point.manage'], ['issueQr', 'qr.manage'], ['regenerateQr', 'qr.manage'], ['revokeQr', 'qr.manage'], ['qrHistory', 'service_point.read'],
  ] as const)('%s requires %s', (method, capability) => { expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, ServicePointsController.prototype[method])).toEqual([capability]); });
});
