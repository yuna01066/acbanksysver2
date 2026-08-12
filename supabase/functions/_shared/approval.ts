export interface ApprovalProfile {
  is_approved?: boolean | null;
}

export function isApprovedProfile(profile: ApprovalProfile | null | undefined): boolean {
  return profile?.is_approved === true;
}
