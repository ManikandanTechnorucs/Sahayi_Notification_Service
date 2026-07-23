import type { NextFunction, Request, Response } from 'express';
import { response } from '../../libs/response/src/response';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';
import type { ScheduledNotificationService } from '../services/scheduled-notification.service';
import type { CreateScheduledNotificationBody } from '../validators/scheduled-notification.validator';

/**
 * HTTP handlers for scheduled notifications.
 */
export class ScheduledNotificationController {
  readonly #service: ScheduledNotificationService;

  constructor(service: ScheduledNotificationService) {
    this.#service = service;
    this.create = this.create.bind(this);
    this.getDelivered = this.getDelivered.bind(this);
  }

  /**
   * POST /notifications/schedule-notification
   * Creates a scheduled notification and enqueues it on Azure Service Bus.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as CreateScheduledNotificationBody;
      const data = await this.#service.create(body);

      res.status(201).json({
        ...response.DATA_SAVED,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /notifications/delivered-notification
   * Returns delivered notifications belonging to the authenticated user.
   */

  async getDelivered(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json(response.UNAUTHORIZED);
        return;
      }

      const data = await this.#service.getDelivered(req.user.id);
      console.log(data);

      if (data.length === 0) {
        res.status(200).json(response.NO_DATA_FOUND);
        return;
      }

      res.status(200).json(response.createJson(response.SUCCESS_CODE, data, data.length));
    } catch (error) {
      next(error);
    }
  }
}
