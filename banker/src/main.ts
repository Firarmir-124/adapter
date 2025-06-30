import { ConfigService } from '@config';
import path from 'node:path';
import { CoreService } from './common/core.service';

const bootstrap = async () => {
  console.log('Starting Banker Service...');
  const config = new ConfigService(path.resolve(__dirname, '..'));
  const coreService = new CoreService(config);

  await coreService.start();

  process.on('SIGINT', async () => {
    console.log('Caught SIGINT, shutting down...');
    await coreService.shutdown();
    process.exit(0);
  });
};

bootstrap().catch((err) => {
  console.error('Error starting Banker Service:', err);
  process.exit(1);
});