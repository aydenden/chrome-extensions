/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EXTENSION_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// WebGPU types (minimal)
interface Navigator {
  gpu?: GPU;
}

interface GPU {
  requestAdapter(): Promise<GPUAdapter | null>;
}

interface GPUAdapter {
  requestDevice(): Promise<GPUDevice>;
  requestAdapterInfo(): Promise<GPUAdapterInfo>;
  limits: GPUAdapterLimits;
}

interface GPUDevice {}

interface GPUAdapterInfo {
  vendor?: string;
  architecture?: string;
}

interface GPUAdapterLimits {
  maxBufferSize?: number;
}
