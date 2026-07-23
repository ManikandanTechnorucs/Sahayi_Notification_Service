type JsonResponse<TData = unknown> = {
  success: boolean;
  code: number | string;
  message: string;
  data?: TData;
  count?: number;
  errors?: ErrorDetail[];
};

type ErrorDetail = {
  field: string;
  message: string;
};

export const response = {
  SUCCESS_CODE: 200,

  NO_DATA_FOUND: {
    success: false,
    code: 'NO_DATA_FOUND',
    message: 'No data found',
  },

  NO_DATA_FOUND_V2: {
    success: false,
    code: 'NOT_FOUND',
    message: 'Data not found',
  },

  OOPS_ERROR: {
    success: false,
    code: 'INTERNAL_ERROR',
    message: 'Oops! Something went wrong',
  },

  DATA_SAVED: {
    success: true,
    code: 'DATA_SAVED',
    message: 'Data saved successfully',
  },

  DATA_UPDATED: {
    success: true,
    code: 'DATA_UPDATED',
    message: 'Data updated successfully',
  },

  DATA_DELETED_SUCCESSFULLY: {
    success: true,
    code: 'DATA_DELETED_SUCCESSFULLY',
    message: 'Data deleted successfully',
  },

  UNAUTHORIZED: {
    success: false,
    code: 'UNAUTHORIZED',
    message: 'Unauthorized',
  },

  PERMISSION_DENIED: {
    success: false,
    code: 'FORBIDDEN',
    message: 'Permission denied',
  },

  createJson<TData>(code: number | string, data: TData, count?: number): JsonResponse<TData> {
    return {
      success: true,
      code,
      message: 'Success',
      data,
      ...(count !== undefined ? { count } : {}),
    };
  },

  createError(message: string, code = 'ERROR', errors?: ErrorDetail[]): JsonResponse {
    return {
      success: false,
      code,
      message,
      ...(errors?.length ? { errors } : {}),
    };
  },
};
