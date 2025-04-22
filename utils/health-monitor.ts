// utils/health-monitor.ts
export class ServiceHealthMonitor {
    private serviceChecks: Map<string, () => Promise<boolean>> = new Map();
    
    async checkServiceHealth(serviceId: string): Promise<boolean> {
        const check = this.serviceChecks.get(serviceId);
        if (!check) return false;
        
        try {
            return await check();
        } catch {
            return false;
        }
    }

    async getSystemHealth(): Promise<Record<string, boolean>> {
        const health: Record<string, boolean> = {};
        for (const [id, _] of this.serviceChecks) {
            health[id] = await this.checkServiceHealth(id);
        }
        return health;
    }
}