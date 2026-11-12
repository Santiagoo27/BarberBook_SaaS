import apiClient from "../../api/apiClient";
import publicApiClient from "../../api/publicApiClient";

export interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
}

export interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  appointmentId: string | null;
  createdAt: string;
}

export interface AdminReviewsResponse {
  reviews: ReviewItem[];
  averageRating: number;
  totalReviews: number;
}

export const reviewService = {
  submitReview: async (
    subdomain: string,
    rating: number,
    comment?: string,
    appointmentId?: string
  ): Promise<void> => {
    await publicApiClient.post(`/api/public/${subdomain}/reviews`, {
      rating,
      comment: comment || null,
      appointmentId: appointmentId || null,
    });
  },

  getSummary: async (subdomain: string): Promise<ReviewSummary> => {
    const r = await publicApiClient.get<ReviewSummary>(
      `/api/public/${subdomain}/reviews/summary`
    );
    return r.data;
  },

  getAdminReviews: async (
    paramsOrLimit: { limit?: number; from?: string; to?: string } | number = 50
  ): Promise<AdminReviewsResponse> => {
    const params =
      typeof paramsOrLimit === "number"
        ? { limit: paramsOrLimit }
        : paramsOrLimit;
    const r = await apiClient.get<AdminReviewsResponse>("/api/tenant/reviews", { params });
    return r.data;
  },
};
