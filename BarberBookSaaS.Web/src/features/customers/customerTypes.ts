export interface CustomerListItem {
  id: string;
  name: string;
  phone: string;
  email?: string;
  loyaltyCount: number;
  createdAt: string;
}

export interface CustomersPagedResult {
  data: CustomerListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LoyaltyConfig {
  enabled: boolean;
  threshold: number;
  rewardServiceId: string | null;
  rewardServiceName: string | null;
}