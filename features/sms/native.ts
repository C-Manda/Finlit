import type {SmsNative} from './native.types';
// Metro selects native.android.ts only on Android. Web and iOS never load Kotlin.
export const smsNative:SmsNative|null=null;
