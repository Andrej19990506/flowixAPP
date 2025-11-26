export type Role = 'chef' | 'courier' | 'none';

export interface CompanyInfo {
  id: number;
  company_name: string;
  bot_username?: string;
}

export interface CompanyRoleInfo {
  id: number;
  role_name: string;
  role_code: string;
  icon?: string;
  color?: string;
  description?: string;
  is_working_group?: boolean;
}

export interface FeatureInfo {
  id: number;
  feature_code: string;
  feature_name: string;
  description?: string;
  icon?: string;
}

export interface UserGroup {
  id: string;
  group_id?: number | string;
  group_type: Role;
  name: string;
  company?: CompanyInfo | null;
  company_role?: CompanyRoleInfo | null;
  features?: FeatureInfo[];
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  username?: string;
  photoUrl?: string;
  groups: UserGroup[];
}

