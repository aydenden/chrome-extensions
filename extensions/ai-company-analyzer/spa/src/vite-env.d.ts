/// <reference types="vite/client" />

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
