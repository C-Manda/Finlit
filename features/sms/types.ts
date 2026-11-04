export type Provider = 'mtn' | 'airtel' | 'zamtel';
export type SmsKind = 'received' | 'sent' | 'withdrawal' | 'deposit' | 'merchant_payment' | 'bill_payment' | 'airtime_purchase' | 'data_purchase' | 'bank_transfer' | 'reversal' | 'refund' | 'loan' | 'balance_check' | 'failed' | 'unknown';
export type SmsMessage = { id: string; sender: string; body: string; receivedAt: string; subscriptionId: string | null; fingerprint: string };
export type ParsedSms = {
 provider: Provider; kind: SmsKind; amountMinor: number | null; feeMinor: number | null; balanceMinor: number | null;
 reference: string | null; occurredAt: string; receivedAt: string; timestampSource: 'provider' | 'receipt';
 parserVersion: string; status: 'requires_review' | 'balance_only' | 'failed'; warnings: string[];
};
export type ImportStatus = 'requires_review' | 'imported' | 'matched_existing' | 'history_only' | 'ignored';
export type SmsImport = {id:string; location_id:string; provider:Provider; provider_transaction_id:string|null; message_fingerprint:string; status:ImportStatus; transaction_type:SmsKind; amount:number|null; fee_amount:number|null; balance_after:number|null; transaction_occurred_at:string; sms_received_at:string; financial_entry_id:string|null; parser_version:string};
export type LocalCandidate = {message:SmsMessage; parsed:ParsedSms; approval?:Record<string,unknown>; error?:string};
