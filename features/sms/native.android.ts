import {requireOptionalNativeModule} from 'expo';
import type {SmsNative} from './native.types';
// Expo Go has no custom SMS module; show a build explanation rather than crash.
export const smsNative=requireOptionalNativeModule<SmsNative>('FinlitSms');
