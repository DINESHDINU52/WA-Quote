/**
 * Multi-Company & Company of Record details.
 * Supports adding, selecting, and managing multiple companies for SaaS billing.
 */

export interface CompanyAddress {
  line1: string;
  line2?: string;
  city?: string;
  state: string;
  stateCode: string;
  pincode: string;
  country: string;
}

export interface CompanyBank {
  accountName: string;
  accountNumber: string;
  ifsc: string;
  accountType: string;
  bankName: string;
}

export interface CompanySettings {
  legalName: string;
  shortName: string;
  gstin: string;
  pan: string;
  stateCode: string;
  state: string;
  country: string;
  email: string;
  phone: string;
  address: CompanyAddress;
  bank: CompanyBank;
  footer: string;
  defaultGstRate: number;
  logoUrl?: string;
  logoBase64?: string;
  driveFileId?: string;
  quotationTerms?: string;
  invoiceTerms?: string;
  poTerms?: string;
}

export interface CompanyDoc extends CompanySettings {
  id: string;
  isDefault?: boolean;
  active?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export const COMPANY_DEFAULTS: CompanySettings = {
  legalName: 'My Company Private Limited',
  shortName: 'My Company',
  gstin: '',
  pan: '',
  stateCode: '33',
  state: 'Tamil Nadu',
  country: 'India',
  email: 'contact@example.com',
  phone: '+91 90000 00000',
  quotationTerms: '',
  invoiceTerms: '',
  poTerms: '',
  address: {
    line1: '123 Business Street',
    line2: '',
    city: 'Chennai',
    state: 'Tamil Nadu',
    stateCode: '33',
    pincode: '600001',
    country: 'India'
  },
  bank: {
    accountName: 'My Company Private Limited',
    accountNumber: '',
    ifsc: '',
    accountType: 'Current',
    bankName: ''
  },
  footer: 'Thank you for your business. For any enquiries, please reach out via email or phone.',
  defaultGstRate: 0.18
};
