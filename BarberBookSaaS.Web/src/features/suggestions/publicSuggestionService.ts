import publicApiClient from "../../api/publicApiClient";

export const publicSuggestionService = {
  create: async (subdomain: string, type: "queja" | "sugerencia", message: string): Promise<void> => {
    await publicApiClient.post(`/api/public/${subdomain}/suggestions`, { type, message });
  },
};
