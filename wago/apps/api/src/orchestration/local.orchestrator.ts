import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContainerOrchestrator, ProvisionResult } from './orchestrator.interface';

@Injectable()
export class LocalOrchestrator implements ContainerOrchestrator {
  private readonly logger = new Logger(LocalOrchestrator.name);
  private readonly wahaHost: string;

  constructor(private readonly configService: ConfigService) {
    this.wahaHost = this.configService.get<string>('WAHA_HOST', 'waha');
    this.logger.log(`Local orchestrator: WAHA at ${this.wahaHost}`);
  }

  async provisionWorker(): Promise<ProvisionResult> {
    const apiKey = this.configService.get<string>('WAHA_API_KEY', 'devkey');
    return {
      podName: 'local-waha',
      internalIp: this.wahaHost,
      apiKey,
    };
  }

  async destroyWorker(_podName: string): Promise<void> {
    // No-op for local
  }

  async getWorkerStatus(_podName: string): Promise<'running' | 'stopped' | 'unknown'> {
    return 'running';
  }
}
