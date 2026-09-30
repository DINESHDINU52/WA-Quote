/**
 * Indian states + UTs with GST state codes.
 * Used for the customer address dropdown so the intra-vs-inter-state tax
 * mode is decided correctly: customer.stateCode === company.stateCode
 *   → CGST + SGST (intra-state)
 *   → otherwise IGST (inter-state)
 *
 * Codes are the official 2-digit GSTIN prefixes (TIN codes). For example,
 * Tamil Nadu = 33, Karnataka = 29.
 */

export interface IndianState {
  /** Two-digit GST state code (string, leading zeros preserved). */
  code: string;
  /** Display name. */
  name: string;
  /** True if the entity is a Union Territory (no SGST; usually UTGST). */
  ut?: boolean;
}

export const INDIAN_STATES: IndianState[] = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh', ut: true },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi', ut: true },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman & Diu', ut: true },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu', ut: true },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh (Old)' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep', ut: true },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry', ut: true },
  { code: '35', name: 'Andaman & Nicobar Islands', ut: true },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh', ut: true },
  { code: '97', name: 'Other Territory' },
  { code: '99', name: 'Other Country (export)' }
];

export function findStateByCode(code: string): IndianState | undefined {
  return INDIAN_STATES.find((s) => s.code === code);
}

export function findStateByName(name: string): IndianState | undefined {
  const norm = name.trim().toLowerCase();
  return INDIAN_STATES.find((s) => s.name.toLowerCase() === norm);
}
