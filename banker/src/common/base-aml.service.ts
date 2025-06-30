export class BaseAmlService {
  async check(payload: any): Promise<boolean> {
    console.log('[BaseAmlService] mock check', payload);
    return true;
  }
}
