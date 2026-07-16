export const SMS_PACKAGES = {
  small: { amount: 101, sms_count: 50, label: "Small" },
  medium: { amount: 201, sms_count: 110, label: "Medium" },
  large: { amount: 501, sms_count: 300, label: "Large" },
} as const;

export type SmsPackageType = keyof typeof SMS_PACKAGES;

export type EsewaInitResponse = {
  success: boolean;
  error?: string;
  formParams?: Record<string, string>;
  esewaUrl?: string;
};

export type EsewaVerifyResponse = {
  success: boolean;
  error?: string;
  smsAdded?: number;
};
