export type InstanviPaymentType = "COLLECTION" | "DEPOSIT"

export type InstanviProvider = "MTN_CAM" | "ORANGE_CAM"

export interface InstanviEnvelope<T> {
  status_code: number
  status: string
  message: string
  data: T
}

export interface InstanviMakePaymentBody {
  type?: InstanviPaymentType
  amount?: number
  phone_number?: number
  provider?: InstanviProvider
  order_id?: string
  invoice_id?: string
  catalogue_id?: string
  callback_url?: string
}

export interface InstanviMakePaymentData {
  id: string
  transaction_id: string
  status: string
}

export interface InstanviPaymentRow {
  id: string
  transaction_id: string
  amount: number
  currency: string
  status: string
  phone_number: number
  created_at: string
  updated_at: string
  order_id: string | null
  invoice_id: string | null
  reference_id: string | null
  type: string | null
  mode: string | null
  catalogue_id: string | null
  location_id: string | null
  provider: string | null
  organization_app_id: string | null
}

export interface InstanviListTransactionsData {
  data: InstanviPaymentRow[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  summary: {
    totalPayments: number
    totalAmount: number
    successfulPayments: number
    failedPayments: number
    pendingPayments: number
    successAmount: number
  }
}

export interface InstanviVerifyActiveData {
  phoneNumber: string
  type: InstanviPaymentType
  result: boolean
}

export interface InstanviBasicUserInfo {
  given_name?: string
  family_name?: string
  birthdate?: string
  locale?: string
  gender?: string
  status?: string
}

export interface InstanviVerifyBasicInfoData {
  phoneNumber: string
  type: InstanviPaymentType
  result: InstanviBasicUserInfo
}

export interface InstanviListTransactionsQuery {
  startDate?: string
  endDate?: string
  status?: string
  currency?: string
  page?: number
  limit?: number
}
