import { Injectable } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    // Extract IP from proxy headers (req.ips) or fallback to direct IP (req.ip)
    // req.ips is populated by Express when trust proxy is enabled
    const tracker = req.ips?.length ? req.ips[0] : req.ip
    return Promise.resolve(tracker)
  }
}
