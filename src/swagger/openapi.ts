import { config } from '../../libs/config/src/config';

/**
 * OpenAPI 3 document for the Notification Service.
 * Kept as a plain object so Swagger UI can serve it without Nest decorators.
 */
export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Sahayi Notification Service',
    version: '1.0.0',
    description:
      'APIs for creating and managing scheduled push notifications via Azure Service Bus.',
  },
  servers: [
    {
      url: `http://localhost:${config.NOTIFICATION_SERVICE_PORT}`,
      description: 'Local development',
    },
    {
      url: `http://${config.SWAGGER_PUBLIC_HOST}:${config.NOTIFICATION_SERVICE_PORT}`,
      description: 'Hosted environment',
    },
  ],
  tags: [
    {
      name: 'Scheduled Notifications',
      description: 'Schedule future push notifications for users',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token from the auth service',
      },
    },
    schemas: {
      CreateScheduledNotificationDto: {
        type: 'object',
        required: ['userId', 'title', 'message', 'scheduledAt'],
        additionalProperties: false,
        properties: {
          userId: {
            type: 'integer',
            minimum: 1,
            example: 7,
            description: 'Target user id',
          },
          title: {
            type: 'string',
            minLength: 1,
            maxLength: 200,
            example: 'Medication reminder',
            description: 'Notification title',
          },
          message: {
            type: 'string',
            minLength: 1,
            maxLength: 1000,
            example: 'Time to take your evening medication',
            description: 'Notification body/message',
          },
          scheduledAt: {
            type: 'string',
            format: 'date-time',
            example: '2026-07-18T10:30:00.000Z',
            description: 'Future date/time when the notification should be delivered (ISO-8601)',
          },
        },
      },
      ScheduledNotificationResponseDto: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '42' },
          userId: { type: 'string', example: '7' },
          deviceToken: { type: 'string', nullable: true, example: null },
          title: { type: 'string', example: 'Medication reminder' },
          message: { type: 'string', example: 'Time to take your evening medication' },
          status: {
            type: 'string',
            enum: ['SCHEDULED', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED'],
            example: 'SCHEDULED',
          },
          azureMessageId: {
            type: 'string',
            nullable: true,
            example: '1234567890',
            description: 'Azure Service Bus scheduled message sequence number',
          },
          scheduledAt: { type: 'string', format: 'date-time' },
          sentAt: { type: 'string', format: 'date-time', nullable: true },
          deliveredAt: { type: 'string', format: 'date-time', nullable: true },
          failedAt: { type: 'string', format: 'date-time', nullable: true },
          retryCount: { type: 'integer', example: 0 },
          errorMessage: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      DeliveredScheduledNotificationSummaryDto: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '42' },
          userId: { type: 'string', example: '7' },
          childReminderId: { type: 'string', nullable: true, example: '93' },
          notificationType: { type: 'string', nullable: true, example: 'before' },
          title: { type: 'string', example: 'Medication reminder' },
          message: { type: 'string', example: 'Time to take your evening medication' },
          status: {
            type: 'string',
            enum: ['SCHEDULED', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED'],
            example: 'DELIVERED',
          },
          scheduledAt: { type: 'string', format: 'date-time' },
          sentAt: { type: 'string', format: 'date-time', nullable: true },
          deliveredAt: { type: 'string', format: 'date-time', nullable: true },
          failedAt: { type: 'string', format: 'date-time', nullable: true },
          retryCount: { type: 'integer', example: 0 },
          errorMessage: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      DeliveredNotificationResponseDto: {
        type: 'object',
        required: [
          'id',
          'scheduledNotificationId',
          'userId',
          'title',
          'message',
          'deliveredAt',
          'isRead',
          'createdAt',
          'scheduledNotification',
        ],
        properties: {
          id: { type: 'string', example: '18' },
          scheduledNotificationId: { type: 'string', example: '42' },
          userId: { type: 'string', example: '7' },
          title: { type: 'string', example: 'Medication reminder' },
          message: { type: 'string', example: 'Time to take your evening medication' },
          notificationAudioUrl: {
            type: 'string',
            nullable: true,
            example: 'https://cdn.example.com/reminder-missed.mp3',
          },
          deliveredAt: {
            type: 'string',
            format: 'date-time',
            example: '2026-07-18T10:30:02.000Z',
          },
          readAt: { type: 'string', format: 'date-time', nullable: true, example: null },
          isRead: { type: 'boolean', example: false },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2026-07-18T10:30:02.000Z',
          },
          scheduledNotification: {
            nullable: true,
            allOf: [{ $ref: '#/components/schemas/DeliveredScheduledNotificationSummaryDto' }],
          },
        },
      },
      DataSavedResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          code: { type: 'string', example: 'DATA_SAVED' },
          message: { type: 'string', example: 'Data saved successfully' },
          data: { $ref: '#/components/schemas/ScheduledNotificationResponseDto' },
        },
      },
      DeliveredNotificationListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          code: { type: 'integer', example: 200 },
          message: { type: 'string', example: 'Success' },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/DeliveredNotificationResponseDto' },
          },
          count: {
            type: 'integer',
            example: 48,
            description: 'Total delivered notifications matching the query',
          },
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 30 },
          totalPages: { type: 'integer', example: 2 },
        },
      },
      BulkMarkDeliveredReadDto: {
        type: 'object',
        required: ['ids'],
        additionalProperties: false,
        properties: {
          ids: {
            type: 'array',
            minItems: 1,
            maxItems: 100,
            items: { type: 'integer', minimum: 1 },
            example: [18, 19, 20],
            description: 'DeliveredNotification ids owned by the authenticated user',
          },
        },
      },
      BulkMarkDeliveredReadResultDto: {
        type: 'object',
        properties: {
          updatedCount: { type: 'integer', example: 3 },
          readAt: {
            type: 'string',
            format: 'date-time',
            example: '2026-08-11T15:30:00.000Z',
          },
        },
      },
      BulkMarkDeliveredReadResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          code: { type: 'string', example: 'DATA_UPDATED' },
          message: { type: 'string', example: 'Data updated successfully' },
          data: { $ref: '#/components/schemas/BulkMarkDeliveredReadResultDto' },
        },
      },
      UnreadDeliveredCountDto: {
        type: 'object',
        properties: {
          unreadCount: { type: 'integer', example: 5 },
        },
      },
      UnreadDeliveredCountResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          code: { type: 'integer', example: 200 },
          message: { type: 'string', example: 'Success' },
          data: { $ref: '#/components/schemas/UnreadDeliveredCountDto' },
        },
      },
      NoDataFoundResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          code: { type: 'string', example: 'NO_DATA_FOUND' },
          message: { type: 'string', example: 'No data found' },
        },
      },
      UnauthorizedResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          code: { type: 'string', example: 'UNAUTHORIZED' },
          message: { type: 'string', example: 'Unauthorized' },
        },
      },
      ValidationErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          message: { type: 'string', example: 'scheduledAt must be in the future' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string', example: 'scheduledAt' },
                message: { type: 'string', example: 'scheduledAt must be in the future' },
              },
            },
          },
        },
      },
      NotFoundResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          code: { type: 'string', example: 'NOT_FOUND' },
          message: { type: 'string', example: 'User not found' },
        },
      },
      OopsErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          code: { type: 'string', example: 'INTERNAL_ERROR' },
          message: { type: 'string', example: 'Oops! Something went wrong' },
        },
      },
    },
  },
  paths: {
    '/notifications/schedule-notification': {
      post: {
        tags: ['Scheduled Notifications'],
        summary: 'Create a scheduled notification',
        description:
          'Creates a ScheduledNotification row with status SCHEDULED, schedules a message on Azure Service Bus for the given date/time, then updates AzureMessageId with the Service Bus sequence number.',
        operationId: 'createScheduledNotification',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateScheduledNotificationDto' },
              examples: {
                default: {
                  summary: 'Schedule a future push',
                  value: {
                    userId: 7,
                    title: 'Medication reminder',
                    message: 'Time to take your evening medication',
                    scheduledAt: '2026-07-18T10:30:00.000Z',
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Scheduled notification created and queued',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DataSavedResponse' },
              },
            },
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Missing or invalid JWT',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UnauthorizedResponse' },
              },
            },
          },
          '404': {
            description: 'User not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NotFoundResponse' },
              },
            },
          },
          '500': {
            description: 'Unexpected server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OopsErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/notifications/delivered-notification': {
      get: {
        tags: ['Scheduled Notifications'],
        summary: 'Fetch my delivered notifications',
        description:
          'Returns paginated delivered notifications for the authenticated user, sorted by DeliveredAt DESC (latest first), including related scheduled notification details.',
        operationId: 'getMyDeliveredNotifications',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'page',
            in: 'query',
            required: false,
            description: 'Page number (1-based). Default: 1',
            schema: { type: 'integer', minimum: 1, default: 1, example: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            description: 'Page size. Default: 30. Maximum: 30',
            schema: { type: 'integer', minimum: 1, maximum: 30, default: 30, example: 30 },
          },
        ],
        responses: {
          '200': {
            description: 'Delivered notifications, or a no-data response when none exist',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    { $ref: '#/components/schemas/DeliveredNotificationListResponse' },
                    { $ref: '#/components/schemas/NoDataFoundResponse' },
                  ],
                },
                examples: {
                  deliveredNotifications: {
                    summary: 'Delivered notifications found',
                    value: {
                      success: true,
                      code: 200,
                      message: 'Success',
                      data: [
                        {
                          id: '18',
                          scheduledNotificationId: '42',
                          userId: '7',
                          title: 'Medication reminder',
                          message: 'Time to take your evening medication',
                          deliveredAt: '2026-07-18T10:30:02.000Z',
                          readAt: null,
                          isRead: false,
                          createdAt: '2026-07-18T10:30:02.000Z',
                          scheduledNotification: {
                            id: '42',
                            userId: '7',
                            childReminderId: '93',
                            notificationType: 'before',
                            title: 'Medication reminder',
                            message: 'Time to take your evening medication',
                            status: 'DELIVERED',
                            scheduledAt: '2026-07-18T10:30:00.000Z',
                            sentAt: '2026-07-18T10:30:01.000Z',
                            deliveredAt: '2026-07-18T10:30:02.000Z',
                            failedAt: null,
                            retryCount: 0,
                            errorMessage: null,
                            createdAt: '2026-07-18T09:00:00.000Z',
                            updatedAt: '2026-07-18T10:30:02.000Z',
                          },
                        },
                      ],
                      count: 48,
                      page: 1,
                      limit: 30,
                      totalPages: 2,
                    },
                  },
                  noData: {
                    summary: 'No delivered notifications',
                    value: {
                      success: false,
                      code: 'NO_DATA_FOUND',
                      message: 'No data found',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Missing or invalid JWT',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UnauthorizedResponse' },
              },
            },
          },
          '500': {
            description: 'Unexpected server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OopsErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/notifications/delivered-notification/unread-count': {
      get: {
        tags: ['Scheduled Notifications'],
        summary: 'Get unread delivered notification count',
        description:
          'Returns the count of DeliveredNotification rows for the authenticated user where IsRead is false.',
        operationId: 'getUnreadDeliveredNotificationCount',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Unread count for the authenticated user',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UnreadDeliveredCountResponse' },
                examples: {
                  default: {
                    summary: 'Unread count',
                    value: {
                      success: true,
                      code: 200,
                      message: 'Success',
                      data: { unreadCount: 5 },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Missing or invalid JWT',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UnauthorizedResponse' },
              },
            },
          },
          '500': {
            description: 'Unexpected server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OopsErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/notifications/delivered-notification/mark-read': {
      patch: {
        tags: ['Scheduled Notifications'],
        summary: 'Bulk mark delivered notifications as read',
        description:
          'Sets IsRead=true and ReadAt=now for the given DeliveredNotification ids belonging to the authenticated user. Already-read rows are skipped.',
        operationId: 'bulkMarkDeliveredNotificationsAsRead',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BulkMarkDeliveredReadDto' },
              examples: {
                default: {
                  summary: 'Mark selected notifications as read',
                  value: { ids: [18, 19, 20] },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Delivered notifications updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BulkMarkDeliveredReadResponse' },
              },
            },
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Missing or invalid JWT',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UnauthorizedResponse' },
              },
            },
          },
          '500': {
            description: 'Unexpected server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OopsErrorResponse' },
              },
            },
          },
        },
      },
    },
  },
};
