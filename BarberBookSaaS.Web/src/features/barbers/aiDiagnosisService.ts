import apiClient from "../../api/apiClient";

export interface DiagnosisFace {
  shape: string;
  skin_tone: string;
  forehead: string;
  cheekbones: string;
  jawline: string;
  hair_current: string;
  overall: string;
}

export interface DiagnosisStyle {
  name: string;
  name_en: string;
  reason: string;
}

export interface DiagnosisProduct {
  name: string;
  benefit: string;
  how_to_use: string;
}

export interface DiagnosisResult {
  imageBase64: string;
  imageUrl: string;
  face: DiagnosisFace;
  styles: DiagnosisStyle[];
  whyWorks: string[];
  products: DiagnosisProduct[];
  maintenance: string;
}

export const AI_SERVICE_NAME = "Corte + Diagnóstico IA";

export interface AiDiagnosisQuota {
  plan: string;
  available: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetDate?: string;
}

const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
  });

export const aiDiagnosisService = {
  getExisting: async (appointmentId: string): Promise<DiagnosisResult | null> => {
    try {
      const r = await apiClient.get<DiagnosisResult>(
        `/api/appointments/${appointmentId}/ai-diagnosis`
      );
      return r.data;
    } catch {
      return null;
    }
  },

  diagnose: async (
    appointmentId: string,
    imageFile: File
  ): Promise<DiagnosisResult> => {
    const imageBase64 = await toBase64(imageFile);
    const r = await apiClient.post<DiagnosisResult>(
      `/api/appointments/${appointmentId}/ai-diagnosis`,
      { imageBase64 },
      { timeout: 120_000 }
    );
    return r.data;
  },

  getQuota: async (): Promise<AiDiagnosisQuota | null> => {
    try {
      const r = await apiClient.get<AiDiagnosisQuota>("/api/appointments/ai-diagnosis/quota");
      return r.data;
    } catch {
      return null;
    }
  },
};
