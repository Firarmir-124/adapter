import { ConfigService } from '@config';
import {
  LEDGER_WITHDRAW,
  LEDGER_CHECK_RESULT,
  PAY_WITHDRAW,
  PAY_BTC_WITHDRAW,
  PAY_ETH_WITHDRAW,
  PAY_USDT_TRON_WITHDRAW,
  PAY_BAKAI_WITHDRAW,
} from '@config/common/bus.topics';
import { DBManager } from '@db/common/dbmanager';
import { KafkaEventBus, MultiEventBus } from '@event-bus';
import { AmlService } from './aml.service';

export class CoreService {
  private readonly config: ConfigService;
  private dbManager!: DBManager;
  private multiBus!: MultiEventBus;
  private sendCommandToSystem!: (name: string, meta: Record<string, any>) => Promise<void>;
  private amlService!: AmlService;

  constructor(config: ConfigService) {
    this.config = config;
  }

  async start() {
    console.log('CoreService started with config');
    await this.initializeDatabase();
    await this.initializeEventBuses();
    this.amlService = new AmlService();
  }

  async initializeDatabase() {
    console.log('Initializing database...');
    this.dbManager = new DBManager(this.config);
    const entities: any[] = [];
    this.dbManager.addConnection('banker', 'postgres', entities, []);
    await this.dbManager.initialize();
  }

  async initializeEventBuses() {
    console.log('Initializing event buses...');
    this.multiBus = new MultiEventBus({
      system: new KafkaEventBus(this.config.getString('SYSTEM_KAFKA_BROKERS').split(',')),
    });
    this.sendCommandToSystem = (name: string, meta: Record<string, any>) => this.multiBus.publish(name, meta);
    const routing = [
      {
        topic: LEDGER_WITHDRAW,
        busName: 'system',
        handler: this.actionWithdraw.bind(this),
      },
      {
        topic: LEDGER_CHECK_RESULT,
        busName: 'system',
        handler: this.actionCheckResult.bind(this),
      },
    ];
    for (const route of routing) {
      await this.multiBus.subscribe(route.topic, route.handler, route.busName);
    }
    await this.multiBus.run();
  }

  async actionWithdraw(message: any) {
    console.log('Handling withdraw action:', message);
    const passed = await this.amlService.check(message);
    if (!passed) {
      console.log('AML check failed', message);
      return;
    }
    let topic = PAY_WITHDRAW;
    const target = (message.bank || message.currency || '').toLowerCase();
    switch (target) {
      case 'btc':
        topic = PAY_BTC_WITHDRAW;
        break;
      case 'eth':
        topic = PAY_ETH_WITHDRAW;
        break;
      case 'usdt-tron':
      case 'tron':
      case 'usdt':
        topic = PAY_USDT_TRON_WITHDRAW;
        break;
      case 'bakai':
        topic = PAY_BAKAI_WITHDRAW;
        break;
    }
    await this.sendCommandToSystem(topic, message);
  }

  async actionCheckResult(message: any) {
    console.log('Handling check result:', message);
  }

  async shutdown() {
    console.log('CoreService shutting down...');
    if (this.multiBus) {
      await this.multiBus.shutdown();
    }
    if (this.dbManager) {
      await this.dbManager.shutdown();
    }
  }
}
