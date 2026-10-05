export type ActualAudioInput = {
  deviceId: string;
  label: string;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
};

export type AudioInputOption = {
  deviceId: string;
  label: string;
};

export type StorageStatus = {
  available: boolean;
  warning?: string;
};
